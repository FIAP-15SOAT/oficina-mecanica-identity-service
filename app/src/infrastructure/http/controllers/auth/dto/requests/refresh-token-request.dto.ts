import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenRequestDto {
  @ApiProperty({ example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'Refresh token' })
  @IsString({ message: 'O refresh token deve ser um texto' })
  @IsNotEmpty({ message: 'O refresh token é obrigatório' })
  refreshToken!: string;
}
