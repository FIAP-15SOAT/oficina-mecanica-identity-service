import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthenticatedPrincipal } from '@application/auth/authenticated-principal';
import { AuthFlow } from '@domain/enums/auth-flow.enum';
import { readPemKey } from '@infrastructure/utils/read-pem-key.util';

interface CustomerTokenPayload {
  sub?: unknown;
  exp?: unknown;
}

/**
 * Customer token signed by the customer-auth Lambda. It has its own public key, issuer and
 * audience, so a staff token never passes here and a customer token never passes the JwtStrategy.
 * The token is trusted on its own signature: the user and the customer links are not reloaded.
 */
@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(Strategy, 'customer-jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: readPemKey(configService, 'CUSTOMER_JWT_PUBLIC_KEY', 'PUBLIC'),
      algorithms: ['RS256'],
      issuer: configService.getOrThrow<string>('CUSTOMER_JWT_ISSUER'),
      audience: configService.getOrThrow<string>('CUSTOMER_JWT_AUDIENCE'),
    });
  }

  validate(payload: CustomerTokenPayload): AuthenticatedPrincipal {
    // jsonwebtoken only checks exp when the claim exists.
    if (typeof payload.exp !== 'number' || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Token inválido');
    }

    return { sub: payload.sub, authFlow: AuthFlow.CUSTOMER };
  }
}
