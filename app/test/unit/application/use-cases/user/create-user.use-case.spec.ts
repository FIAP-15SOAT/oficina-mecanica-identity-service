import { CreateUserUseCase } from '@application/use-cases/user/create-user.use-case';
import { ResourceConflictException } from '@application/exceptions/resource-conflict.exception';
import { IHashService } from '@application/ports/output/services/hash.service.interface';
import { UserRole } from '@domain/enums/user-role.enum';
import { IOutboxRepository } from '@domain/interfaces/repositories/outbox.repository.interface';
import { IUnitOfWork } from '@domain/interfaces/repositories/unit-of-work.interface';
import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';

import { createMockUnitOfWorkWithRepos } from '../../../../helpers/unit-of-work-mock.factory';
import { createMockUser } from '../../../../helpers/user-mock.factory';

describe('CreateUserUseCase', () => {
  let useCase: CreateUserUseCase;
  let unitOfWork: jest.Mocked<IUnitOfWork>;
  let userRepository: jest.Mocked<IUserRepository>;
  let outbox: jest.Mocked<IOutboxRepository>;
  let hashService: jest.Mocked<IHashService>;

  const input = {
    name: 'Novo Funcionário',
    email: 'novo@example.com',
    role: UserRole.ATTENDANT,
  };

  beforeEach(() => {
    const mocks = createMockUnitOfWorkWithRepos();

    unitOfWork = mocks.unitOfWork;
    userRepository = mocks.repos.user as jest.Mocked<IUserRepository>;
    outbox = mocks.repos.outbox as jest.Mocked<IOutboxRepository>;
    hashService = {
      hash: jest.fn().mockResolvedValue('hashed-generated-password'),
      compare: jest.fn(),
    };

    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.create.mockImplementation((user) => Promise.resolve(user));

    useCase = new CreateUserUseCase(unitOfWork, hashService);
  });

  it('should hash a generated password and return the public view without it', async () => {
    const result = await useCase.execute(input);

    expect(hashService.hash).toHaveBeenCalledWith(expect.any(String));
    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'hashed-generated-password' }),
    );

    expect(result.email).toBe('novo@example.com');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('should add the initial password e-mail to the outbox in the user transaction', async () => {
    await useCase.execute(input);

    const generatedPassword = hashService.hash.mock.calls[0][0];

    expect(outbox.add).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'notification.email.send',
        workOrderId: null,
        payload: expect.objectContaining({
          to: ['novo@example.com'],
          purpose: 'staff_initial_password',
          text: expect.stringContaining(generatedPassword),
        }),
      }),
    );
  });

  it('should not add the e-mail when the user insert fails', async () => {
    userRepository.create.mockRejectedValue(new Error('insert failed'));

    await expect(useCase.execute(input)).rejects.toThrow('insert failed');

    expect(outbox.add).not.toHaveBeenCalled();
  });

  it('should return 409 without hashing when the e-mail is already registered', async () => {
    userRepository.findByEmail.mockResolvedValue(createMockUser());

    await expect(useCase.execute(input)).rejects.toThrow(
      new ResourceConflictException('E-mail já cadastrado no sistema'),
    );

    expect(hashService.hash).not.toHaveBeenCalled();
    expect(userRepository.create).not.toHaveBeenCalled();
    expect(outbox.add).not.toHaveBeenCalled();
  });
});
