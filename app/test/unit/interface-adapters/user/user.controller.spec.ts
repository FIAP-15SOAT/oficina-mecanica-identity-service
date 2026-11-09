import { randomUUID } from 'node:crypto';

import { UserController } from '@interface-adapters/user/user.controller';
import { UserPresenter } from '@interface-adapters/user/user.presenter';

import { CreateUserRequest } from '@interface-adapters/user/requests/create-user-request';
import { UpdateUserRequest } from '@interface-adapters/user/requests/update-user-request';

import { UserRole } from '@domain/enums/user-role.enum';
import { Email } from '@domain/value-objects/email.vo';

import { ICreateUserUseCase } from '@application/ports/input/user/create-user.use-case.interface';
import { IFindUserByIdUseCase } from '@application/ports/input/user/find-user-by-id.use-case.interface';
import { IFindAllUsersUseCase } from '@application/ports/input/user/find-all-users.use-case.interface';
import { IUpdateUserUseCase } from '@application/ports/input/user/update-user.use-case.interface';
import { IUpdateUserStatusUseCase } from '@application/ports/input/user/update-user-status.use-case.interface';
import { IDeleteUserUseCase } from '@application/ports/input/user/delete-user.use-case.interface';

import { createMockUser } from '../../../helpers/user-mock.factory';

describe('UserController', () => {
  let controller: UserController;
  let createUserUseCase: jest.Mocked<ICreateUserUseCase>;
  let findUserByIdUseCase: jest.Mocked<IFindUserByIdUseCase>;
  let findAllUsersUseCase: jest.Mocked<IFindAllUsersUseCase>;
  let updateUserUseCase: jest.Mocked<IUpdateUserUseCase>;
  let updateUserStatusUseCase: jest.Mocked<IUpdateUserStatusUseCase>;
  let deleteUserUseCase: jest.Mocked<IDeleteUserUseCase>;

  beforeEach(() => {
    createUserUseCase = { execute: jest.fn() };
    findUserByIdUseCase = { execute: jest.fn() };
    findAllUsersUseCase = { execute: jest.fn() };
    updateUserUseCase = { execute: jest.fn() };
    updateUserStatusUseCase = { execute: jest.fn() };
    deleteUserUseCase = { execute: jest.fn() };

    controller = new UserController(
      createUserUseCase,
      findUserByIdUseCase,
      findAllUsersUseCase,
      updateUserUseCase,
      updateUserStatusUseCase,
      deleteUserUseCase,
    );
  });

  describe('create', () => {
    it('should create a user successfully', async () => {
      const request: CreateUserRequest = {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        role: UserRole.MECHANIC,
      };

      const createdUser = createMockUser({
        name: request.name,
        email: Email.create(request.email),
        role: request.role,
      });

      createUserUseCase.execute.mockResolvedValue(createdUser.toPublicView());

      const result = await controller.create(request);

      expect(result).toEqual(UserPresenter.toDataResponse(createdUser.toPublicView()));
      expect(createUserUseCase.execute).toHaveBeenCalledWith(request);
    });
  });

  describe('findAll', () => {
    it('should return paginated list of users', async () => {
      const users = [
        createMockUser({ id: randomUUID(), name: 'User 1' }),
        createMockUser({ id: randomUUID(), name: 'User 2' }),
      ];

      const usersPublicView = users.map((u) => u.toPublicView());

      const paginatedResult = {
        items: usersPublicView,
        pagination: { totalRecords: 2, totalPages: 1, page: 1, limit: 10 },
      };

      findAllUsersUseCase.execute.mockResolvedValue(paginatedResult);

      const result = await controller.findAll({ page: 1, limit: 10 });

      expect(result).toEqual(UserPresenter.toPaginatedResponse(paginatedResult));
      expect(findAllUsersUseCase.execute).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });

    it('should use default pagination when not provided', async () => {
      const paginatedResult = {
        items: [],
        pagination: { totalRecords: 0, totalPages: 0, page: 1, limit: 10 },
      };

      findAllUsersUseCase.execute.mockResolvedValue(paginatedResult);

      const result = await controller.findAll({});

      expect(result).toEqual(UserPresenter.toPaginatedResponse(paginatedResult));
      expect(findAllUsersUseCase.execute).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });
  });

  describe('findById', () => {
    it('should return a user by id', async () => {
      const id = randomUUID();
      const user = createMockUser({ id });

      findUserByIdUseCase.execute.mockResolvedValue(user.toPublicView());

      const result = await controller.findById(id);

      expect(result).toEqual(UserPresenter.toDataResponse(user.toPublicView()));
      expect(findUserByIdUseCase.execute).toHaveBeenCalledWith(id);
    });
  });

  describe('update', () => {
    it('should update a user successfully', async () => {
      const id = randomUUID();

      const request: UpdateUserRequest = {
        name: 'Updated Name',
        email: 'updated@example.com',
      };

      const updatedUser = createMockUser({
        id,
        name: request.name,
        email: Email.create(request.email!),
      });

      updateUserUseCase.execute.mockResolvedValue(updatedUser.toPublicView());

      const result = await controller.update(id, request);

      expect(result).toEqual(UserPresenter.toDataResponse(updatedUser.toPublicView()));
      expect(updateUserUseCase.execute).toHaveBeenCalledWith(id, request);
    });
  });

  describe('updateStatus', () => {
    it('should update user status to inactive', async () => {
      const id = randomUUID();
      const updatedUser = createMockUser({ id, isActive: false });

      updateUserStatusUseCase.execute.mockResolvedValue(updatedUser.toPublicView());

      const result = await controller.updateStatus(id, { active: false });

      expect(result).toEqual(UserPresenter.toDataResponse(updatedUser.toPublicView()));
      expect(updateUserStatusUseCase.execute).toHaveBeenCalledWith(id, false);
    });

    it('should update user status to active', async () => {
      const id = randomUUID();
      const updatedUser = createMockUser({ id, isActive: true });

      updateUserStatusUseCase.execute.mockResolvedValue(updatedUser.toPublicView());

      const result = await controller.updateStatus(id, { active: true });

      expect(result).toEqual(UserPresenter.toDataResponse(updatedUser.toPublicView()));
      expect(updateUserStatusUseCase.execute).toHaveBeenCalledWith(id, true);
    });
  });

  describe('remove', () => {
    it('should call the delete use case with the correct id', async () => {
      const id = randomUUID();

      deleteUserUseCase.execute.mockResolvedValue(undefined);

      await controller.remove(id);

      expect(deleteUserUseCase.execute).toHaveBeenCalledWith(id);
    });
  });
});
