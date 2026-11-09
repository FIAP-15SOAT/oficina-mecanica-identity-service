import { IUnitOfWork, IRepositories } from '@domain/interfaces/repositories/unit-of-work.interface';
import { createMockOutboxRepository } from './outbox-mock.factory';
import { createMockUserRepository } from './user-mock.factory';

export function createMockRepositories(): jest.Mocked<IRepositories> {
  return {
    outbox: createMockOutboxRepository(),
    user: createMockUserRepository(),
  };
}

export function createMockUnitOfWork(): jest.Mocked<IUnitOfWork> {
  const repos = createMockRepositories();
  return {
    executeTransaction: jest
      .fn()
      .mockImplementation((work: (repos: IRepositories) => Promise<unknown>) => work(repos)),
  };
}

export function createMockUnitOfWorkWithRepos(): {
  unitOfWork: jest.Mocked<IUnitOfWork>;
  repos: jest.Mocked<IRepositories>;
} {
  const repos = createMockRepositories();
  const unitOfWork: jest.Mocked<IUnitOfWork> = {
    executeTransaction: jest
      .fn()
      .mockImplementation((work: (repos: IRepositories) => Promise<unknown>) => work(repos)),
  };
  return { unitOfWork, repos };
}
