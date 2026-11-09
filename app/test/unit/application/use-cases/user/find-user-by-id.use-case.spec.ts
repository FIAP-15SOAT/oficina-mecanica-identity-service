import { FindUserByIdUseCase } from '@application/use-cases/user/find-user-by-id.use-case';
import { ResourceNotFoundException } from '@application/exceptions/resource-not-found.exception';
import { identityCacheKeys } from '@application/keys/identity-cache-keys';
import { toCachedUser } from '@application/mappers/user-cache.mapper';
import { ICache } from '@application/ports/output/services/cache.service.interface';
import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';

import { createMockCache } from '../../../../helpers/cache-mock.factory';
import { createMockUser, createMockUserRepository } from '../../../../helpers/user-mock.factory';

describe('FindUserByIdUseCase', () => {
  let useCase: FindUserByIdUseCase;
  let userRepository: jest.Mocked<IUserRepository>;
  let cache: jest.Mocked<ICache>;

  beforeEach(() => {
    userRepository = createMockUserRepository();
    cache = createMockCache();

    useCase = new FindUserByIdUseCase(userRepository, cache);
  });

  it('should return the cached user without reading the repository', async () => {
    const view = createMockUser().toPublicView();
    cache.get.mockResolvedValue(toCachedUser(view));

    const result = await useCase.execute(view.id);

    expect(result).toEqual(view);
    expect(cache.get).toHaveBeenCalledWith(identityCacheKeys.user(view.id));
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  it('should read a corrupt cached value as a miss', async () => {
    const user = createMockUser();
    cache.get.mockResolvedValue('not-json');
    userRepository.findById.mockResolvedValue(user);

    const result = await useCase.execute(user.id);

    expect(result).toEqual(user.toPublicView());
    expect(cache.set).toHaveBeenCalledWith(
      identityCacheKeys.user(user.id),
      toCachedUser(user.toPublicView()),
    );
  });

  it('should read a cached value of another version as a miss', async () => {
    const user = createMockUser();
    cache.get.mockResolvedValue(
      JSON.stringify({ ...JSON.parse(toCachedUser(user.toPublicView())), cacheVersion: 0 }),
    );
    userRepository.findById.mockResolvedValue(user);

    const result = await useCase.execute(user.id);

    expect(result).toEqual(user.toPublicView());
    expect(userRepository.findById).toHaveBeenCalledWith(user.id);
  });

  it('should cache the user on a miss', async () => {
    const user = createMockUser();
    userRepository.findById.mockResolvedValue(user);

    const result = await useCase.execute(user.id);

    expect(result).toEqual(user.toPublicView());
    expect(cache.set).toHaveBeenCalledWith(
      identityCacheKeys.user(user.id),
      toCachedUser(user.toPublicView()),
    );
  });

  it('should not cache a missing user', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing-id')).rejects.toThrow(
      new ResourceNotFoundException('Usuário', 'missing-id'),
    );

    expect(cache.set).not.toHaveBeenCalled();
  });
});
