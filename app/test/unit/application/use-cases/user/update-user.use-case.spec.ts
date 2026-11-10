import { UpdateUserUseCase } from '@application/use-cases/user/update-user.use-case';
import { ResourceConflictException } from '@application/exceptions/resource-conflict.exception';
import { ResourceNotFoundException } from '@application/exceptions/resource-not-found.exception';
import { identityCacheKeys } from '@application/keys/identity-cache-keys';
import { ICache } from '@application/ports/output/services/cache.service.interface';
import { UserRole } from '@domain/enums/user-role.enum';
import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';
import { Email } from '@domain/value-objects/email.vo';

import { createMockCache } from '../../../../helpers/cache-mock.factory';
import { createMockUser, createMockUserRepository } from '../../../../helpers/user-mock.factory';

describe('UpdateUserUseCase', () => {
  let useCase: UpdateUserUseCase;
  let userRepository: jest.Mocked<IUserRepository>;
  let cache: jest.Mocked<ICache>;

  beforeEach(() => {
    userRepository = createMockUserRepository();
    cache = createMockCache();

    userRepository.update.mockImplementation((user) => Promise.resolve(user));

    useCase = new UpdateUserUseCase(userRepository, cache);
  });

  it('should update the name', async () => {
    const user = createMockUser();
    userRepository.findById.mockResolvedValue(user);

    const result = await useCase.execute(user.id, { name: 'Novo Nome' });

    expect(result.name).toBe('Novo Nome');
  });

  it('should update the role', async () => {
    const user = createMockUser({ role: UserRole.ATTENDANT });
    userRepository.findById.mockResolvedValue(user);

    const result = await useCase.execute(user.id, { role: UserRole.MECHANIC });

    expect(result.role).toBe(UserRole.MECHANIC);
  });

  it('should update the e-mail after checking it is free', async () => {
    const user = createMockUser({ email: Email.create('antigo@email.com') });
    userRepository.findById.mockResolvedValue(user);
    userRepository.findByEmail.mockResolvedValue(null);

    const result = await useCase.execute(user.id, { email: 'novo@email.com' });

    expect(result.email).toBe('novo@email.com');
    expect(userRepository.findByEmail).toHaveBeenCalledWith('novo@email.com');
  });

  it('should not check the e-mail when it does not change', async () => {
    const user = createMockUser({ email: Email.create('admin@email.com') });
    userRepository.findById.mockResolvedValue(user);

    await useCase.execute(user.id, { email: 'admin@email.com' });

    expect(userRepository.findByEmail).not.toHaveBeenCalled();
  });

  it('should throw a conflict when the new e-mail belongs to another user', async () => {
    const user = createMockUser({ email: Email.create('antigo@email.com') });
    userRepository.findById.mockResolvedValue(user);
    userRepository.findByEmail.mockResolvedValue(createMockUser());

    await expect(useCase.execute(user.id, { email: 'existente@email.com' })).rejects.toThrow(
      new ResourceConflictException('E-mail já cadastrado no sistema'),
    );

    expect(userRepository.update).not.toHaveBeenCalled();
    expect(cache.delete).not.toHaveBeenCalled();
  });

  it('should delete the user cache key after the update', async () => {
    const user = createMockUser();
    userRepository.findById.mockResolvedValue(user);

    await useCase.execute(user.id, { name: 'Novo Nome' });

    expect(cache.delete).toHaveBeenCalledWith([identityCacheKeys.user(user.id)]);
    expect(cache.delete.mock.invocationCallOrder[0]).toBeGreaterThan(
      userRepository.update.mock.invocationCallOrder[0],
    );
  });

  it('should throw when the user does not exist', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing-id', { name: 'Novo Nome' })).rejects.toThrow(
      new ResourceNotFoundException('Usuário', 'missing-id'),
    );
  });
});
