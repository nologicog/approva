import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class VerifyLedgerDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  fromSeq?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  toSeq?: number;
}
