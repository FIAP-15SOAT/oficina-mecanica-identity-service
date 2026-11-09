import { UserRole } from '@domain/enums/user-role.enum';
import { PaginationInput } from '@domain/interfaces/common/pagination.interface';

export interface FindAllUsersPaginatedInput extends PaginationInput {
  role?: UserRole;
  name?: string;
}
