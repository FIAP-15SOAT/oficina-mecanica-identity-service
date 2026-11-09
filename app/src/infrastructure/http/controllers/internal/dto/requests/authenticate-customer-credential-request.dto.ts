import { IsNotEmpty, IsString } from 'class-validator';

export class AuthenticateCustomerCredentialRequestDto {
  @IsString({ message: 'O CPF deve ser um texto' })
  @IsNotEmpty({ message: 'O CPF é obrigatório' })
  cpf!: string;

  @IsString({ message: 'A senha deve ser um texto' })
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  password!: string;
}
