import { GetUserProfileUseCase } from '@application/use-cases/me/get-user-profile.use-case';
import { ResourceNotFoundException } from '@application/exceptions/resource-not-found.exception';
import { IFindUserByIdUseCase } from '@application/ports/input/user/find-user-by-id.use-case.interface';
import { IWorkOrderUserCustomersGateway } from '@application/ports/output/gateways/work-order/work-order-user-customers-gateway.interface';
import { ServiceIntegrationException } from '@infrastructure/exceptions/service-integration.exception';

import { createMockUser } from '../../../../helpers/user-mock.factory';
import {
  createMockWorkOrderUserCustomersGateway,
  readInternalUserCustomersFixture,
} from '../../../../helpers/work-order-user-customers-gateway-mock.factory';

describe('GetUserProfileUseCase', () => {
  let useCase: GetUserProfileUseCase;
  let findUserByIdUseCase: jest.Mocked<IFindUserByIdUseCase>;
  let gateway: jest.Mocked<IWorkOrderUserCustomersGateway>;

  beforeEach(() => {
    findUserByIdUseCase = { execute: jest.fn() };

    gateway = createMockWorkOrderUserCustomersGateway();

    useCase = new GetUserProfileUseCase(findUserByIdUseCase, gateway);
  });

  it('should join the user and the customers linked in the work order', async () => {
    const user = createMockUser().toPublicView();
    const customers = readInternalUserCustomersFixture().data;
    findUserByIdUseCase.execute.mockResolvedValue(user);
    gateway.findByUserId.mockResolvedValue(customers);

    const profile = await useCase.execute(user.id);

    expect(profile).toEqual({ ...user, customers });
    expect(findUserByIdUseCase.execute).toHaveBeenCalledWith(user.id);
    expect(gateway.findByUserId).toHaveBeenCalledWith(user.id);
  });

  it('should throw ResourceNotFoundException for a deleted user', async () => {
    findUserByIdUseCase.execute.mockRejectedValue(
      new ResourceNotFoundException('Usuário', 'deleted-id'),
    );

    await expect(useCase.execute('deleted-id')).rejects.toThrow(
      new ResourceNotFoundException('Usuário', 'deleted-id'),
    );

    expect(gateway.findByUserId).not.toHaveBeenCalled();
  });

  it('should propagate the work order unavailability', async () => {
    const unavailable = new ServiceIntegrationException('Indisponível');
    findUserByIdUseCase.execute.mockResolvedValue(createMockUser().toPublicView());
    gateway.findByUserId.mockRejectedValue(unavailable);

    await expect(useCase.execute('user-id')).rejects.toBe(unavailable);
  });
});
