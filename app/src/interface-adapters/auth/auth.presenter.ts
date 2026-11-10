import { AuthenticateUserOutputDto } from '@application/ports/input/auth/dto/authenticate-user.dto';
import { RefreshTokenOutputDto } from '@application/ports/input/auth/dto/refresh-token.dto';
import { AuthDataResponse, AuthResponse } from './responses/auth.response';

export class AuthPresenter {
  static toAuthDataResponse(
    result: AuthenticateUserOutputDto | RefreshTokenOutputDto,
  ): AuthDataResponse {
    return { data: AuthPresenter.toAuthResponse(result) };
  }

  private static toAuthResponse(
    result: AuthenticateUserOutputDto | RefreshTokenOutputDto,
  ): AuthResponse {
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
    };
  }
}
