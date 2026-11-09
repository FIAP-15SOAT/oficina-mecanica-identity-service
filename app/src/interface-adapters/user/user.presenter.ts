import { UserPublicView } from '@domain/entities/user.entity';
import { PaginatedResult } from '@domain/interfaces/common/pagination.interface';
import { UserDataResponse, UserPaginatedResponse, UserResponse } from './responses/user.response';

export class UserPresenter {
  static toResponse(user: UserPublicView): UserResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  static toDataResponse(user: UserPublicView): UserDataResponse {
    return { data: UserPresenter.toResponse(user) };
  }

  static toPaginatedResponse(result: PaginatedResult<UserPublicView>): UserPaginatedResponse {
    return {
      data: result.items.map((u) => UserPresenter.toResponse(u)),
      pagination: result.pagination,
    };
  }
}
