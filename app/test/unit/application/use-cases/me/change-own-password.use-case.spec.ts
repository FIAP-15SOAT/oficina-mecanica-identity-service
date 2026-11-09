import { ChangeOwnPasswordUseCase } from '@application/use-cases/me/change-own-password.use-case';
import { ResourceNotFoundException } from '@application/exceptions/resource-not-found.exception';
import { UnauthorizedAccessException } from '@application/exceptions/unauthorized-access.exception';
import { identityCacheKeys } from '@application/keys/identity-cache-keys';
import { BUSINESS_EVENTS } from '@application/logging/business-event.catalog';
import { ICache } from '@application/ports/output/services/cache.service.interface';
import { IHashService } from '@application/ports/output/services/hash.service.interface';
import { ILogger } from '@application/ports/output/services/logger.service.interface';
import { BusinessRuleViolationException } from '@domain/exceptions/business-rule-violation.exception';
import { DomainValidationException } from '@domain/exceptions/domain-validation.exception';
import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';

import { createMockCache } from '../../../../helpers/cache-mock.factory';
import { createMockHashService } from '../../../../helpers/hash-mock.factory';
import { createMockLogger } from '../../../../helpers/logger-mock.factory';
import { createMockUser, createMockUserRepository } from '../../../../helpers/user-mock.factory';

const INPUT = { currentPassword: 'CurrentPass@123', newPassword: 'NewPass@456' };

describe('ChangeOwnPasswordUseCase', () => {
  let useCase: ChangeOwnPasswordUseCase;
  let userRepository: jest.Mocked<IUserRepository>;
  let hashService: jest.Mocked<IHashService>;
  let cache: jest.Mocked<ICache>;
  let logger: jest.Mocked<ILogger>;

  beforeEach(() => {
    userRepository = createMockUserRepository();

    hashService = createMockHashService();

    cache = createMockCache();

    logger = createMockLogger();

    userRepository.update.mockImplementation((user) => Promise.resolve(user));

    useCase = new ChangeOwnPasswordUseCase(userRepository, hashService, cache, logger);
  });

  it('should change the password when the current one matches', async () => {
    const user = createMockUser({ passwordHash: 'current-hash' });
    userRepository.findById.mockResolvedValue(user);
    hashService.hash.mockResolvedValue('new-hash');

    await useCase.execute(user.id, INPUT);

    expect(hashService.compare).toHaveBeenCalledWith(INPUT.currentPassword, 'current-hash');
    expect(hashService.hash).toHaveBeenCalledWith(INPUT.newPassword);

    expect(userRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'new-hash' }),
    );

    expect(logger.event).toHaveBeenCalledWith(BUSINESS_EVENTS.USER_PASSWORD_CHANGED, {
      subjectId: user.id,
    });
  });

  it('should record when the password changed', async () => {
    const user = createMockUser({ passwordChangedAt: new Date(0) });
    userRepository.findById.mockResolvedValue(user);

    await useCase.execute(user.id, INPUT);

    expect(user.passwordChangedAt.getTime()).toBeGreaterThan(0);
  });

  it('should delete the user cache key', async () => {
    const user = createMockUser();
    userRepository.findById.mockResolvedValue(user);

    await useCase.execute(user.id, INPUT);

    expect(cache.delete).toHaveBeenCalledWith([identityCacheKeys.user(user.id)]);

    expect(cache.delete.mock.invocationCallOrder[0]).toBeGreaterThan(
      userRepository.update.mock.invocationCallOrder[0],
    );
  });

  it('should throw 401 when the current password does not match', async () => {
    userRepository.findById.mockResolvedValue(createMockUser());
    hashService.compare.mockResolvedValue(false);

    await expect(
      useCase.execute('user-id', { ...INPUT, currentPassword: 'Wrong@123' }),
    ).rejects.toThrow(new UnauthorizedAccessException('Senha atual incorreta'));

    expect(userRepository.update).not.toHaveBeenCalled();
    expect(cache.delete).not.toHaveBeenCalled();
  });

  it('should throw 409 when the new password equals the current one', async () => {
    userRepository.findById.mockResolvedValue(createMockUser());

    await expect(
      useCase.execute('user-id', { ...INPUT, newPassword: INPUT.currentPassword }),
    ).rejects.toThrow(
      new BusinessRuleViolationException('A nova senha não pode ser igual à senha atual'),
    );

    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('should reject a new password that does not meet the strength policy', async () => {
    userRepository.findById.mockResolvedValue(createMockUser());

    await expect(useCase.execute('user-id', { ...INPUT, newPassword: 'weak' })).rejects.toThrow(
      DomainValidationException,
    );

    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('should throw ResourceNotFoundException when the authenticated user no longer exists', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('deleted-id', INPUT)).rejects.toThrow(
      new ResourceNotFoundException('Usuário', 'deleted-id'),
    );

    expect(hashService.compare).not.toHaveBeenCalled();
  });
});
