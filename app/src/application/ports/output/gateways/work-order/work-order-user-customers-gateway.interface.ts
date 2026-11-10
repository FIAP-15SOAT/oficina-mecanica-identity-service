import { UserCustomerGatewayResponse } from './work-order-user-customers-gateway.response';

export interface IWorkOrderUserCustomersGateway {
  /** Active links of the user to active customers. */
  findByUserId(userId: string): Promise<UserCustomerGatewayResponse[]>;
}
