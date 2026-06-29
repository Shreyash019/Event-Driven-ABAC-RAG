import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

/**
 * RBAC resolver (authorization), kept separate from ABAC (data access). Roles, their
 * permissions, and the hierarchy live in Postgres (DB-managed); this service expands a
 * user's scoped role assignments into effective permission grants and answers checks.
 *
 * A grant = (permission, scope). Scope is tenant/department; null means "all". A role
 * inherits all of its ancestors' permissions (sub-roles), resolved here at request time
 * so the JWT never carries permissions (no bloat, no staleness with runtime edits).
 */

/** Canonical permission keys (must match the seeded Permission.key values). */
export const PERMISSIONS = {
  USERS_READ: 'users:read',
  USERS_GRANT: 'users:grant',
  USERS_ASSIGN_ROLE: 'users:assign-role',
  ROLES_MANAGE: 'roles:manage',
  /** Manage org structure: departments, compartments, and user memberships. */
  ORG_MANAGE: 'org:manage',
} as const;

export interface Scope {
  tenant: string | null;
  department: string | null;
}

export interface Grant extends Scope {
  permission: string;
}

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  /** All (permission, scope) grants a user effectively holds, with hierarchy expanded. */
  async effectiveGrants(userId: string): Promise<Grant[]> {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true, scopeTenant: true, scopeDepartment: true },
    });
    if (assignments.length === 0) return [];

    const roles = await this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
    });
    const byId = new Map(roles.map((r) => [r.id, r]));

    // permission keys for a role including all ancestors (memoized)
    const cache = new Map<string, Set<string>>();
    const permsForRole = (roleId: string): Set<string> => {
      const cached = cache.get(roleId);
      if (cached) return cached;
      const set = new Set<string>();
      const role = byId.get(roleId);
      if (role) {
        for (const rp of role.permissions) set.add(rp.permission.key);
        if (role.parentId) for (const k of permsForRole(role.parentId)) set.add(k);
      }
      cache.set(roleId, set);
      return set;
    };

    const grants: Grant[] = [];
    for (const a of assignments) {
      for (const permission of permsForRole(a.roleId)) {
        grants.push({
          permission,
          tenant: a.scopeTenant,
          department: a.scopeDepartment,
        });
      }
    }
    return grants;
  }

  /**
   * Does the user hold `permission`? With a `target`, the grant's scope must cover it
   * (null scope = covers everything). Without a target, any scope counts ("has it at all").
   */
  async can(userId: string, permission: string, target?: Scope): Promise<boolean> {
    const grants = await this.effectiveGrants(userId);
    return grants.some((g) => g.permission === permission && covers(g, target));
  }

  /** Distinct role names assigned to the user (for display in the session). */
  async rolesFor(userId: string): Promise<string[]> {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId },
      select: { role: { select: { name: true } } },
    });
    return [...new Set(assignments.map((a) => a.role.name))];
  }

  /** The scopes in which the user holds `permission` — used to filter scoped queries. */
  async scopesFor(userId: string, permission: string): Promise<Scope[]> {
    const grants = await this.effectiveGrants(userId);
    return grants
      .filter((g) => g.permission === permission)
      .map((g) => ({ tenant: g.tenant, department: g.department }));
  }
}

/** A grant covers a target if each scope field is null (any) or equals the target's. */
function covers(grant: Scope, target?: Scope): boolean {
  if (!target) return true;
  const tenantOk = grant.tenant === null || grant.tenant === target.tenant;
  const deptOk = grant.department === null || grant.department === target.department;
  return tenantOk && deptOk;
}
