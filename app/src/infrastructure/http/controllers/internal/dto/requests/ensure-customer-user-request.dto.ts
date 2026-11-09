import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

import { MAX_NAME_LENGTH, MIN_NAME_LENGTH } from '@domain/constants/validation/user.constants';

export class EnsureCustomerUserRequestDto {
  @IsString({ message: 'O nome deve ser um texto' })
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  @MinLength(MIN_NAME_LENGTH, {
    message: `O nome deve ter no mínimo ${MIN_NAME_LENGTH} caracteres`,
  })
  @MaxLength(MAX_NAME_LENGTH, {
    message: `O nome deve ter no máximo ${MAX_NAME_LENGTH} caracteres`,
  })
  name!: string;

  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email!: string;

  @IsString({ message: 'O CPF deve ser um texto' })
  @IsNotEmpty({ message: 'O CPF é obrigatório' })
  cpf!: string;
}
