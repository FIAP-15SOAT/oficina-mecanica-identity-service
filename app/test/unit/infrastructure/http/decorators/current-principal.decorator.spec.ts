import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

import { AuthenticatedPrincipal } from '@application/auth/authenticated-principal';
import { UserRole } from '@domain/enums/user-role.enum';
import { CurrentPrincipal } from '@infrastructure/http/decorators/current-principal.decorator';

class TestController {
  handler(@CurrentPrincipal() _principal: AuthenticatedPrincipal): void {}
}

function getDecoratorFactory() {
  const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'handler') as Record<
    string,
    { factory: (data: unknown, ctx: ExecutionContext) => AuthenticatedPrincipal }
  >;

  return Object.values(metadata)[0].factory;
}

function buildContext(user: AuthenticatedPrincipal): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

describe('CurrentPrincipalDecorator', () => {
  let factory: (data: unknown, ctx: ExecutionContext) => AuthenticatedPrincipal;

  beforeEach(() => {
    factory = getDecoratorFactory();
  });

  it('should extract the staff principal from the request', () => {
    const principal: AuthenticatedPrincipal = {
      sub: 'user-uuid-123',
      email: 'john@example.com',
      role: UserRole.ADMIN,
    };

    const result = factory(null, buildContext(principal));

    expect(result).toEqual(principal);
  });

  it('should handle all staff roles', () => {
    const testRoles = [UserRole.ADMIN, UserRole.MECHANIC, UserRole.ATTENDANT];

    testRoles.forEach((role) => {
      const principal: AuthenticatedPrincipal = {
        sub: `user-${role}`,
        email: `${role.toLowerCase()}@example.com`,
        role,
      };

      const result = factory(null, buildContext(principal));

      expect(result).toEqual(expect.objectContaining({ role }));
    });
  });
});
