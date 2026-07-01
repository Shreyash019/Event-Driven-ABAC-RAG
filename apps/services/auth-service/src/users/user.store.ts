import { randomUUID } from 'node:crypto';
import { type Algorithm, type Options, hash, verify } from '@node-rs/argon2';
import { Injectable, type OnModuleInit } from '@nestjs/common';

/**
 * Identity store for auth-service (loc-doc/AuthService.md §6, Phase C).
 *
 * The `IdentityProvider` interface is the seam from AuthService.md §2.3: today it is
 * backed by an in-memory seed (PoC), but a Postgres-backed store or a federated OIDC
 * provider can replace it without touching token issuance or the ABAC claim mapping.
 *
 * ABAC integrity (GUARDRAILS §1.3): `tenant`/`department`/`clearance` live on the user
 * record and are read server-side at token-mint time — never accepted from the client.
 */

/** DI token so consumers depend on the interface, not the concrete store. */
export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');

export interface User {
  id: string;
  email: string;
  name: string;
  /** argon2id hash — never the plaintext, never logged (GUARDRAILS §6.1). */
  passwordHash: string;
  /** ABAC attributes signed into the access token. */
  tenant: string;
  department: string;
  clearance: number;
  /** Company-wide seniority level (CompanyLevel); L3 = intern floor. */
  level: number;
}

/** Self-signup input. The client supplies ONLY these — never any ABAC scope. */
export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
}

/**
 * Forced scope for a self-registered account. A new user can authenticate but sees
 * NOTHING (unknown tenant/department, clearance 0) until an admin grants real attributes
 * — defaults shrink, never widen (GUARDRAILS §1.3/§1.5). The client can never set these.
 */
export const SELF_SIGNUP_SCOPE = {
  tenant: 'unassigned',
  department: 'unassigned',
  clearance: 0,
  level: 3, // L3 (intern floor) — the lowest company level
} as const;

export interface IdentityProvider {
  findById(id: string): Promise<User | null>;
  /**
   * Verify credentials. Returns the user on success, `null` on any failure (unknown
   * user OR wrong password) with no distinction between the two — no user enumeration
   * (AuthService.md §4). Implementations MUST equalize timing across both paths.
   */
  verifyCredentials(email: string, password: string): Promise<User | null>;
  /**
   * Create a self-registered user with forced minimal scope (SELF_SIGNUP_SCOPE).
   * Returns the new user, or `null` if the email is already taken.
   */
  createUser(input: CreateUserInput): Promise<User | null>;
  /** Replace a user's password hash (the caller must have already authorized this). */
  changePassword(userId: string, newPassword: string): Promise<void>;
}

// argon2id tuned for interactive login (OWASP-aligned baseline). One place to change.
const ARGON2_OPTIONS: Options = {
  algorithm: 2 satisfies Algorithm, // Algorithm.Argon2id (const enum; inlined for isolatedModules)
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

const DEV_DEFAULT_PASSWORD = 'changeme-dev-only';

/** Seed identities (PoC). Distinct departments/clearance so ABAC isolation is demoable. */
interface SeedUser extends Omit<User, 'passwordHash'> {
  /** Env var holding this user's plaintext password; falls back to the dev default. */
  passwordEnv: string;
}

const SEED_USERS: SeedUser[] = [
  {
    id: 'u_finance_1',
    email: 'finance@acme.test',
    name: 'Fiona Finance',
    tenant: 'acme',
    department: 'finance',
    clearance: 3,
    level: 4,
    passwordEnv: 'SEED_FINANCE_PASSWORD',
  },
  {
    id: 'u_hr_1',
    email: 'hr@acme.test',
    name: 'Harvey HR',
    tenant: 'acme',
    department: 'hr',
    clearance: 2,
    level: 4,
    passwordEnv: 'SEED_HR_PASSWORD',
  },
];

@Injectable()
export class InMemoryIdentityProvider implements IdentityProvider, OnModuleInit {
  private readonly byId = new Map<string, User>();
  private readonly byEmail = new Map<string, User>();
  /** Pre-hashed decoy verified against when no user matches, to equalize timing. */
  private decoyHash = '';

  async onModuleInit(): Promise<void> {
    const isProd = (process.env.NODE_ENV ?? 'development') === 'production';

    for (const seed of SEED_USERS) {
      const password = process.env[seed.passwordEnv]?.trim() || DEV_DEFAULT_PASSWORD;
      if (isProd && password === DEV_DEFAULT_PASSWORD) {
        // Fail closed: never run production with known demo credentials (GUARDRAILS §5.2).
        throw new Error(
          `Refusing to seed ${seed.email} with the dev default password in production; ` +
            `set ${seed.passwordEnv}`,
        );
      }
      const user: User = {
        id: seed.id,
        email: seed.email,
        name: seed.name,
        tenant: seed.tenant,
        department: seed.department,
        clearance: seed.clearance,
        level: seed.level,
        passwordHash: await hash(password, ARGON2_OPTIONS),
      };
      this.byId.set(user.id, user);
      this.byEmail.set(user.email.toLowerCase(), user);
    }

    this.decoyHash = await hash(DEV_DEFAULT_PASSWORD, ARGON2_OPTIONS);
  }

  async findById(id: string): Promise<User | null> {
    return this.byId.get(id) ?? null;
  }

  async verifyCredentials(email: string, password: string): Promise<User | null> {
    const user = this.byEmail.get(email.trim().toLowerCase());

    // Always run a verify, even when the user is unknown, so response time does not
    // reveal whether the email exists (anti-enumeration, AuthService.md §4).
    const ok = await verify(user?.passwordHash ?? this.decoyHash, password, ARGON2_OPTIONS);

    return ok && user ? user : null;
  }

  async createUser(input: CreateUserInput): Promise<User | null> {
    const email = input.email.trim().toLowerCase();
    if (this.byEmail.has(email)) return null;

    const user: User = {
      id: randomUUID(),
      email,
      name: input.name.trim(),
      passwordHash: await hash(input.password, ARGON2_OPTIONS),
      ...SELF_SIGNUP_SCOPE, // forced minimal scope; client cannot influence it
    };
    this.byId.set(user.id, user);
    this.byEmail.set(email, user);
    return user;
  }

  async changePassword(userId: string, newPassword: string): Promise<void> {
    const user = this.byId.get(userId);
    if (user) user.passwordHash = await hash(newPassword, ARGON2_OPTIONS);
  }
}
