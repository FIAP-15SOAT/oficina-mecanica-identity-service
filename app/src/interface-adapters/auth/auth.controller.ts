import { IAuthenticateUserUseCase } from '@application/ports/input/auth/authenticate-user.use-case.interface';
import { IRefreshTokenUseCase } from '@application/ports/input/auth/refresh-token.use-case.interface';
import { IConfirmPasswordResetUseCase } from '@application/ports/input/auth/confirm-password-reset.use-case.interface';
import { ConfirmPasswordResetDto } from '@application/ports/input/auth/dto/confirm-password-reset.dto';

import { LoginRequest } from './requests/login-request';
import { RefreshTokenRequest } from './requests/refresh-token-request';

import { AuthPresenter } from './auth.presenter';
import { AuthDataResponse } from './responses/auth.response';

export class AuthController {
  constructor(
    private readonly authenticateUseCase: IAuthenticateUserUseCase,
    private readonly refreshTokenUseCase: IRefreshTokenUseCase,
    private readonly confirmPasswordResetUseCase: IConfirmPasswordResetUseCase,
  ) {}

  async login(input: LoginRequest): Promise<AuthDataResponse> {
    const result = await this.authenticateUseCase.execute(input);
    return AuthPresenter.toAuthDataResponse(result);
  }

  async refresh(input: RefreshTokenRequest): Promise<AuthDataResponse> {
    const result = await this.refreshTokenUseCase.execute(input);
    return AuthPresenter.toAuthDataResponse(result);
  }

  async confirmPasswordReset(input: ConfirmPasswordResetDto): Promise<void> {
    await this.confirmPasswordResetUseCase.execute(input);
  }
}
