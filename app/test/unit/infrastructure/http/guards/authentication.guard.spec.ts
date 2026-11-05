import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthenticationGuard } from '@infrastructure/http/guards/authentication.guard';
import { JwtAuthGuard } from '@infrastructure/http/guards/jwt-auth.guard';
import { Public } from '@infrastructure/http/decorators/public.decorator';

class RoutesController {
  @Public()
  publicRoute(): void {}

  staffRoute(): void {}
}

@Public()
class PublicController {
  inheritedRoute(): void {}
}

function contextFor(controller: object, handler: (...args: never[]) => void): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

describe('AuthenticationGuard', () => {
  let staff: jest.Mocked<JwtAuthGuard>;
  let guard: AuthenticationGuard;

  beforeEach(() => {
    staff = {
      canActivate: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<JwtAuthGuard>;
    guard = new AuthenticationGuard(new Reflector(), staff);
  });

  it('should let @Public routes through', async () => {
    const result = await guard.canActivate(
      contextFor(RoutesController, RoutesController.prototype.publicRoute),
    );

    expect(result).toBe(true);
    expect(staff.canActivate).not.toHaveBeenCalled();
  });

  it('should allow a route whose class is @Public()', async () => {
    const result = await guard.canActivate(
      contextFor(PublicController, PublicController.prototype.inheritedRoute),
    );

    expect(result).toBe(true);
    expect(staff.canActivate).not.toHaveBeenCalled();
  });

  it('should require the staff token otherwise', async () => {
    staff.canActivate.mockResolvedValue(false);
    const context = contextFor(RoutesController, RoutesController.prototype.staffRoute);

    const result = await guard.canActivate(context);

    expect(result).toBe(false);
    expect(staff.canActivate).toHaveBeenCalledWith(context);
  });
});
