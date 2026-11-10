import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';
import { IDeleteUserUseCase } from '@application/ports/input/user/delete-user.use-case.interface';
import { ICache } from '@application/ports/output/services/cache.service.interface';
import { identityCacheKeys } from '@application/keys/identity-cache-keys';
import { ResourceNotFoundException } from '@application/exceptions/resource-not-found.exception';

export class DeleteUserUseCase implements IDeleteUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly cache: ICache,
  ) {}

  async execute(id: string): Promise<void> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new ResourceNotFoundException('Usuário', id);
    }

    await this.userRepository.delete(id);
    await this.cache.delete([identityCacheKeys.user(id)]);
  }
}
