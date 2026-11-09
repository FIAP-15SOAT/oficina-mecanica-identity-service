import { UserRole } from '@domain/enums/user-role.enum';

export interface InternalUserResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole | null;
  isActive: boolean;
}

export interface InternalUserDataResponse {
  data: InternalUserResponse;
}

export interface InternalCustomerUserDataResponse {
  data: { userId: string; created: boolean };
}

export interface InternalCustomerAuthenticationDataResponse {
  data: { userId: string };
}
