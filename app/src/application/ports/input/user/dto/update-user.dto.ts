import { UserPublicView } from '@domain/entities/user.entity';
import { UserRole } from '@domain/enums/user-role.enum';

export interface UpdateUserDto {
  name?: string;
  email?: string;
  role?: UserRole;
}

export type UpdateUserOutputDto = UserPublicView;
