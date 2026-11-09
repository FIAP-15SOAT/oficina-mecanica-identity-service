import { IFindUserByIdUseCase } from '@application/ports/input/user/find-user-by-id.use-case.interface';
import { IEnsureCustomerUserUseCase } from '@application/ports/input/user/ensure-customer-user.use-case.interface';
import { IAuthenticateCustomerCredentialUseCase } from '@application/ports/input/auth/authenticate-customer-credential.use-case.interface';
import { UserPresenter } from '@interface-adapters/user/user.presenter';
import { InternalUserController } from '@interface-adapters/user/internal-user.controller';

import { createMockUser } from '../../../helpers/user-mock.factory';

describe('InternalUserController', () => {
  let controller: InternalUserController;
  let findUserByIdUseCase: jest.Mocked<IFindUserByIdUseCase>;
  let ensureCustomerUserUseCase: jest.Mocked<IEnsureCustomerUserUseCase>;
  let authenticateCustomerCredentialUseCase: jest.Mocked<IAuthenticateCustomerCredentialUseCase>;

  beforeEach(() => {
    findUserByIdUseCase = { execute: jest.fn() };
    ensureCustomerUserUseCase = { execute: jest.fn() };
    authenticateCustomerCredentialUseCase = { execute: jest.fn() };

    controller = new InternalUserController(
      findUserByIdUseCase,
      ensureCustomerUserUseCase,
      authenticateCustomerCredentialUseCase,
    );
  });

  it('should present the user through the presenter', async () => {
    const view = createMockUser().toPublicView();
    findUserByIdUseCase.execute.mockResolvedValue(view);

    const response = await controller.findOne(view.id);

    expect(response).toEqual(UserPresenter.toInternalDataResponse(view));
    expect(findUserByIdUseCase.execute).toHaveBeenCalledWith(view.id);
  });

  it('should present the ensured customer user', async () => {
    const input = { name: 'Maria', email: 'maria@example.com', cpf: '12345678909' };
    ensureCustomerUserUseCase.execute.mockResolvedValue({ userId: 'user-id', created: true });

    const response = await controller.ensureCustomerUser(input);

    expect(response).toEqual({ data: { userId: 'user-id', created: true } });
    expect(ensureCustomerUserUseCase.execute).toHaveBeenCalledWith(input);
  });

  it('should present the authenticated customer user id', async () => {
    const input = { cpf: '12345678909', password: 'Senha@123' };
    authenticateCustomerCredentialUseCase.execute.mockResolvedValue({ userId: 'user-id' });

    const response = await controller.authenticateCustomerCredential(input);

    expect(response).toEqual({ data: { userId: 'user-id' } });
    expect(authenticateCustomerCredentialUseCase.execute).toHaveBeenCalledWith(input);
  });
});
