import { ResourceNotFoundException } from '@application/exceptions/resource-not-found.exception';
import { BUSINESS_EVENTS } from '@application/logging/business-event.catalog';
import { ILogger } from '@application/ports/output/services/logger.service.interface';
import { IHashService } from '@application/ports/output/services/hash.service.interface';
import { IPasswordResetCodeStore } from '@application/ports/output/stores/password-reset-code-store.interface';
import { IssuePasswordResetCodeUseCase } from '@application/use-cases/auth/issue-password-reset-code.use-case';
import { IUnitOfWork } from '@domain/interfaces/repositories/unit-of-work.interface';
import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';
import { IOutboxRepository } from '@domain/interfaces/repositories/outbox.repository.interface';
import { ServiceIntegrationException } from '@infrastructure/exceptions/service-integration.exception';

import { createMockHashService } from '../../../../helpers/hash-mock.factory';
import { createMockLogger } from '../../../../helpers/logger-mock.factory';
import { createMockPasswordResetCodeStore } from '../../../../helpers/password-reset-code-store-mock.factory';
import { createMockUnitOfWorkWithRepos } from '../../../../helpers/unit-of-work-mock.factory';
import { createMockUser } from '../../../../helpers/user-mock.factory';

describe('IssuePasswordResetCodeUseCase', () => {
  let useCase: IssuePasswordResetCodeUseCase;
  let userRepository: jest.Mocked<IUserRepository>;
  let outbox: jest.Mocked<IOutboxRepository>;
  let unitOfWork: jest.Mocked<IUnitOfWork>;
  let passwordResetCodeStore: jest.Mocked<IPasswordResetCodeStore>;
  let hashService: jest.Mocked<IHashService>;
  let logger: jest.Mocked<ILogger>;

  beforeEach(() => {
    const mocks = createMockUnitOfWorkWithRepos();

    unitOfWork = mocks.unitOfWork;
    userRepository = mocks.repos.user as jest.Mocked<IUserRepository>;
    outbox = mocks.repos.outbox as jest.Mocked<IOutboxRepository>;
    passwordResetCodeStore = createMockPasswordResetCodeStore();
    hashService = createMockHashService();
    logger = createMockLogger();

    useCase = new IssuePasswordResetCodeUseCase(
      userRepository,
      passwordResetCodeStore,
      hashService,
      unitOfWork,
      logger,
    );
  });

  it('should save the code hash before adding the e-mail to the outbox', async () => {
    const user = createMockUser();
    userRepository.findById.mockResolvedValue(user);
    hashService.hash.mockResolvedValue('hashed-code');

    await useCase.execute(user.id, 'admin-id');

    expect(passwordResetCodeStore.save).toHaveBeenCalledWith(user.id, 'hashed-code');
    expect(passwordResetCodeStore.save.mock.invocationCallOrder[0]).toBeLessThan(
      outbox.add.mock.invocationCallOrder[0],
    );
  });

  it('should add the password_reset_code e-mail', async () => {
    const user = createMockUser();
    userRepository.findById.mockResolvedValue(user);

    await useCase.execute(user.id, 'admin-id');

    const plainCode = hashService.hash.mock.calls[0][0];

    expect(plainCode).toMatch(/^\d{6}$/);
    expect(outbox.add).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'notification.email.send',
        workOrderId: null,
        payload: expect.objectContaining({
          to: [user.email.value],
          purpose: 'password_reset_code',
          text: expect.stringContaining(plainCode),
        }),
      }),
    );
  });

  it('should not add the e-mail when the store fails', async () => {
    const user = createMockUser();
    userRepository.findById.mockResolvedValue(user);
    passwordResetCodeStore.save.mockRejectedValue(new ServiceIntegrationException('valkey down'));

    await expect(useCase.execute(user.id, 'admin-id')).rejects.toThrow(ServiceIntegrationException);

    expect(outbox.add).not.toHaveBeenCalled();
    expect(logger.event).not.toHaveBeenCalled();
  });

  it('should throw ResourceNotFoundException when the user does not exist', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing-id', 'admin-id')).rejects.toThrow(
      ResourceNotFoundException,
    );

    expect(passwordResetCodeStore.save).not.toHaveBeenCalled();
    expect(outbox.add).not.toHaveBeenCalled();
  });

  it('should log the issue event without the code', async () => {
    const user = createMockUser();
    userRepository.findById.mockResolvedValue(user);

    await useCase.execute(user.id, 'admin-id');

    const plainCode = hashService.hash.mock.calls[0][0];

    expect(logger.event).toHaveBeenCalledWith(BUSINESS_EVENTS.USER_PASSWORD_RESET_ISSUED, {
      subjectId: 'admin-id',
      targetUserId: user.id,
    });
    expect(JSON.stringify(logger.event.mock.calls)).not.toContain(plainCode);
  });
});
