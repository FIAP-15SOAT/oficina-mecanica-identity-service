import { randomUUID } from 'node:crypto';

import { AuthController } from '@interface-adapters/auth/auth.controller';
import { AuthPresenter } from '@interface-adapters/auth/auth.presenter';

import { LoginRequest } from '@interface-adapters/auth/requests/login-request';
import { RefreshTokenRequest } from '@interface-adapters/auth/requests/refresh-token-request';

import { IAuthenticateUserUseCase } from '@application/ports/input/auth/authenticate-user.use-case.interface';
import { IRefreshTokenUseCase } from '@application/ports/input/auth/refresh-token.use-case.interface';
import { IConfirmPasswordResetUseCase } from '@application/ports/input/auth/confirm-password-reset.use-case.interface';

import { AuthenticateUserOutputDto } from '@application/ports/input/auth/dto/authenticate-user.dto';
import { RefreshTokenOutputDto } from '@application/ports/input/auth/dto/refresh-token.dto';

import { UserRole } from '@domain/enums/user-role.enum';

describe('AuthController', () => {
  let controller: AuthController;
  let authenticateUseCase: jest.Mocked<IAuthenticateUserUseCase>;
  let refreshTokenUseCase: jest.Mocked<IRefreshTokenUseCase>;
  let confirmPasswordResetUseCase: jest.Mocked<IConfirmPasswordResetUseCase>;

  beforeEach(() => {
    authenticateUseCase = { execute: jest.fn() };
    refreshTokenUseCase = { execute: jest.fn() };
    confirmPasswordResetUseCase = { execute: jest.fn() };

    controller = new AuthController(
      authenticateUseCase,
      refreshTokenUseCase,
      confirmPasswordResetUseCase,
    );
  });

  describe('login', () => {
    it('should authenticate the user and return tokens wrapped in data', async () => {
      const request: LoginRequest = {
        email: 'john.doe@example.com',
        password: 'SecurePass123!',
      };

      const authResult: AuthenticateUserOutputDto = {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'refresh-token-uuid',
        user: {
          id: randomUUID(),
          name: 'John Doe',
          email: request.email,
          role: UserRole.ATTENDANT,
        },
      };

      authenticateUseCase.execute.mockResolvedValue(authResult);

      const result = await controller.login(request);

      expect(result).toEqual(AuthPresenter.toAuthDataResponse(authResult));
      expect(authenticateUseCase.execute).toHaveBeenCalledWith(request);
    });
  });

  describe('refresh', () => {
    it('should refresh tokens and return them wrapped in data', async () => {
      const request: RefreshTokenRequest = { refreshToken: 'valid-refresh-token' };

      const refreshResult: RefreshTokenOutputDto = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: {
          id: randomUUID(),
          name: 'John Doe',
          email: 'john.doe@example.com',
          role: UserRole.ATTENDANT,
        },
      };

      refreshTokenUseCase.execute.mockResolvedValue(refreshResult);

      const result = await controller.refresh(request);

      expect(result).toEqual(AuthPresenter.toAuthDataResponse(refreshResult));
      expect(refreshTokenUseCase.execute).toHaveBeenCalledWith(request);
    });
  });

  describe('confirmPasswordReset', () => {
    it('should call the confirm password reset use case with the input', async () => {
      const input = { email: 'john.doe@example.com', code: '042731', newPassword: 'NewPass@456' };

      confirmPasswordResetUseCase.execute.mockResolvedValue(undefined);

      await controller.confirmPasswordReset(input);

      expect(confirmPasswordResetUseCase.execute).toHaveBeenCalledWith(input);
    });
  });
});
