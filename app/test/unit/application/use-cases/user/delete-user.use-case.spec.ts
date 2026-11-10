import { DeleteUserUseCase } from '@application/use-cases/user/delete-user.use-case';
import { ResourceNotFoundException } from '@application/exceptions/resource-not-found.exception';
import { identityCacheKeys } from '@application/keys/identity-cache-keys';
import { ICache } from '@application/ports/output/services/cache.service.interface';
import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';

import { createMockCache } from '../../../../helpers/cache-mock.factory';
import { createMockUser, createMockUserRepository } from '../../../../helpers/user-mock.factory';

describe('DeleteUserUseCase', () => {
  let useCase: DeleteUserUseCase;
  let userRepository: jest.Mocked<IUserRepository>;
  let cache: jest.Mocked<ICache>;

  beforeEach(() => {
    userRepository = createMockUserRepository();
    cache = createMockCache();

    useCase = new DeleteUserUseCase(userRepository, cache);
  });

  it('should delete the user cache key after the delete', async () => {
    const user = createMockUser();
    userRepository.findById.mockResolvedValue(user);

    await useCase.execute(user.id);

    expect(userRepository.delete).toHaveBeenCalledWith(user.id);
    expect(cache.delete).toHaveBeenCalledWith([identityCacheKeys.user(user.id)]);
    expect(cache.delete.mock.invocationCallOrder[0]).toBeGreaterThan(
      userRepository.delete.mock.invocationCallOrder[0],
    );
  });

  it('should throw when the user does not exist', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing-id')).rejects.toThrow(
      new ResourceNotFoundException('Usuário', 'missing-id'),
    );

    expect(userRepository.delete).not.toHaveBeenCalled();
    expect(cache.delete).not.toHaveBeenCalled();
  });
});
