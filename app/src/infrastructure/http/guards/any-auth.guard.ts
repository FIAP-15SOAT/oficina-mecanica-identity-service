import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AuthenticationFailedException } from '../../exceptions/authentication-failed.exception';

/**
 * Accepts the staff or the customer token. Passport tries 'jwt' and then 'customer-jwt', each
 * with its own key and claims; neither is relaxed to accept the other token.
 */
@Injectable()
export class AnyAuthGuard extends AuthGuard(['jwt', 'customer-jwt']) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleRequest<TUser = any>(err: any, user: any): TUser {
    if (err || !user) {
      throw new AuthenticationFailedException('Token de autenticação inválido ou ausente');
    }

    return user as TUser;
  }
}
