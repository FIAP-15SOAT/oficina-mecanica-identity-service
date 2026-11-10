import { AuthFlow } from '@domain/enums/auth-flow.enum';
import { UserRole } from '@domain/enums/user-role.enum';
import { AnyAuthGuard } from '@infrastructure/http/guards/any-auth.guard';
import { AuthenticationFailedException } from '@infrastructure/exceptions/authentication-failed.exception';

describe('AnyAuthGuard', () => {
  let guard: AnyAuthGuard;

  beforeEach(() => {
    guard = new AnyAuthGuard();
  });

  describe('handleRequest', () => {
    it('should return the principal resolved by the staff strategy', () => {
      const principal = {
        sub: 'user-id',
        authFlow: AuthFlow.INTERNAL,
        email: 'user@example.com',
        role: UserRole.ADMIN,
      };

      const result = guard.handleRequest(null, principal);

      expect(result).toBe(principal);
    });

    it('should return the principal resolved by the customer strategy', () => {
      const principal = { sub: 'user-id', authFlow: AuthFlow.CUSTOMER };

      const result = guard.handleRequest(null, principal);

      expect(result).toBe(principal);
    });

    it('should throw AuthenticationFailedException when err is provided', () => {
      const error = new Error('Token expired');

      expect(() => {
        guard.handleRequest(error, null);
      }).toThrow(new AuthenticationFailedException('Token de autenticação inválido ou ausente'));
    });

    it('should throw AuthenticationFailedException when no strategy resolved a user', () => {
      expect(() => {
        guard.handleRequest(null, false);
      }).toThrow(AuthenticationFailedException);
    });

    it('should throw AuthenticationFailedException when both err and user are present', () => {
      expect(() => {
        guard.handleRequest(new Error('Some error'), { sub: 'user-id' });
      }).toThrow(AuthenticationFailedException);
    });
  });
});
