import { UserPublicView } from '@domain/entities/user.entity';
import { PaginatedResult } from '@domain/interfaces/common/pagination.interface';
import {
  InternalCustomerAuthenticationDataResponse,
  InternalCustomerUserDataResponse,
  InternalUserDataResponse,
} from './responses/internal-user.response';
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

  static toInternalDataResponse(user: UserPublicView): InternalUserDataResponse {
    return {
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    };
  }

  static toCustomerUserDataResponse(output: {
    userId: string;
    created: boolean;
  }): InternalCustomerUserDataResponse {
    return { data: { userId: output.userId, created: output.created } };
  }

  static toCustomerAuthenticationDataResponse(output: {
    userId: string;
  }): InternalCustomerAuthenticationDataResponse {
    return { data: { userId: output.userId } };
  }

  static toPaginatedResponse(result: PaginatedResult<UserPublicView>): UserPaginatedResponse {
    return {
      data: result.items.map((u) => UserPresenter.toResponse(u)),
      pagination: result.pagination,
    };
  }
}
