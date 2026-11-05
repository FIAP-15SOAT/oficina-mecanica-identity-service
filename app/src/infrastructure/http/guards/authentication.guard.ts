import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '@infrastructure/http/decorators/public.decorator';
import { JwtAuthGuard } from '@infrastructure/http/guards/jwt-auth.guard';

/** Global guard: every route requires the staff token unless marked @Public(). */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly staff: JwtAuthGuard,
  ) {}

  canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    return this.staff.canActivate(context);
  }
}
