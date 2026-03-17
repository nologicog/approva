import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsString } from 'class-validator';
import type { OrganizationMemberRole, RiskLevel } from '@approva/shared';

const RISK_LEVELS = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical',
} as const;

const ORGANIZATION_MEMBER_ROLES = {
  owner: 'owner',
  admin: 'admin',
  member: 'member',
  approver: 'approver',
} as const;

export class CreatePolicyDto {
  @ApiProperty({ example: 'deployment.execute' })
  @IsString()
  action!: string;

  @ApiProperty({ example: 'service' })
  @IsString()
  resourceType!: string;

  @ApiProperty({ enum: Object.values(RISK_LEVELS) })
  @IsEnum(RISK_LEVELS)
  riskLevel!: RiskLevel;

  @ApiProperty({ example: true })
  @IsBoolean()
  approvalRequired!: boolean;

  @ApiProperty({ isArray: true, enum: Object.values(ORGANIZATION_MEMBER_ROLES) })
  @IsArray()
  @IsEnum(ORGANIZATION_MEMBER_ROLES, { each: true })
  approverRoles!: OrganizationMemberRole[];
}
