import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsObject } from 'class-validator';
import type { IntegrationType } from '@approva/shared';

const INTEGRATION_TYPES = {
  slack: 'slack',
  webhook: 'webhook',
  email: 'email',
} as const;

export class CreateIntegrationDto {
  @ApiProperty({ enum: Object.values(INTEGRATION_TYPES) })
  @IsEnum(INTEGRATION_TYPES)
  type!: IntegrationType;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  configJson!: Record<string, unknown>;
}
