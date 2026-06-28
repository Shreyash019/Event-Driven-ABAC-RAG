import {
  type Algorithm,
  type Options,
  hash,
  verify,
} from '@node-rs/argon2';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import {
  type CreateUserInput,
  type IdentityProvider,
  SELF_SIGNUP_SCOPE,
  type User,
} from './user.store';

/**
 * Postgres-backed IdentityProvider (replaces InMemoryIdentityProvider). Only ACTIVE
 * users authenticate — a disabled account fails closed (GUARDRAILS §1.4). ABAC
 * attributes come from the row, never the request (§1.3).
 */

// Mirror of the hashing params in user.store.ts; must match so existing hashes verify.
const ARGON2_OPTIONS: Options = {
  algorithm: 2 satisfies Algorithm, // Argon2id (const enum inlined for isolatedModules)
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  tenant: string;
  department: string;
  clearance: number;
};

@Injectable()
export class PrismaIdentityProvider implements IdentityProvider, OnModuleInit {
  /** Verified against when no user matches, to equalize timing (anti-enumeration). */
  private decoyHash = '';

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    this.decoyHash = await hash('decoy-input-not-a-real-password', ARGON2_OPTIONS);
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({
      where: { id, status: 'ACTIVE' },
    });
    return row ? this.toUser(row) : null;
  }

  async verifyCredentials(email: string, password: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), status: 'ACTIVE' },
    });

    // Always verify, even when no user matched, so timing doesn't reveal existence.
    const ok = await verify(
      row?.passwordHash ?? this.decoyHash,
      password,
      ARGON2_OPTIONS,
    );

    return ok && row ? this.toUser(row) : null;
  }

  async createUser(input: CreateUserInput): Promise<User | null> {
    const passwordHash = await hash(input.password, ARGON2_OPTIONS);
    try {
      const row = await this.prisma.user.create({
        data: {
          email: input.email.trim().toLowerCase(),
          name: input.name.trim(),
          passwordHash,
          ...SELF_SIGNUP_SCOPE, // forced minimal scope; status defaults to ACTIVE
        },
      });
      return this.toUser(row);
    } catch (err) {
      // Unique-email violation → caller maps to a conflict; anything else is a real error.
      if ((err as { code?: string }).code === 'P2002') return null;
      throw err;
    }
  }

  async changePassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await hash(newPassword, ARGON2_OPTIONS);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  private toUser(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.passwordHash,
      tenant: row.tenant,
      department: row.department,
      clearance: row.clearance,
    };
  }
}
