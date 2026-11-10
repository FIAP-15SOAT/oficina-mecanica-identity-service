import {
  IGetUserProfileUseCase,
  UserProfile,
} from '@application/ports/input/me/get-user-profile.use-case.interface';
import { IFindUserByIdUseCase } from '@application/ports/input/user/find-user-by-id.use-case.interface';
import { IWorkOrderUserCustomersGateway } from '@application/ports/output/gateways/work-order/work-order-user-customers-gateway.interface';

export class GetUserProfileUseCase implements IGetUserProfileUseCase {
  constructor(
    private readonly findUserByIdUseCase: IFindUserByIdUseCase,
    private readonly workOrderUserCustomersGateway: IWorkOrderUserCustomersGateway,
  ) {}

  async execute(userId: string): Promise<UserProfile> {
    const user = await this.findUserByIdUseCase.execute(userId);
    const customers = await this.workOrderUserCustomersGateway.findByUserId(userId);

    return { ...user, customers };
  }
}
