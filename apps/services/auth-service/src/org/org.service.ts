import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { PERMISSIONS, RbacService } from '../rbac/rbac.service';
import { SESSION_STORE, type SessionStore } from '../sessions/session.store';
import { TokenService } from '../jwt/token.service';

/**
 * Manages the org structure (departments, compartments) and user memberships — the ABAC
 * data axis (loc-doc/OrgModel.md). Viewing requires `users:read`; mutating structure or
 * memberships requires `org:manage`. Membership/compartment changes revoke the target's
 * sessions so new scope is re-derived into claims on next login.
 *
 * Single-tenant for now: TENANT is fixed. Promote to a tenant entity for multi-tenant.
 */
const TENANT = 'acme';

export interface DepartmentView {
  id: string;
  slug: string;
  name: string;
  parentSlug: string | null;
}

export interface MembershipInput {
  slug: string;
  isManager?: boolean;
}

@Injectable()
export class OrgService {
  private readonly logger = new Logger(OrgService.name);

  constructor(
    private readonly tokens: TokenService,
    private readonly rbac: RbacService,
    private readonly prisma: PrismaService,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
  ) {}

  async listDepartments(accessToken: string): Promise<DepartmentView[]> {
    await this.require(accessToken, PERMISSIONS.USERS_READ);
    const rows = await this.prisma.department.findMany({
      where: { tenant: TENANT },
      select: { id: true, slug: true, name: true, parent: { select: { slug: true } } },
      orderBy: { slug: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      parentSlug: r.parent?.slug ?? null,
    }));
  }

  async listCompartments(accessToken: string): Promise<Array<{ key: string; name: string }>> {
    await this.require(accessToken, PERMISSIONS.USERS_READ);
    return this.prisma.compartment.findMany({
      where: { tenant: TENANT },
      select: { key: true, name: true },
      orderBy: { key: 'asc' },
    });
  }

