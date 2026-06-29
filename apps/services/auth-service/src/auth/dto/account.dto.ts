import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Account-lifecycle request bodies. As with login, the client supplies ONLY these fields
 * — never any identity scope (tenant/department/clearance); those are server-forced
 * (GUARDRAILS §1.3). Password length is bounded to keep argon2 cost in check.
 */
export class SignupDto {
  @IsEmail({}, { message: 'A valid email is required' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(256)
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(256)
  newPassword!: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'A valid email is required' })
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  token!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(256)
  newPassword!: string;
}
