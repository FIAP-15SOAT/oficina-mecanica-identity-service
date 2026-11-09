import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '@domain/enums/user-role.enum';
import { MIN_NAME_LENGTH, MAX_NAME_LENGTH } from '@domain/constants/validation/user.constants';

export class CreateUserRequestDto {
  @ApiProperty({ example: 'João Silva', description: 'Nome completo (mín. 3 caracteres)' })
  @IsString({ message: 'O nome deve ser um texto' })
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  @MinLength(MIN_NAME_LENGTH, {
    message: `O nome deve ter no mínimo ${MIN_NAME_LENGTH} caracteres`,
  })
  @MaxLength(MAX_NAME_LENGTH, {
    message: `O nome deve ter no máximo ${MAX_NAME_LENGTH} caracteres`,
  })
  name!: string;

  @ApiProperty({ example: 'joao@email.com', description: 'E-mail único' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.ATTENDANT, description: 'Role do usuário' })
  @IsNotEmpty({ message: 'A role é obrigatória' })
  @IsEnum(UserRole, { message: 'Role inválida' })
  role!: UserRole;

  @ApiPropertyOptional({ example: '123.456.789-09', description: 'CPF do usuário' })
  @IsOptional()
  @IsString({ message: 'O CPF deve ser um texto' })
  cpf?: string;
}
