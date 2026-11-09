import { ICreateUserUseCase } from '@application/ports/input/user/create-user.use-case.interface';
import { IFindUserByIdUseCase } from '@application/ports/input/user/find-user-by-id.use-case.interface';
import { IFindAllUsersUseCase } from '@application/ports/input/user/find-all-users.use-case.interface';
import { IUpdateUserUseCase } from '@application/ports/input/user/update-user.use-case.interface';
import { IUpdateUserStatusUseCase } from '@application/ports/input/user/update-user-status.use-case.interface';
import { IDeleteUserUseCase } from '@application/ports/input/user/delete-user.use-case.interface';

import { CreateUserRequest } from './requests/create-user-request';
import { UpdateUserRequest } from './requests/update-user-request';
import { UpdateUserStatusRequest } from './requests/update-user-status-request';
import { FindAllUsersQuery } from './requests/find-all-users-query';

import { UserPresenter } from './user.presenter';
import { UserDataResponse, UserPaginatedResponse } from './responses/user.response';

export class UserController {
  constructor(
    private readonly createUserUseCase: ICreateUserUseCase,
    private readonly findUserByIdUseCase: IFindUserByIdUseCase,
    private readonly findAllUsersUseCase: IFindAllUsersUseCase,
    private readonly updateUserUseCase: IUpdateUserUseCase,
    private readonly updateUserStatusUseCase: IUpdateUserStatusUseCase,
    private readonly deleteUserUseCase: IDeleteUserUseCase,
  ) {}

  async create(input: CreateUserRequest): Promise<UserDataResponse> {
    const user = await this.createUserUseCase.execute(input);
    return UserPresenter.toDataResponse(user);
  }

  async findAll(query: FindAllUsersQuery): Promise<UserPaginatedResponse> {
    const result = await this.findAllUsersUseCase.execute({
      ...query,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    });

    return UserPresenter.toPaginatedResponse(result);
  }

  async findById(id: string): Promise<UserDataResponse> {
    const user = await this.findUserByIdUseCase.execute(id);
    return UserPresenter.toDataResponse(user);
  }

  async update(id: string, input: UpdateUserRequest): Promise<UserDataResponse> {
    const user = await this.updateUserUseCase.execute(id, input);
    return UserPresenter.toDataResponse(user);
  }

  async updateStatus(id: string, input: UpdateUserStatusRequest): Promise<UserDataResponse> {
    const user = await this.updateUserStatusUseCase.execute(id, input.active);
    return UserPresenter.toDataResponse(user);
  }

  async remove(id: string): Promise<void> {
    await this.deleteUserUseCase.execute(id);
  }
}
