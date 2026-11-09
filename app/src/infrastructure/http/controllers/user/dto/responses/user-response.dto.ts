import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@domain/enums/user-role.enum';
import { PaginatedResponseDto } from '@infrastructure/http/common/dto/paginated-response.dto';
import {
  UserDataResponse,
  UserPaginatedResponse,
  UserResponse,
} from '@interface-adapters/user/responses/user.response';

export class UserResponseDto implements UserResponse {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'João Silva' })
  name!: string;

  @ApiProperty({ example: 'joao@email.com' })
  email!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.ATTENDANT, nullable: true })
  role!: UserRole | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-04-20T12:00:00.000Z', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-04-20T12:00:00.000Z', format: 'date-time' })
  updatedAt!: Date;
}

export class UserDataResponseDto implements UserDataResponse {
  @ApiProperty({ type: UserResponseDto, description: 'Dados do usuário' })
  data!: UserResponseDto;
}

export class UserPaginatedResponseDto
  extends PaginatedResponseDto<UserResponseDto>
  implements UserPaginatedResponse
{
  @ApiProperty({ type: [UserResponseDto], description: 'Usuários da página atual' })
  data!: UserResponseDto[];
}
