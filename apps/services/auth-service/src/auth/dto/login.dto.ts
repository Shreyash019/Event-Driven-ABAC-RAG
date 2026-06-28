import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Login request body. Validated by the global ValidationPipe (whitelist + transform),
 * so unknown fields are stripped — the client states only its email + password here and
 * NEVER any identity scope (tenant/department/clearance); those are server-derived from
 * the user record at mint time (GUARDRAILS §1.3).
 *
 * Lengths are bounded deliberately: an unbounded password would let a caller drive
 * argon2 cost arbitrarily high (a CPU/memory DoS on the login path).
 */
export class LoginDto {
  @IsEmail({}, { message: 'A valid email is required' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}
