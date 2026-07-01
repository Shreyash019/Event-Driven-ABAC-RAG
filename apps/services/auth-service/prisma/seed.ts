import { type Algorithm, type Options, hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';

/**
 * Seeds the demo identities into Postgres. Idempotent (upsert by email) so it is safe to
 * run on every deploy. Passwords come from env; in production a seed user MUST NOT fall
 * back to the dev default (GUARDRAILS §5.2). Argon2id params match the runtime verifier.
 */

const prisma = new PrismaClient();

const ARGON2_OPTIONS: Options = {
  algorithm: 2 satisfies Algorithm, // Argon2id
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

const DEV_DEFAULT_PASSWORD = 'changeme-dev-only';

const SEED_USERS = [
  {
    email: 'finance@acme.test',
    name: 'Fiona Finance',
    tenant: 'acme',
    department: 'finance',
    clearance: 3,
    level: 4, // L4
    passwordEnv: 'SEED_FINANCE_PASSWORD',
  },
  {
    email: 'hr@acme.test',
    name: 'Harvey HR',
    tenant: 'acme',
    department: 'hr',
    clearance: 2,
    level: 4, // L4
    passwordEnv: 'SEED_HR_PASSWORD',
  },
  {
    email: 'admin@acme.test',
    name: 'Adam Admin',
    tenant: 'acme',
    department: 'it',
    clearance: 5,
    level: 7, // L7 — clears every seeded permission floor below
    passwordEnv: 'SEED_ADMIN_PASSWORD',
  },
] as const;

// RBAC seed: fine-grained permissions, a role hierarchy, and their mappings.
// `minLevel` is the org-level floor (Stage 1 of the combined gate): a user must be at least
// this company level to exercise the permission, checked before the scoped role grant.
const PERMISSIONS: Array<[key: string, description: string, minLevel: number]> = [
  ['users:read', 'View users within scope', 3],
  ['users:grant', "Set a user's tenant/department/clearance/level", 4],
  ['users:assign-role', 'Assign or remove roles for users', 5],
  ['roles:manage', 'Create and edit roles and permissions', 6],
  ['org:manage', 'Manage departments, compartments, and memberships', 6],
];

// `parent` defines the hierarchy: a role inherits all ancestor permissions.
// Each role lists only its OWN direct permissions (inheritance resolved at runtime).
const ROLES: Array<{
  name: string;
  description: string;
  parent: string | null;
  perms: string[];
}> = [
  { name: 'user', description: 'Base role', parent: null, perms: [] },
  {
    name: 'dept-admin',
    description: "Manage users within one's department",
    parent: 'user',
    perms: ['users:read', 'users:grant'],
  },
  {
    name: 'user-admin',
    description: 'Manage users and assign roles',
    parent: 'dept-admin',
    perms: ['users:assign-role'],
  },
  {
    name: 'super-admin',
    description: 'Full control including role and org management',
    parent: 'user-admin',
    perms: ['roles:manage', 'org:manage'],
  },
];

async function seedRbac(): Promise<void> {
  for (const [key, description, minLevel] of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: { description, minLevel },
      create: { key, description, minLevel },
    });
  }
  // Create roles first (so parents exist), then wire parent + permissions.
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: { name: r.name, description: r.description },
    });
  }
  for (const r of ROLES) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: r.name } });
    const parent = r.parent
      ? await prisma.role.findUniqueOrThrow({ where: { name: r.parent } })
      : null;
    const perms = await prisma.permission.findMany({ where: { key: { in: r.perms } } });

    await prisma.role.update({ where: { id: role.id }, data: { parentId: parent?.id ?? null } });
    // Reset to the desired permission set (idempotent).
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (perms.length > 0) {
      await prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      });
    }
  }

  // Grant super-admin (global scope) to the seeded admin user.
  const admin = await prisma.user.findUnique({ where: { email: 'admin@acme.test' } });
  const superAdmin = await prisma.role.findUnique({ where: { name: 'super-admin' } });
  if (admin && superAdmin) {
    const existing = await prisma.userRole.findFirst({
      where: { userId: admin.id, roleId: superAdmin.id, scopeTenant: null, scopeDepartment: null },
    });
    if (!existing) {
      await prisma.userRole.create({
        data: { userId: admin.id, roleId: superAdmin.id, scopeTenant: null, scopeDepartment: null },
      });
    }
    console.log('granted super-admin to admin@acme.test');
  }
}

