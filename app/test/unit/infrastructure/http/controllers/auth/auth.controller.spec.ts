import { randomUUID } from 'node:crypto';

import { AuthController } from '@infrastructure/http/controllers/auth/auth.controller';

import { AuthController as AuthCleanController } from '@interface-adapters/auth/auth.controller';
import { AuthPresenter } from '@interface-adapters/auth/auth.presenter';

import { LoginRequestDto } from '@infrastructure/http/controllers/auth/dto/requests/login-request.dto';
import { RefreshTokenRequestDto } from '@infrastructure/http/controllers/auth/dto/requests/refresh-token-request.dto';
import { ConfirmPasswordResetRequestDto } from '@infrastructure/http/controllers/auth/dto/requests/confirm-password-reset-request.dto';

import { AuthenticateUserOutputDto } from '@application/ports/input/auth/dto/authenticate-user.dto';

import { UserRole } from '@domain/enums/user-role.enum';

describe('AuthController', () => {
  let httpController: AuthController;
  let cleanController: AuthCleanController;

  beforeEach(() => {
    cleanController = new AuthCleanController(
      { execute: jest.fn() },
      { execute: jest.fn() },
      {
        execute: jest.fn(),
      },
    );
    httpController = new AuthController(cleanController);
  });

  describe('login', () => {
    it('should delegate to the clean controller and return its result', async () => {
      const dto: LoginRequestDto = { email: 'joao@email.com', password: 'SecurePass123!' };

      const authResult: AuthenticateUserOutputDto = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: randomUUID(), name: 'João', email: dto.email, role: UserRole.ATTENDANT },
      };

      const response = AuthPresenter.toAuthDataResponse(authResult);

      jest.spyOn(cleanController, 'login').mockResolvedValue(response);

      const result = await httpController.login(dto);

      expect(result).toBe(response);
      expect(cleanController.login).toHaveBeenCalledWith(dto);
    });
  });

  describe('refresh', () => {
    it('should delegate to the clean controller and return its result', async () => {
      const dto: RefreshTokenRequestDto = { refreshToken: 'valid-refresh-token' };

      const refreshResult: AuthenticateUserOutputDto = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: { id: randomUUID(), name: 'João', email: 'joao@email.com', role: UserRole.ATTENDANT },
      };

      const response = AuthPresenter.toAuthDataResponse(refreshResult);

      jest.spyOn(cleanController, 'refresh').mockResolvedValue(response);

      const result = await httpController.refresh(dto);

      expect(result).toBe(response);
      expect(cleanController.refresh).toHaveBeenCalledWith(dto);
    });
  });

  describe('confirmPasswordReset', () => {
    it('should delegate to the clean controller with the request body', async () => {
      const dto: ConfirmPasswordResetRequestDto = {
        email: 'joao@email.com',
        code: '042731',
        newPassword: 'NewPass@456',
      };

      jest.spyOn(cleanController, 'confirmPasswordReset').mockResolvedValue(undefined);

      await httpController.confirmPasswordReset(dto);

      expect(cleanController.confirmPasswordReset).toHaveBeenCalledWith(dto);
    });
  });
});
