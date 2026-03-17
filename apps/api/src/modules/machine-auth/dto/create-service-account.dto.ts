import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { CreateServiceAccountInput } from '@approva/shared';

export class CreateServiceAccountDto implements CreateServiceAccountInput {
  @ApiProperty({ example: 'Deploy agent' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    required: false,
    example: 'Service account used by CI to request approvals for production deploys.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}
