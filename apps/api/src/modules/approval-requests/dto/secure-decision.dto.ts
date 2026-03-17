import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SecureDecisionDto {
  @ApiProperty({ required: false, example: 'Reviewed deployment checklist.' })
  @IsOptional()
  @IsString()
  reason?: string;
}
