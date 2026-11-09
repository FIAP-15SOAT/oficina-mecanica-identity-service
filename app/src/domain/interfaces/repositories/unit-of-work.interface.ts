import { IOutboxRepository } from './outbox.repository.interface';
import { IUserRepository } from './user.repository.interface';

export interface IRepositories {
  outbox: IOutboxRepository;
  user: IUserRepository;
}

export interface IUnitOfWork {
  executeTransaction<T>(work: (repositories: IRepositories) => Promise<T>): Promise<T>;
}
