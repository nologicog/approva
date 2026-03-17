import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

class ApprovalResourceDto {
  @ApiProperty({ example: 'invoice' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({ example: 'inv_123' })
  @IsString()
  @IsNotEmpty()
  id!: string;
}

export class VerifyCapabilityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'refund invoice' })
  @IsString()
  @IsNotEmpty()
  action!: string;

  @ApiProperty({ type: ApprovalResourceDto })
  @IsObject()
  @ValidateNested()
  @Type(() => ApprovalResourceDto)
  resource!: ApprovalResourceDto;

  @ApiProperty({
    required: false,
    type: Object,
    additionalProperties: true,
    example: { amount: 4999, currency: 'USD' },
  })
  @IsOptional()
  params?: Record<string, unknown> | unknown[] | null;
}
