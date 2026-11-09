import { UserRole } from '@domain/enums/user-role.enum';

export interface AuthUserSummaryResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUserSummaryResponse;
}

export interface AuthDataResponse {
  data: AuthResponse;
}
