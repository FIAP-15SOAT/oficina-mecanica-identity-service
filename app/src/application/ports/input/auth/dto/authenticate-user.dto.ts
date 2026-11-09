import { UserRole } from '@domain/enums/user-role.enum';

export interface AuthenticateUserInputDto {
  email: string;
  password: string;
}

export interface AuthenticateUserOutputDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole | null;
  };
}
