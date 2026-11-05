import { IOutboxRepository } from './outbox.repository.interface';

export interface IRepositories {
  outbox: IOutboxRepository;
}

export interface IUnitOfWork {
  executeTransaction<T>(work: (repositories: IRepositories) => Promise<T>): Promise<T>;
}