// Org tree (single tenant). `parent` is a slug; created parent-first.
const TENANT = 'acme';
const DEPARTMENTS: Array<{ slug: string; name: string; parent: string | null }> = [
  { slug: 'finance', name: 'Finance', parent: null },
  { slug: 'finance.ap', name: 'Accounts Payable', parent: 'finance' },
  { slug: 'finance.ar', name: 'Accounts Receivable', parent: 'finance' },
  { slug: 'hr', name: 'Human Resources', parent: null },
  { slug: 'it', name: 'IT', parent: null },
];
const COMPARTMENTS: Array<{ key: string; name: string }> = [
  { key: 'M&A', name: 'Mergers & Acquisitions' },
  { key: 'PII', name: 'Personal Data' },
];

async function seedOrg(): Promise<void> {
  for (const d of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { tenant_slug: { tenant: TENANT, slug: d.slug } },
      update: { name: d.name },
      create: { tenant: TENANT, slug: d.slug, name: d.name },
    });
  }
  // Wire parents (now that all exist).
  for (const d of DEPARTMENTS) {
    if (!d.parent) continue;
    const [dept, parent] = await Promise.all([
      prisma.department.findUniqueOrThrow({ where: { tenant_slug: { tenant: TENANT, slug: d.slug } } }),
      prisma.department.findUniqueOrThrow({ where: { tenant_slug: { tenant: TENANT, slug: d.parent } } }),
    ]);
    await prisma.department.update({ where: { id: dept.id }, data: { parentId: parent.id } });
  }
  for (const c of COMPARTMENTS) {
    await prisma.compartment.upsert({
      where: { tenant_key: { tenant: TENANT, key: c.key } },
      update: { name: c.name },
      create: { tenant: TENANT, key: c.key, name: c.name },
    });
  }

  // Migrate seeded users' free-text department → a membership (idempotent).
  for (const seed of SEED_USERS) {
    const user = await prisma.user.findUnique({ where: { email: seed.email.toLowerCase() } });
    const dept = await prisma.department.findUnique({
      where: { tenant_slug: { tenant: TENANT, slug: seed.department } },
    });
    if (!user || !dept) continue;
    const rank = seed.department === 'it' ? 'MANAGER' : 'IC';
    await prisma.userDepartment.upsert({
      where: { userId_departmentId: { userId: user.id, departmentId: dept.id } },
      update: { rank },
      create: { userId: user.id, departmentId: dept.id, rank },
    });
  }
  console.log('seeded org (departments, compartments, memberships)');
}

async function main(): Promise<void> {
  const isProd = (process.env.NODE_ENV ?? 'development') === 'production';

  for (const seed of SEED_USERS) {
    const password = process.env[seed.passwordEnv]?.trim() || DEV_DEFAULT_PASSWORD;
    if (isProd && password === DEV_DEFAULT_PASSWORD) {
      throw new Error(
        `Refusing to seed ${seed.email} with the dev default password in production; set ${seed.passwordEnv}`,
      );
    }
    const email = seed.email.toLowerCase();
    const passwordHash = await hash(password, ARGON2_OPTIONS);
    await prisma.user.upsert({
      where: { email },
      update: {
        name: seed.name,
        tenant: seed.tenant,
        department: seed.department,
        clearance: seed.clearance,
        level: seed.level,
        status: 'ACTIVE',
        passwordHash,
      },
      create: {
        email,
        name: seed.name,
        tenant: seed.tenant,
        department: seed.department,
        clearance: seed.clearance,
        level: seed.level,
        passwordHash,
      },
    });
    console.log(`seeded ${email}`);
  }

  await seedRbac();
  await seedOrg();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
