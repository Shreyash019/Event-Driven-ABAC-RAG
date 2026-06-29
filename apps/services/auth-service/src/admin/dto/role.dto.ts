import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Assign/remove a role for a user. `roleName` is required; the scope is optional —
 * omitted means a global (null) scope, which only a globally-scoped admin may grant.
 * The whitelist pipe strips anything else; scope authorization is enforced in AdminService.
 */
export class RoleAssignmentDto {
  @IsString()
  @MaxLength(64)
  roleName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  scopeTenant?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  scopeDepartment?: string;
}
