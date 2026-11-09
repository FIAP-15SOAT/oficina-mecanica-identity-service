import { UserRole } from '@domain/enums/user-role.enum';

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: UserRole;
}
