import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthenticatedPrincipal } from '@application/auth/authenticated-principal';
import { AuthFlow } from '@domain/enums/auth-flow.enum';
import { UserRole } from '@domain/enums/user-role.enum';
import { ROLES_KEY } from '@infrastructure/http/decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user: AuthenticatedPrincipal }>();

    return user.authFlow === AuthFlow.INTERNAL && requiredRoles.includes(user.role);
  }
}
