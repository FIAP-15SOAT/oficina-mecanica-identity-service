import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '@domain/enums/user-role.enum';
import { MIN_NAME_LENGTH, MAX_NAME_LENGTH } from '@domain/constants/validation/user.constants';

export class UpdateUserRequestDto {
  @ApiPropertyOptional({ example: 'João Silva', description: 'Nome completo (mín. 3 caracteres)' })
  @IsOptional()
  @IsString({ message: 'O nome deve ser um texto' })
  @MinLength(MIN_NAME_LENGTH, {
    message: `O nome deve ter no mínimo ${MIN_NAME_LENGTH} caracteres`,
  })
  @MaxLength(MAX_NAME_LENGTH, {
    message: `O nome deve ter no máximo ${MAX_NAME_LENGTH} caracteres`,
  })
  name?: string;

  @ApiPropertyOptional({ example: 'joao@email.com', description: 'E-mail único' })
  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido' })
  email?: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.MECHANIC })
  @IsOptional()
  @IsEnum(UserRole, {
    message: `A role deve ser uma das seguintes: ${Object.values(UserRole).join(', ')}`,
  })
  role?: UserRole;
}
