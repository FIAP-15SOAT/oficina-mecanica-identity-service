import { UserRole } from '@domain/enums/user-role.enum';
import { ITokenService } from '@application/ports/output/services/token.service.interface';

export function createMockTokenService(): jest.Mocked<ITokenService> {
  return {
    signAccessToken: jest.fn().mockReturnValue('access-token-mock'),
    signRefreshToken: jest.fn().mockReturnValue('refresh-token-mock'),
    signTokenPair: jest.fn().mockReturnValue({
      accessToken: 'access-token-mock',
      refreshToken: 'refresh-token-mock',
    }),
    verifyRefreshToken: jest.fn().mockReturnValue({
      sub: 'user-uuid-123',
      email: 'admin@email.com',
      name: 'Admin User',
      role: UserRole.ADMIN,
      typ: 'refresh',
      iat: Math.floor(Date.now() / 1000),
    }),
  };
}
