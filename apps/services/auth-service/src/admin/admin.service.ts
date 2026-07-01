import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { type DeptRank, type Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { PERMISSIONS, RbacService, type Scope } from '../rbac/rbac.service';
import { SESSION_STORE, type SessionStore } from '../sessions/session.store';
import { TokenService } from '../jwt/token.service';

/**
 * Admin operations on users, authorized by scoped RBAC (RbacService). Listing returns
 * only users within the caller's scope; granting attributes and assigning roles require
 * the matching permission covering both the target's and the new scope. Never exposes
 * password hashes (GUARDRAILS §6.1).
 */

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  tenant: true,
  department: true,
  clearance: true,
  level: true,
  status: true,
  createdAt: true,
  roles: {
    select: {
      scopeTenant: true,
      scopeDepartment: true,
      role: { select: { name: true } },
    },
  },
  departments: {
    select: { rank: true, department: { select: { slug: true } } },
  },
  compartments: {
    select: { compartment: { select: { key: true } } },
  },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

export interface AdminRoleAssignment {
  role: string;
  scopeTenant: string | null;
  scopeDepartment: string | null;
}

export interface AdminUserView {
  id: string;
  email: string;
  name: string;
  tenant: string;
  department: string;
  clearance: number;
  level: number;
  status: string;
  roles: AdminRoleAssignment[];
  departments: Array<{ slug: string; rank: DeptRank }>;
  compartments: string[];
}

export interface GrantInput {
  tenant?: string;
  department?: string;
  clearance?: number;
  level?: number;
}

export interface RoleAssignmentInput {
  roleName: string;
  scopeTenant?: string | null;
  scopeDepartment?: string | null;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly tokens: TokenService,
    private readonly rbac: RbacService,
    private readonly prisma: PrismaService,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
  ) {}

  /** Users the caller may see, filtered to their `users:read` scopes. */
  async listUsers(accessToken: string): Promise<AdminUserView[]> {
    const callerId = await this.callerId(accessToken);
    const scopes = await this.rbac.scopesFor(callerId, PERMISSIONS.USERS_READ);
    if (scopes.length === 0) throw new ForbiddenException('Not permitted');

    const rows = await this.prisma.user.findMany({
      where: scopeWhere(scopes),
      orderBy: { createdAt: 'asc' },
      select: USER_SELECT,
    });
    return rows.map(toView);
  }

  /** Roles available to assign (caller needs `users:assign-role`). */
  async listRoles(accessToken: string): Promise<Array<{ name: string; description: string }>> {
    const callerId = await this.callerId(accessToken);
    if (!(await this.rbac.can(callerId, PERMISSIONS.USERS_ASSIGN_ROLE))) {
      throw new ForbiddenException('Not permitted');
    }
    return this.prisma.role.findMany({
      select: { name: true, description: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Set a user's ABAC attributes; requires `users:grant` over both old and new scope. */
  async grantAttributes(
    accessToken: string,
    targetId: string,
    input: GrantInput,
  ): Promise<AdminUserView> {
    const callerId = await this.callerId(accessToken);

    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('User not found');

    const next = {
      tenant: input.tenant ?? target.tenant,
      department: input.department ?? target.department,
      clearance: input.clearance ?? target.clearance,
      level: input.level ?? target.level,
    };
    await this.requireGrantScope(callerId, target.tenant, target.department);
    await this.requireGrantScope(callerId, next.tenant, next.department);

    await this.prisma.user.update({ where: { id: targetId }, data: next });
    await this.sessions.revokeUser(targetId); // scope change takes effect immediately
    this.logger.log(
      `audit user.granted target=${targetId} by=${callerId} ` +
        `tenant=${next.tenant} department=${next.department} ` +
        `clearance=${next.clearance} level=${next.level}`,
    );
    return this.view(targetId);
  }

  /** Assign a (scoped) role to a user; requires `users:assign-role` over that scope. */
  async assignRole(
    accessToken: string,
    targetId: string,
    input: RoleAssignmentInput,
  ): Promise<AdminUserView> {
    const callerId = await this.callerId(accessToken);
    const scopeTenant = input.scopeTenant ?? null;
    const scopeDepartment = input.scopeDepartment ?? null;
    await this.requireAssignScope(callerId, scopeTenant, scopeDepartment);

    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('User not found');
    const role = await this.prisma.role.findUnique({ where: { name: input.roleName } });
    if (!role) throw new NotFoundException('Role not found');

    const existing = await this.prisma.userRole.findFirst({
      where: { userId: targetId, roleId: role.id, scopeTenant, scopeDepartment },
    });
    if (!existing) {
      await this.prisma.userRole.create({
        data: { userId: targetId, roleId: role.id, scopeTenant, scopeDepartment },
      });
    }
    await this.sessions.revokeUser(targetId); // permissions changed → re-derive on next login
    this.logger.log(
      `audit role.assigned target=${targetId} by=${callerId} role=${input.roleName} ` +
        `scope=${scopeTenant ?? '*'}/${scopeDepartment ?? '*'}`,
    );
    return this.view(targetId);
  }

  /** Remove a (scoped) role from a user; requires `users:assign-role` over that scope. */
  async removeRole(
    accessToken: string,
    targetId: string,
    input: RoleAssignmentInput,
  ): Promise<AdminUserView> {
    const callerId = await this.callerId(accessToken);
    const scopeTenant = input.scopeTenant ?? null;
    const scopeDepartment = input.scopeDepartment ?? null;
    await this.requireAssignScope(callerId, scopeTenant, scopeDepartment);

    const role = await this.prisma.role.findUnique({ where: { name: input.roleName } });
    if (!role) throw new NotFoundException('Role not found');

    await this.prisma.userRole.deleteMany({
      where: { userId: targetId, roleId: role.id, scopeTenant, scopeDepartment },
    });
    await this.sessions.revokeUser(targetId);
    this.logger.log(
      `audit role.removed target=${targetId} by=${callerId} role=${input.roleName} ` +
        `scope=${scopeTenant ?? '*'}/${scopeDepartment ?? '*'}`,
    );
    return this.view(targetId);
  }

  private async requireGrantScope(
    callerId: string,
    tenant: string,
    department: string,
  ): Promise<void> {
    if (!(await this.rbac.can(callerId, PERMISSIONS.USERS_GRANT, { tenant, department }))) {
      throw new ForbiddenException('Not permitted for that scope');
    }
  }

  private async requireAssignScope(
    callerId: string,
    tenant: string | null,
    department: string | null,
  ): Promise<void> {
    if (
      !(await this.rbac.can(callerId, PERMISSIONS.USERS_ASSIGN_ROLE, { tenant, department }))
    ) {
      throw new ForbiddenException('Not permitted for that scope');
    }
  }

  private async view(targetId: string): Promise<AdminUserView> {
    const row = await this.prisma.user.findUniqueOrThrow({
      where: { id: targetId },
      select: USER_SELECT,
    });
    return toView(row);
  }

  private async callerId(accessToken: string): Promise<string> {
    try {
      return (await this.tokens.verifyAccessToken(accessToken)).sub;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}

function toView(row: UserRow): AdminUserView {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    tenant: row.tenant,
    department: row.department,
    clearance: row.clearance,
    level: row.level,
    status: row.status,
    roles: row.roles.map((r) => ({
      role: r.role.name,
      scopeTenant: r.scopeTenant,
      scopeDepartment: r.scopeDepartment,
    })),
    departments: row.departments.map((d) => ({
      slug: d.department.slug,
      rank: d.rank,
    })),
    compartments: row.compartments.map((c) => c.compartment.key),
  };
}

/** Build a Prisma filter from the caller's scopes; undefined = global (no filter). */
function scopeWhere(scopes: Scope[]): Prisma.UserWhereInput | undefined {
  if (scopes.some((s) => s.tenant === null && s.department === null)) return undefined;
  return {
    OR: scopes.map((s) => ({
      ...(s.tenant !== null ? { tenant: s.tenant } : {}),
      ...(s.department !== null ? { department: s.department } : {}),
    })),
  };
}
