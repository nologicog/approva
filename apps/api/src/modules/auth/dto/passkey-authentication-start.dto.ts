import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class PasskeyAuthenticationStartDto {
  @ApiProperty({ example: 'approver@example.com' })
  @IsEmail()
  email!: string;
}
