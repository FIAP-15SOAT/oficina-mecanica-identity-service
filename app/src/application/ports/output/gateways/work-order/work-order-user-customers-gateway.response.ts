export interface UserCustomerGatewayResponse {
  id: string;
  name: string;
  type: 'INDIVIDUAL' | 'COMPANY';
  document: string;
  isActive: boolean;
}
