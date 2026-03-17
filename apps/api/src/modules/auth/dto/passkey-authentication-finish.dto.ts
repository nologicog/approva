import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsObject } from 'class-validator';

export class PasskeyAuthenticationFinishDto {
  @ApiProperty({ example: 'approver@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ type: Object, additionalProperties: true })
  @IsObject()
  response!: Record<string, unknown>;
}
