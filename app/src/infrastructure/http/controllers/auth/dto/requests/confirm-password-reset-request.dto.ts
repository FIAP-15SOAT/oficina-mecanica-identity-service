import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class ConfirmPasswordResetRequestDto {
  @ApiProperty({ example: 'joao@email.com', description: 'E-mail cadastrado' })
  @IsEmail({}, { message: 'E-mail inválido' })
  email!: string;

  @ApiProperty({
    example: '042731',
    description: 'Código numérico de 6 dígitos enviado por e-mail',
  })
  @IsString({ message: 'O código deve ser um texto' })
  @Length(6, 6, { message: 'O código deve ter 6 dígitos' })
  code!: string;

  @ApiProperty({
    example: 'NovaSenha@123',
    description:
      'Nova senha forte: no mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial',
  })
  @IsString({ message: 'A nova senha deve ser um texto' })
  newPassword!: string;
}