  async createDepartment(
    accessToken: string,
    input: { slug: string; name: string; parentSlug?: string },
  ): Promise<DepartmentView> {
    const callerId = await this.require(accessToken, PERMISSIONS.ORG_MANAGE);

    let parentId: string | null = null;
    if (input.parentSlug) {
      const parent = await this.prisma.department.findUnique({
        where: { tenant_slug: { tenant: TENANT, slug: input.parentSlug } },
      });
      if (!parent) throw new NotFoundException('Parent department not found');
      parentId = parent.id;
    }

    try {
      const d = await this.prisma.department.create({
        data: { tenant: TENANT, slug: input.slug.trim(), name: input.name.trim(), parentId },
        select: { id: true, slug: true, name: true, parent: { select: { slug: true } } },
      });
      this.logger.log(`audit org.department_created slug=${d.slug} by=${callerId}`);
      return { id: d.id, slug: d.slug, name: d.name, parentSlug: d.parent?.slug ?? null };
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new ConflictException('A department with that slug already exists');
      }
      throw err;
    }
  }

  async createCompartment(
    accessToken: string,
    input: { key: string; name: string },
  ): Promise<{ key: string; name: string }> {
    const callerId = await this.require(accessToken, PERMISSIONS.ORG_MANAGE);
    try {
      const c = await this.prisma.compartment.create({
        data: { tenant: TENANT, key: input.key.trim(), name: input.name.trim() },
        select: { key: true, name: true },
      });
      this.logger.log(`audit org.compartment_created key=${c.key} by=${callerId}`);
      return c;
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new ConflictException('A compartment with that key already exists');
      }
      throw err;
    }
  }

  /** Replace a user's department memberships with the given set. */
  async setUserMemberships(
    accessToken: string,
    userId: string,
    memberships: MembershipInput[],
  ): Promise<void> {
    const callerId = await this.require(accessToken, PERMISSIONS.ORG_MANAGE);
    if (!(await this.prisma.user.findUnique({ where: { id: userId } }))) {
      throw new NotFoundException('User not found');
    }
    const slugs = memberships.map((m) => m.slug);
    const depts = await this.prisma.department.findMany({
      where: { tenant: TENANT, slug: { in: slugs } },
      select: { id: true, slug: true },
    });
    if (depts.length !== new Set(slugs).size) {
      throw new NotFoundException('One or more departments not found');
    }
    const bySlug = new Map(depts.map((d) => [d.slug, d.id]));

    await this.prisma.$transaction([
      this.prisma.userDepartment.deleteMany({ where: { userId } }),
      this.prisma.userDepartment.createMany({
        data: memberships.map((m) => ({
          userId,
          departmentId: bySlug.get(m.slug)!,
          isManager: m.isManager ?? false,
        })),
      }),
    ]);
    await this.sessions.revokeUser(userId);
    this.logger.log(
      `audit org.memberships_set target=${userId} by=${callerId} depts=${slugs.join(',') || '(none)'}`,
    );
  }

  /** Replace a user's compartments with the given set of keys. */
  async setUserCompartments(
    accessToken: string,
    userId: string,
    keys: string[],
  ): Promise<void> {
    const callerId = await this.require(accessToken, PERMISSIONS.ORG_MANAGE);
    if (!(await this.prisma.user.findUnique({ where: { id: userId } }))) {
      throw new NotFoundException('User not found');
    }
    const comps = await this.prisma.compartment.findMany({
      where: { tenant: TENANT, key: { in: keys } },
      select: { id: true },
    });
    if (comps.length !== new Set(keys).size) {
      throw new NotFoundException('One or more compartments not found');
    }

    await this.prisma.$transaction([
      this.prisma.userCompartment.deleteMany({ where: { userId } }),
      this.prisma.userCompartment.createMany({
        data: comps.map((c) => ({ userId, compartmentId: c.id })),
      }),
    ]);
    await this.sessions.revokeUser(userId);
    this.logger.log(
      `audit org.compartments_set target=${userId} by=${callerId} keys=${keys.join(',') || '(none)'}`,
    );
  }

  /**
   * Resolve a user's ABAC claim values for token-mint: department slugs (direct
   * memberships + descendants of any managed department) and compartment keys.
   */
  async effectiveClaims(
    userId: string,
  ): Promise<{ departments: string[]; compartments: string[] }> {
    const [memberships, comps, allDepts] = await Promise.all([
      this.prisma.userDepartment.findMany({
        where: { userId },
        select: { isManager: true, department: { select: { id: true, slug: true } } },
      }),
      this.prisma.userCompartment.findMany({
        where: { userId },
        select: { compartment: { select: { key: true } } },
      }),
      this.prisma.department.findMany({
        where: { tenant: TENANT },
        select: { id: true, slug: true, parentId: true },
      }),
    ]);

    const slugOf = new Map<string, string>();
    const childrenOf = new Map<string, string[]>();
    for (const d of allDepts) {
      slugOf.set(d.id, d.slug);
      if (d.parentId) {
        const kids = childrenOf.get(d.parentId) ?? [];
        kids.push(d.id);
        childrenOf.set(d.parentId, kids);
      }
    }
    const addDescendants = (deptId: string, out: Set<string>): void => {
      for (const childId of childrenOf.get(deptId) ?? []) {
        const slug = slugOf.get(childId);
        if (slug) out.add(slug);
        addDescendants(childId, out);
      }
    };

    const departments = new Set<string>();
    for (const m of memberships) {
      departments.add(m.department.slug);
      if (m.isManager) addDescendants(m.department.id, departments);
    }
    return {
      departments: [...departments],
      compartments: comps.map((c) => c.compartment.key),
    };
  }

  private async require(accessToken: string, permission: string): Promise<string> {
    let sub: string;
    try {
      sub = (await this.tokens.verifyAccessToken(accessToken)).sub;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
    if (!(await this.rbac.can(sub, permission))) {
      throw new ForbiddenException('Not permitted');
    }
    return sub;
  }
}
