import { UserRole } from '@domain/enums/user-role.enum';

export interface CreateUserRequest {
  name: string;
  email: string;
  role: UserRole;
  cpf?: string;
}
