import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ArrayUnique,
} from 'class-validator';
import type { ApiKeyScope, CreateOrganizationApiKeyInput } from '@approva/shared';

const API_KEY_SCOPES: ApiKeyScope[] = [
  'approval_requests:create',
  'approval_requests:read',
  'capabilities:verify',
  'capabilities:use',
  'webhooks:manage',
];

export class CreateOrganizationApiKeyDto implements CreateOrganizationApiKeyInput {
  @ApiProperty({ example: 'Deploy agent production key' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    required: false,
    example: 'cmabcdef123456789',
  })
  @IsOptional()
  @IsString()
  serviceAccountId?: string | null;

  @ApiProperty({
    type: [String],
    enum: API_KEY_SCOPES,
    example: ['approval_requests:create', 'approval_requests:read', 'capabilities:use'],
  })
  @Type(() => String)
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  @IsIn(API_KEY_SCOPES, { each: true })
  scopes!: ApiKeyScope[];
}
