import { DeptRank } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const SLUG = /^[a-z0-9._-]+$/;

export class CreateDepartmentDto {
  @IsString()
  @Matches(SLUG, { message: 'slug must be lowercase letters, digits, dots, hyphens' })
  @MaxLength(64)
  slug!: string;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  parentSlug?: string;
}

export class CreateCompartmentDto {
  @IsString()
  @MaxLength(64)
  key!: string;

  @IsString()
  @MaxLength(100)
  name!: string;
}

export class MembershipDto {
  @IsString()
  @MaxLength(64)
  slug!: string;

  @IsOptional()
  @IsEnum(DeptRank)
  rank?: DeptRank;
}

export class SetMembershipsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MembershipDto)
  memberships!: MembershipDto[];
}

export class SetCompartmentsDto {
  @IsArray()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  keys!: string[];
}
