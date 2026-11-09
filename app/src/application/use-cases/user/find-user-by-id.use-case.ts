import { UserPublicView } from '@domain/entities/user.entity';
import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';

import { ResourceNotFoundException } from '@application/exceptions/resource-not-found.exception';
import { identityCacheKeys } from '@application/keys/identity-cache-keys';
import {
  CachedUser,
  USER_CACHE_VERSION,
  fromCachedUser,
  toCachedUser,
} from '@application/mappers/user-cache.mapper';
import { IFindUserByIdUseCase } from '@application/ports/input/user/find-user-by-id.use-case.interface';
import { ICache } from '@application/ports/output/services/cache.service.interface';

export class FindUserByIdUseCase implements IFindUserByIdUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly cache: ICache,
  ) {}

  async execute(id: string): Promise<UserPublicView> {
    const key = identityCacheKeys.user(id);
    const cached = await this.findCachedUser(key);

    if (cached) {
      return cached;
    }

    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new ResourceNotFoundException('Usuário', id);
    }

    const view = user.toPublicView();

    await this.cache.set(key, toCachedUser(view));

    return view;
  }

  private async findCachedUser(key: string): Promise<UserPublicView | null> {
    const value = await this.cache.get(key);

    return value === null ? null : this.parseCachedUser(value);
  }

  // A value this code cannot read (corrupted or written by another version) is a miss.
  private parseCachedUser(value: string): UserPublicView | null {
    try {
      const cached = JSON.parse(value) as CachedUser;

      return cached.cacheVersion === USER_CACHE_VERSION ? fromCachedUser(cached) : null;
    } catch {
      return null;
    }
  }
}
