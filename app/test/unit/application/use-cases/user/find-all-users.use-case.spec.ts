import { FindAllUsersUseCase } from '@application/use-cases/user/find-all-users.use-case';
import { UserRole } from '@domain/enums/user-role.enum';
import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';

import { createMockUser, createMockUserRepository } from '../../../../helpers/user-mock.factory';

describe('FindAllUsersUseCase', () => {
  let useCase: FindAllUsersUseCase;
  let userRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    userRepository = createMockUserRepository();

    useCase = new FindAllUsersUseCase(userRepository);
  });

  it('should return the public views with the pagination metadata', async () => {
    const users = [createMockUser(), createMockUser()];
    userRepository.findAllPaginated.mockResolvedValue({ items: users, total: 25 });

    const result = await useCase.execute({ page: 2, limit: 10 });

    expect(result.items).toEqual(users.map((user) => user.toPublicView()));
    expect(result.pagination).toEqual({ totalRecords: 25, totalPages: 3, page: 2, limit: 10 });
  });

  it('should pass the filters apart from the pagination to the repository', async () => {
    userRepository.findAllPaginated.mockResolvedValue({ items: [], total: 0 });

    await useCase.execute({ page: 1, limit: 10, role: UserRole.MECHANIC, name: 'Ana' });

    expect(userRepository.findAllPaginated).toHaveBeenCalledWith(
      { page: 1, limit: 10 },
      { role: UserRole.MECHANIC, name: 'Ana' },
    );
  });
});
