import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import type { ApprovalRequestStatus, RiskLevel } from '@approva/shared';

const APPROVAL_REQUEST_STATUSES = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  expired: 'expired',
  auto_approved: 'auto_approved',
} as const;

const RISK_LEVELS = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical',
} as const;

export class InternalApprovalRequestsQueryDto {
  @ApiPropertyOptional({ enum: Object.values(APPROVAL_REQUEST_STATUSES) })
  @IsOptional()
  @IsEnum(APPROVAL_REQUEST_STATUSES)
  status?: ApprovalRequestStatus;

  @ApiPropertyOptional({ enum: Object.values(RISK_LEVELS) })
  @IsOptional()
  @IsEnum(RISK_LEVELS)
  riskLevel?: RiskLevel;

  @ApiPropertyOptional({ example: 'deployment.execute' })
  @IsOptional()
  @IsString()
  actionContains?: string;

  @ApiPropertyOptional({ example: 'billing-api' })
  @IsOptional()
  @IsString()
  resourceIdContains?: string;
}
