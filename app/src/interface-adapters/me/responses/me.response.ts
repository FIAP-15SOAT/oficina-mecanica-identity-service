import { UserRole } from '@domain/enums/user-role.enum';

export interface MyCustomerSummary {
  id: string;
  name: string;
  type: 'INDIVIDUAL' | 'COMPANY';
}

export interface MeResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole | null;
  customers: MyCustomerSummary[];
}

export interface MeDataResponse {
  data: MeResponse;
}
