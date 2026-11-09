import { randomUUID } from 'node:crypto';

import { UserController } from '@infrastructure/http/controllers/user/user.controller';

import { UserController as UserCleanController } from '@interface-adapters/user/user.controller';
import { UserPresenter } from '@interface-adapters/user/user.presenter';

import { CreateUserRequestDto } from '@infrastructure/http/controllers/user/dto/requests/create-user-request.dto';
import { UpdateUserRequestDto } from '@infrastructure/http/controllers/user/dto/requests/update-user-request.dto';
import { UpdateUserStatusRequestDto } from '@infrastructure/http/controllers/user/dto/requests/update-user-status-request.dto';
import { FindAllUsersQueryDto } from '@infrastructure/http/controllers/user/dto/requests/filter-users.dto';

import { UserRole } from '@domain/enums/user-role.enum';

import { createMockUser } from '../../../../../helpers/user-mock.factory';

describe('UserController', () => {
  let httpController: UserController;
  let cleanController: UserCleanController;

  const userRequestStub: CreateUserRequestDto = {
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    role: UserRole.MECHANIC,
  };

  beforeEach(() => {
    cleanController = new UserCleanController(
      { execute: jest.fn() },
      { execute: jest.fn() },
      { execute: jest.fn() },
      { execute: jest.fn() },
      { execute: jest.fn() },
      { execute: jest.fn() },
    );
    httpController = new UserController(cleanController);
  });

  describe('create', () => {
    it('should delegate to the clean controller and return its result', async () => {
      const response = UserPresenter.toDataResponse(createMockUser().toPublicView());

      jest.spyOn(cleanController, 'create').mockResolvedValue(response);

      const result = await httpController.create(userRequestStub);

      expect(result).toBe(response);
      expect(cleanController.create).toHaveBeenCalledWith(userRequestStub);
    });
  });

  describe('findAll', () => {
    it('should pass the query straight to the clean controller and return its result', async () => {
      const query: FindAllUsersQueryDto = { page: 1, limit: 10, role: UserRole.MECHANIC };

      const response = UserPresenter.toPaginatedResponse({
        items: [createMockUser().toPublicView()],
        pagination: { totalRecords: 1, totalPages: 1, page: 1, limit: 10 },
      });

      jest.spyOn(cleanController, 'findAll').mockResolvedValue(response);

      const result = await httpController.findAll(query);

      expect(result).toBe(response);
      expect(cleanController.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findById', () => {
    it('should delegate to the clean controller and return its result', async () => {
      const user = createMockUser();
      const response = UserPresenter.toDataResponse(user.toPublicView());

      jest.spyOn(cleanController, 'findById').mockResolvedValue(response);

      const result = await httpController.findById(user.id);

      expect(result).toBe(response);
      expect(cleanController.findById).toHaveBeenCalledWith(user.id);
    });
  });

  describe('update', () => {
    it('should delegate to the clean controller and return its result', async () => {
      const id = randomUUID();
      const updateRequestStub: UpdateUserRequestDto = { name: 'Updated Name' };

      const response = UserPresenter.toDataResponse(
        createMockUser({ name: 'Updated Name' }).toPublicView(),
      );

      jest.spyOn(cleanController, 'update').mockResolvedValue(response);

      const result = await httpController.update(id, updateRequestStub);

      expect(result).toBe(response);
      expect(cleanController.update).toHaveBeenCalledWith(id, updateRequestStub);
    });
  });

  describe('updateStatus', () => {
    it('should delegate to the clean controller and return its result', async () => {
      const id = randomUUID();
      const statusRequestStub: UpdateUserStatusRequestDto = { active: false };

      const response = UserPresenter.toDataResponse(
        createMockUser({ isActive: false }).toPublicView(),
      );

      jest.spyOn(cleanController, 'updateStatus').mockResolvedValue(response);

      const result = await httpController.updateStatus(id, statusRequestStub);

      expect(result).toBe(response);
      expect(cleanController.updateStatus).toHaveBeenCalledWith(id, statusRequestStub);
    });
  });

  describe('remove', () => {
    it('should delegate to the clean controller', async () => {
      const id = randomUUID();

      jest.spyOn(cleanController, 'remove').mockResolvedValue(undefined);

      await httpController.remove(id);

      expect(cleanController.remove).toHaveBeenCalledWith(id);
    });
  });
});
