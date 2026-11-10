import { PaginationQuery } from '@domain/interfaces/common/pagination.interface';
import { UserRole } from '@domain/enums/user-role.enum';

export interface FindAllUsersQuery extends PaginationQuery {
  role?: UserRole;
  name?: string;
}
