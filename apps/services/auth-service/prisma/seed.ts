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
    passwordEnv: 'SEED_FINANCE_PASSWORD',
  },
  {
    email: 'hr@acme.test',
    name: 'Harvey HR',
    tenant: 'acme',
    department: 'hr',
    clearance: 2,
    passwordEnv: 'SEED_HR_PASSWORD',
  },
] as const;

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
        status: 'ACTIVE',
        passwordHash,
      },
      create: {
        email,
        name: seed.name,
        tenant: seed.tenant,
        department: seed.department,
        clearance: seed.clearance,
        passwordHash,
      },
    });
    console.log(`seeded ${email}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
