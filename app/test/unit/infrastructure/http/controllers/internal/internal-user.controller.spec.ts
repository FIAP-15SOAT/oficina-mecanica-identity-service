import { InternalUserController } from '@infrastructure/http/controllers/internal/internal-user.controller';
import { InternalUserController as InternalUserCleanController } from '@interface-adapters/user/internal-user.controller';

describe('InternalUserController (http)', () => {
  let httpController: InternalUserController;
  let cleanController: jest.Mocked<InternalUserCleanController>;

  beforeEach(() => {
    cleanController = {
      findOne: jest.fn(),
      ensureCustomerUser: jest.fn(),
      authenticateCustomerCredential: jest.fn(),
    } as unknown as jest.Mocked<InternalUserCleanController>;

    httpController = new InternalUserController(cleanController);
  });

  it('should delegate GET /internal/users/:id to the clean controller', async () => {
    const response = {
      data: { id: 'user-id', name: 'Ana', email: 'ana@example.com', role: null, isActive: true },
    };
    cleanController.findOne.mockResolvedValue(response);

    const result = await httpController.findOne('user-id');

    expect(result).toBe(response);
    expect(cleanController.findOne).toHaveBeenCalledWith('user-id');
  });

  it('should delegate POST /internal/customer-users to the clean controller', async () => {
    const request = { name: 'Maria', email: 'maria@example.com', cpf: '12345678909' };
    const response = { data: { userId: 'user-id', created: true } };
    cleanController.ensureCustomerUser.mockResolvedValue(response);

    const result = await httpController.ensureCustomerUser(request);

    expect(result).toBe(response);
    expect(cleanController.ensureCustomerUser).toHaveBeenCalledWith(request);
  });

  it('should delegate POST /internal/customer-authentications to the clean controller', async () => {
    const request = { cpf: '12345678909', password: 'Senha@123' };
    const response = { data: { userId: 'user-id' } };
    cleanController.authenticateCustomerCredential.mockResolvedValue(response);

    const result = await httpController.authenticateCustomerCredential(request);

    expect(result).toBe(response);
    expect(cleanController.authenticateCustomerCredential).toHaveBeenCalledWith(request);
  });
});
