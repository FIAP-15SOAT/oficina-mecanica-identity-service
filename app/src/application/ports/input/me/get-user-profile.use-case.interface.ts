import { UserPublicView } from '@domain/entities/user.entity';
import { UserCustomerGatewayResponse } from '@application/ports/output/gateways/work-order/work-order-user-customers-gateway.response';

export interface UserProfile extends UserPublicView {
  customers: UserCustomerGatewayResponse[];
}

export interface IGetUserProfileUseCase {
  execute(userId: string): Promise<UserProfile>;
}
