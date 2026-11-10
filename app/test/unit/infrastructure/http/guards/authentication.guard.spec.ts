import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthenticationGuard } from '@infrastructure/http/guards/authentication.guard';
import { AnyAuthGuard } from '@infrastructure/http/guards/any-auth.guard';
import { JwtAuthGuard } from '@infrastructure/http/guards/jwt-auth.guard';
import { CustomerArea } from '@infrastructure/http/decorators/customer-area.decorator';
import { Public } from '@infrastructure/http/decorators/public.decorator';

class RoutesController {
  @Public()
  publicRoute(): void {}

  staffRoute(): void {}

  @CustomerArea('any')
  anyRoute(): void {}
}

@Public()
class PublicController {
  inheritedRoute(): void {}
}

@CustomerArea('any')
class AnyAreaController {
  inheritedRoute(): void {}
}

function contextFor(controller: object, handler: (...args: never[]) => void): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

describe('AuthenticationGuard', () => {
  let jwtAuthGuard: jest.Mocked<JwtAuthGuard>;
  let anyAuthGuard: jest.Mocked<AnyAuthGuard>;
  let guard: AuthenticationGuard;

  beforeEach(() => {
    jwtAuthGuard = {
      canActivate: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<JwtAuthGuard>;

    anyAuthGuard = {
      canActivate: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AnyAuthGuard>;

    guard = new AuthenticationGuard(new Reflector(), jwtAuthGuard, anyAuthGuard);
  });

  it('should let @Public routes through', async () => {
    const result = await guard.canActivate(
      contextFor(RoutesController, RoutesController.prototype.publicRoute),
    );

    expect(result).toBe(true);
    expect(jwtAuthGuard.canActivate).not.toHaveBeenCalled();
    expect(anyAuthGuard.canActivate).not.toHaveBeenCalled();
  });

  it('should allow a route whose class is @Public()', async () => {
    const result = await guard.canActivate(
      contextFor(PublicController, PublicController.prototype.inheritedRoute),
    );

    expect(result).toBe(true);
    expect(jwtAuthGuard.canActivate).not.toHaveBeenCalled();
  });

  it('should require the staff token when the route has no marker', async () => {
    jwtAuthGuard.canActivate.mockResolvedValue(false);
    const context = contextFor(RoutesController, RoutesController.prototype.staffRoute);

    const result = await guard.canActivate(context);

    expect(result).toBe(false);
    expect(jwtAuthGuard.canActivate).toHaveBeenCalledWith(context);
    expect(anyAuthGuard.canActivate).not.toHaveBeenCalled();
  });

  it("should dispatch @CustomerArea('any') to AnyAuthGuard", async () => {
    const context = contextFor(RoutesController, RoutesController.prototype.anyRoute);

    await guard.canActivate(context);

    expect(anyAuthGuard.canActivate).toHaveBeenCalledWith(context);
    expect(jwtAuthGuard.canActivate).not.toHaveBeenCalled();
  });

  it("should read @CustomerArea('any') from the class", async () => {
    const context = contextFor(AnyAreaController, AnyAreaController.prototype.inheritedRoute);

    await guard.canActivate(context);

    expect(anyAuthGuard.canActivate).toHaveBeenCalledWith(context);
    expect(jwtAuthGuard.canActivate).not.toHaveBeenCalled();
  });
});
