import { User } from '@domain/entities/user.entity';
import { UserRole } from '@domain/enums/user-role.enum';
import {
  PaginatedRepositoryResult,
  PaginationInput,
} from '@domain/interfaces/common/pagination.interface';

export interface UserFilters {
  role?: UserRole;
  name?: string;
}

export interface IUserRepository {
  create(user: User): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByCpf(cpf: string): Promise<User | null>;
  findAllPaginated(
    pagination: PaginationInput,
    filters?: UserFilters,
  ): Promise<PaginatedRepositoryResult<User>>;
  update(user: User): Promise<User>;
  delete(id: string): Promise<void>;
}
