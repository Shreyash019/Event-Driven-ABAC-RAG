import { PERMISSIONS, RbacService } from './rbac.service';
import type { PrismaService } from '../db/prisma.service';

/**
 * Unit tests for the scoped, hierarchical RBAC resolver. Prisma is mocked with a fixed
 * role graph so we test the pure logic: hierarchy inheritance + scope coverage.
 */

// Role graph mirroring the seed: user ◂ dept-admin ◂ user-admin ◂ super-admin.
// `minLevel` is the org-level floor per permission (Stage 1 of the combined gate).
const ROLES = [
  { id: 'r_user', parentId: null, permissions: [] },
  {
    id: 'r_dept',
    parentId: 'r_user',
    permissions: [
      { permission: { key: PERMISSIONS.USERS_READ, minLevel: 3 } },
      { permission: { key: PERMISSIONS.USERS_GRANT, minLevel: 4 } },
    ],
  },
  {
    id: 'r_useradmin',
    parentId: 'r_dept',
    permissions: [{ permission: { key: PERMISSIONS.USERS_ASSIGN_ROLE, minLevel: 5 } }],
  },
  {
    id: 'r_super',
    parentId: 'r_useradmin',
    permissions: [{ permission: { key: PERMISSIONS.ROLES_MANAGE, minLevel: 6 } }],
  },
];

function makeRbac(
  assignmentsByUser: Record<
    string,
    Array<{ roleId: string; scopeTenant: string | null; scopeDepartment: string | null }>
  >,
  // Company level of the querying user — defaults high enough to clear every floor so
  // scope/hierarchy tests are not gated by Stage 1. Set low to test the org-level floor.
  userLevel = 7,
): RbacService {
  const prisma = {
    userRole: {
      findMany: ({ where }: { where: { userId: string } }) =>
        Promise.resolve(assignmentsByUser[where.userId] ?? []),
    },
    role: {
      findMany: () => Promise.resolve(ROLES),
    },
    user: {
      findUnique: () => Promise.resolve({ level: userLevel }),
    },
  } as unknown as PrismaService;
  return new RbacService(prisma);
}

describe('RbacService', () => {
  it('expands role hierarchy into effective permissions', async () => {
    const rbac = makeRbac({
      u_super: [{ roleId: 'r_super', scopeTenant: null, scopeDepartment: null }],
    });
    const grants = await rbac.effectiveGrants('u_super');
    const perms = new Set(grants.map((g) => g.permission));
    // super-admin inherits everything down the chain
    expect(perms).toContain(PERMISSIONS.ROLES_MANAGE);
    expect(perms).toContain(PERMISSIONS.USERS_ASSIGN_ROLE);
    expect(perms).toContain(PERMISSIONS.USERS_GRANT);
    expect(perms).toContain(PERMISSIONS.USERS_READ);
  });

  it('grants a scoped dept-admin only within its tenant/department', async () => {
    const rbac = makeRbac({
      u_dept: [{ roleId: 'r_dept', scopeTenant: 'acme', scopeDepartment: 'finance' }],
    });
    await expect(
      rbac.can('u_dept', PERMISSIONS.USERS_GRANT, { tenant: 'acme', department: 'finance' }),
    ).resolves.toBe(true);
    // wrong department → denied
    await expect(
      rbac.can('u_dept', PERMISSIONS.USERS_GRANT, { tenant: 'acme', department: 'hr' }),
    ).resolves.toBe(false);
    // dept-admin lacks roles:manage entirely
    await expect(rbac.can('u_dept', PERMISSIONS.ROLES_MANAGE)).resolves.toBe(false);
  });

  it('null (global) scope covers any target', async () => {
    const rbac = makeRbac({
      u_super: [{ roleId: 'r_super', scopeTenant: null, scopeDepartment: null }],
    });
    await expect(
      rbac.can('u_super', PERMISSIONS.USERS_GRANT, { tenant: 'other', department: 'anything' }),
    ).resolves.toBe(true);
  });

  it('denies everything for a user with no assignments', async () => {
    const rbac = makeRbac({});
    await expect(rbac.can('nobody', PERMISSIONS.USERS_READ)).resolves.toBe(false);
    await expect(rbac.scopesFor('nobody', PERMISSIONS.USERS_READ)).resolves.toEqual([]);
  });

  it('denies when the org-level floor is not met, even with the scoped grant', async () => {
    // dept-admin holds users:grant (floor L4) but this user is only L3 → Stage 1 denies.
    const rbac = makeRbac(
      { u_junior: [{ roleId: 'r_dept', scopeTenant: 'acme', scopeDepartment: 'finance' }] },
      3,
    );
    await expect(
      rbac.can('u_junior', PERMISSIONS.USERS_GRANT, { tenant: 'acme', department: 'finance' }),
    ).resolves.toBe(false);
    // users:read has a lower floor (L3), so the same user still holds that one.
    await expect(
      rbac.can('u_junior', PERMISSIONS.USERS_READ, { tenant: 'acme', department: 'finance' }),
    ).resolves.toBe(true);
  });

  it('reports the scopes a permission is held in', async () => {
    const rbac = makeRbac({
      u_dept: [{ roleId: 'r_dept', scopeTenant: 'acme', scopeDepartment: 'finance' }],
    });
    const scopes = await rbac.scopesFor('u_dept', PERMISSIONS.USERS_READ);
    expect(scopes).toEqual([{ tenant: 'acme', department: 'finance' }]);
  });
});
