import { PERMISSIONS, RbacService } from './rbac.service';
import type { PrismaService } from '../db/prisma.service';

/**
 * Unit tests for the scoped, hierarchical RBAC resolver. Prisma is mocked with a fixed
 * role graph so we test the pure logic: hierarchy inheritance + scope coverage.
 */

// Role graph mirroring the seed: user ◂ dept-admin ◂ user-admin ◂ super-admin.
const ROLES = [
  { id: 'r_user', parentId: null, permissions: [] },
  {
    id: 'r_dept',
    parentId: 'r_user',
    permissions: [
      { permission: { key: PERMISSIONS.USERS_READ } },
      { permission: { key: PERMISSIONS.USERS_GRANT } },
    ],
  },
  {
    id: 'r_useradmin',
    parentId: 'r_dept',
    permissions: [{ permission: { key: PERMISSIONS.USERS_ASSIGN_ROLE } }],
  },
  {
    id: 'r_super',
    parentId: 'r_useradmin',
    permissions: [{ permission: { key: PERMISSIONS.ROLES_MANAGE } }],
  },
];

function makeRbac(
  assignmentsByUser: Record<
    string,
    Array<{ roleId: string; scopeTenant: string | null; scopeDepartment: string | null }>
  >,
): RbacService {
  const prisma = {
    userRole: {
      findMany: ({ where }: { where: { userId: string } }) =>
        Promise.resolve(assignmentsByUser[where.userId] ?? []),
    },
    role: {
      findMany: () => Promise.resolve(ROLES),
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

  it('reports the scopes a permission is held in', async () => {
    const rbac = makeRbac({
      u_dept: [{ roleId: 'r_dept', scopeTenant: 'acme', scopeDepartment: 'finance' }],
    });
    const scopes = await rbac.scopesFor('u_dept', PERMISSIONS.USERS_READ);
    expect(scopes).toEqual([{ tenant: 'acme', department: 'finance' }]);
  });
});
