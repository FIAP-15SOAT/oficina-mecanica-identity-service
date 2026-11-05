import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { JwtHeader } from 'jsonwebtoken';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthenticatedPrincipal } from '@application/auth/authenticated-principal';
import { UserRole } from '@domain/enums/user-role.enum';
import { readPemKey } from '@infrastructure/utils/read-pem-key.util';
import { STAFF_TOKEN_ALGORITHM } from '@infrastructure/services/staff-token.constants';

export interface TokenPayload {
  sub: string;
  email: string;
  role?: UserRole | null;
  typ?: 'access' | 'refresh';
  exp?: number;
}

interface VerifiedToken {
  header: JwtHeader;
  payload: TokenPayload;
}

const USER_ROLES: readonly unknown[] = Object.values(UserRole);

// The token is trusted on its own signature: this service does not look the user up in Identity.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly keyId: string;

  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: readPemKey(configService, 'STAFF_JWT_PUBLIC_KEY', 'PUBLIC'),
      algorithms: [STAFF_TOKEN_ALGORITHM],
      issuer: configService.getOrThrow<string>('STAFF_JWT_ISSUER'),
      audience: configService.getOrThrow<string>('STAFF_JWT_AUDIENCE'),
      // validate() needs the header to check the kid.
      jsonWebTokenOptions: { complete: true },
    });
    this.keyId = configService.getOrThrow<string>('STAFF_JWT_KEY_ID');
  }

  validate({ header, payload }: VerifiedToken): AuthenticatedPrincipal {
    // jsonwebtoken only checks exp when the claim exists.
    if (
      header.kid !== this.keyId ||
      payload.typ !== 'access' ||
      typeof payload.exp !== 'number' ||
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      !USER_ROLES.includes(payload.role)
    ) {
      throw new UnauthorizedException('Token inválido');
    }

    return { sub: payload.sub, email: payload.email, role: payload.role as UserRole };
  }
}
