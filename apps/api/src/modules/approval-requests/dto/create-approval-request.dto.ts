import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import type { RiskLevel } from '@approva/shared';

const RISK_LEVELS = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical',
} as const;

const CAPABILITY_DELIVERY_MODES = {
  none: 'none',
  exchange_token: 'exchange_token',
} as const;

class ApprovalResourceDto {
  @ApiProperty({ example: 'service' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({ example: 'payments-worker' })
  @IsString()
  @IsNotEmpty()
  id!: string;
}

class RequestedByDto {
  @ApiProperty({ example: 'billing-automation' })
  @IsString()
  @IsNotEmpty()
  system!: string;

  @ApiProperty({ required: false, example: 'agent-run-42' })
  @IsOptional()
  @IsString()
  actorId?: string;
}

class ApprovalRequestCallbackDto {
  @ApiProperty({
    example: 'https://example.com/approval-callback',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  webhookUrl!: string;

  @ApiProperty({
    enum: Object.values(CAPABILITY_DELIVERY_MODES),
    required: false,
    default: 'none',
  })
  @IsOptional()
  @IsEnum(CAPABILITY_DELIVERY_MODES)
  deliverCapabilityMode?: 'none' | 'exchange_token';
}

export class CreateApprovalRequestDto {
  @ApiProperty({ required: false, example: 'ext_req_12345' })
  @IsOptional()
  @IsString()
  externalRequestId?: string;

  @ApiProperty({ type: RequestedByDto })
  @IsObject()
  @ValidateNested()
  @Type(() => RequestedByDto)
  requestedBy!: RequestedByDto;

  @ApiProperty({ example: 'deploy production release' })
  @IsString()
  @IsNotEmpty()
  action!: string;

  @ApiProperty({ enum: Object.values(RISK_LEVELS) })
  @IsEnum(RISK_LEVELS)
  riskLevel!: RiskLevel;

  @ApiProperty({ type: ApprovalResourceDto })
  @IsObject()
  @ValidateNested()
  @Type(() => ApprovalResourceDto)
  resource!: ApprovalResourceDto;

  @ApiProperty({
    required: false,
    type: Object,
    additionalProperties: true,
    example: {
      environment: 'production',
      version: '2026.03.15',
    },
  })
  @IsOptional()
  params?: Record<string, unknown> | unknown[] | null;

  @ApiProperty({
    required: false,
    example: 'https://example.com/approval-callback',
    description: 'Backward-compatible callback URL. Prefer the `callback` object.',
  })
  @IsOptional()
  @IsUrl()
  callbackUrl?: string;

  @ApiProperty({
    required: false,
    type: ApprovalRequestCallbackDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ApprovalRequestCallbackDto)
  callback?: ApprovalRequestCallbackDto;

  @ApiProperty({
    required: false,
    example: '2026-03-16T08:30:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
