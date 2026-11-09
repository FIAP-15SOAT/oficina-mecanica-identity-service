import { UpdateUserStatusUseCase } from '@application/use-cases/user/update-user-status.use-case';
import { ResourceNotFoundException } from '@application/exceptions/resource-not-found.exception';
import { identityCacheKeys } from '@application/keys/identity-cache-keys';
import { BUSINESS_EVENTS } from '@application/logging/business-event.catalog';
import { ICache } from '@application/ports/output/services/cache.service.interface';
import { ILogger } from '@application/ports/output/services/logger.service.interface';
import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';

import { createMockCache } from '../../../../helpers/cache-mock.factory';
import { createMockLogger } from '../../../../helpers/logger-mock.factory';
import { createMockUser, createMockUserRepository } from '../../../../helpers/user-mock.factory';

describe('UpdateUserStatusUseCase', () => {
  let useCase: UpdateUserStatusUseCase;
  let userRepository: jest.Mocked<IUserRepository>;
  let cache: jest.Mocked<ICache>;
  let logger: jest.Mocked<ILogger>;

  beforeEach(() => {
    userRepository = createMockUserRepository();
    cache = createMockCache();
    logger = createMockLogger();

    userRepository.update.mockImplementation((user) => Promise.resolve(user));

    useCase = new UpdateUserStatusUseCase(userRepository, cache, logger);
  });

  it('should deactivate the user and log the status change', async () => {
    const user = createMockUser({ isActive: true });
    userRepository.findById.mockResolvedValue(user);

    const result = await useCase.execute(user.id, false);

    expect(result.isActive).toBe(false);
    expect(logger.event).toHaveBeenCalledWith(BUSINESS_EVENTS.USER_STATUS_UPDATED, {
      targetUserId: user.id,
      targetUserActive: false,
    });
  });

  it('should activate the user', async () => {
    const user = createMockUser({ isActive: false });
    userRepository.findById.mockResolvedValue(user);

    const result = await useCase.execute(user.id, true);

    expect(result.isActive).toBe(true);
  });

  it('should delete the user cache key after the update', async () => {
    const user = createMockUser({ isActive: true });
    userRepository.findById.mockResolvedValue(user);

    await useCase.execute(user.id, false);

    expect(cache.delete).toHaveBeenCalledWith([identityCacheKeys.user(user.id)]);
    expect(cache.delete.mock.invocationCallOrder[0]).toBeGreaterThan(
      userRepository.update.mock.invocationCallOrder[0],
    );
  });

  it('should throw when the user does not exist', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing-id', true)).rejects.toThrow(
      new ResourceNotFoundException('Usuário', 'missing-id'),
    );

    expect(cache.delete).not.toHaveBeenCalled();
  });
});
