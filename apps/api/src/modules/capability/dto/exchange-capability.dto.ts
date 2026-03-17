import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ExchangeCapabilityDto {
  @ApiProperty({
    example: 'cex_8Fsd9Kj3l2PQx0HnV7eTsU6cM4RbYaQ',
  })
  @IsString()
  @IsNotEmpty()
  exchangeToken!: string;
}
