import { UserRole } from '@domain/enums/user-role.enum';

export interface RefreshTokenInputDto {
  refreshToken: string;
}

export interface RefreshTokenOutputDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole | null;
  };
}
