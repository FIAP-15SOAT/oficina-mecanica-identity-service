import { DomainValidationException } from '@domain/exceptions/domain-validation.exception';
import { IOutboxRepository } from '@domain/interfaces/repositories/outbox.repository.interface';
import { IUnitOfWork } from '@domain/interfaces/repositories/unit-of-work.interface';
import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';
import { Cpf } from '@domain/value-objects/cpf.vo';

import { BUSINESS_EVENTS } from '@application/logging/business-event.catalog';
import { ResourceConflictException } from '@application/exceptions/resource-conflict.exception';
import { IHashService } from '@application/ports/output/services/hash.service.interface';
import { ILogger } from '@application/ports/output/services/logger.service.interface';
import { EnsureCustomerUserUseCase } from '@application/use-cases/user/ensure-customer-user.use-case';

import { createMockHashService } from '../../../../helpers/hash-mock.factory';
import { createMockLogger } from '../../../../helpers/logger-mock.factory';
import { createMockUnitOfWorkWithRepos } from '../../../../helpers/unit-of-work-mock.factory';
import { createMockUser } from '../../../../helpers/user-mock.factory';

describe('EnsureCustomerUserUseCase', () => {
  let useCase: EnsureCustomerUserUseCase;
  let unitOfWork: jest.Mocked<IUnitOfWork>;
  let userRepository: jest.Mocked<IUserRepository>;
  let outbox: jest.Mocked<IOutboxRepository>;
  let hashService: jest.Mocked<IHashService>;
  let logger: jest.Mocked<ILogger>;

  const input = { name: 'Maria Cliente', email: 'Maria@Example.com', cpf: '123.456.789-09' };

  beforeEach(() => {
    const mocks = createMockUnitOfWorkWithRepos();

    unitOfWork = mocks.unitOfWork;
    userRepository = mocks.repos.user as jest.Mocked<IUserRepository>;
    outbox = mocks.repos.outbox as jest.Mocked<IOutboxRepository>;
    hashService = createMockHashService();
    logger = createMockLogger();

    userRepository.findByCpf.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.create.mockImplementation((user) => Promise.resolve(user));

    useCase = new EnsureCustomerUserUseCase(unitOfWork, hashService, logger);
  });

  it('should create a user without role and add the customer_initial_password e-mail', async () => {
    const result = await useCase.execute(input);

    const generatedPassword = hashService.hash.mock.calls[0][0];
    const created = userRepository.create.mock.calls[0][0];

    expect(result).toEqual({ userId: created.id, created: true });
    expect(created.role).toBeNull();
    expect(created.cpf?.value).toBe('12345678909');
    expect(created.email.value).toBe('maria@example.com');
    expect(created.passwordHash).toBe('$2b$12$hashed');

    expect(userRepository.findByEmail).toHaveBeenCalledWith('maria@example.com');
    expect(userRepository.findByCpf).toHaveBeenCalledWith('12345678909');

    expect(outbox.add).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'notification.email.send',
        workOrderId: null,
        payload: expect.objectContaining({
          to: ['maria@example.com'],
          purpose: 'customer_initial_password',
          text: expect.stringContaining(generatedPassword),
        }),
      }),
    );

    expect(logger.event).toHaveBeenCalledWith(BUSINESS_EVENTS.CUSTOMER_USER_CREATED, {
      targetUserId: created.id,
    });
  });

  it('should return the CPF owner with created false and add no e-mail', async () => {
    const owner = createMockUser({ cpf: Cpf.create('12345678909') });
    userRepository.findByCpf.mockResolvedValue(owner);
    userRepository.findByEmail.mockResolvedValue(owner);

    const result = await useCase.execute(input);

    expect(result).toEqual({ userId: owner.id, created: false });
    expect(hashService.hash).not.toHaveBeenCalled();
    expect(userRepository.create).not.toHaveBeenCalled();
    expect(outbox.add).not.toHaveBeenCalled();
    expect(logger.event).not.toHaveBeenCalled();
  });

  it('should return the CPF owner when the e-mail belongs to nobody', async () => {
    const owner = createMockUser({ cpf: Cpf.create('12345678909') });
    userRepository.findByCpf.mockResolvedValue(owner);

    const result = await useCase.execute(input);

    expect(result).toEqual({ userId: owner.id, created: false });
    expect(outbox.add).not.toHaveBeenCalled();
  });

  it.each([
    ['the CPF exists with the e-mail of another user', true],
    ['a new CPF comes with the e-mail of another user', false],
  ])('should return 409 and write nothing when %s', async (_case, cpfExists) => {
    userRepository.findByCpf.mockResolvedValue(
      cpfExists ? createMockUser({ cpf: Cpf.create('12345678909') }) : null,
    );
    userRepository.findByEmail.mockResolvedValue(createMockUser());

    await expect(useCase.execute(input)).rejects.toThrow(
      new ResourceConflictException(
        'O e-mail informado já pertence a outro usuário. Verifique o cadastro do cliente',
      ),
    );

    expect(hashService.hash).not.toHaveBeenCalled();
    expect(userRepository.create).not.toHaveBeenCalled();
    expect(outbox.add).not.toHaveBeenCalled();
  });

  it('should reject an invalid CPF before touching the database', async () => {
    await expect(useCase.execute({ ...input, cpf: '123.456.789-00' })).rejects.toThrow(
      new DomainValidationException('CPF inválido'),
    );

    expect(unitOfWork.executeTransaction).not.toHaveBeenCalled();
  });

  it('should not add the e-mail nor log when the user insert fails', async () => {
    userRepository.create.mockRejectedValue(new Error('insert failed'));

    await expect(useCase.execute(input)).rejects.toThrow('insert failed');

    expect(outbox.add).not.toHaveBeenCalled();
    expect(logger.event).not.toHaveBeenCalled();
  });
});
