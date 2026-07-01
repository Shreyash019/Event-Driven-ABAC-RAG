import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Admin grant request: set any subset of a user's ABAC attributes. All optional — omitted
 * fields are left unchanged. The whitelist pipe strips anything else; authorization (scope)
 * is enforced in AdminService against the caller's RBAC grants.
 */
export class GrantDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tenant?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  department?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  clearance?: number;

  // Company seniority level (CompanyLevel). Floor is L3 (intern); cap loosely above L8.
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(12)
  level?: number;
}
