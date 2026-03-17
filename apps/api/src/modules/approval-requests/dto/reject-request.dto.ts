import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class RejectRequestDto {
  @ApiProperty({ example: 'user_123' })
  @IsString()
  @IsNotEmpty()
  approverId!: string;

  @ApiProperty({ required: false, example: 'Olivia Reed' })
  @IsOptional()
  @IsString()
  approverDisplayName?: string;

  @ApiProperty({ required: false, example: 'Refund exceeds allowed threshold.' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ required: false, example: 'passkey_placeholder' })
  @IsOptional()
  @IsString()
  authMethod?: string;

  @ApiProperty({
    required: false,
    type: Object,
    additionalProperties: true,
    example: {
      verified: true,
      assuranceLevel: 'placeholder',
    },
  })
  @IsOptional()
  @IsObject()
  authContext?: Record<string, unknown>;
}
