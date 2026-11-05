import { generateKeyPairSync } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign, SignOptions } from 'jsonwebtoken';

import { UserRole } from '@domain/enums/user-role.enum';
import { JwtStrategy } from '@infrastructure/http/strategies/jwt.strategy';

import {
  STAFF_JWT_TEST_AUDIENCE,
  STAFF_JWT_TEST_ISSUER,
  STAFF_JWT_TEST_KEY_ID,
  STAFF_JWT_TEST_PRIVATE_KEY,
  STAFF_JWT_TEST_PUBLIC_KEY,
  signTestStaffToken,
} from '../../../../helpers/staff-jwt.helper';

const CONFIG: Record<string, string | undefined> = {
  STAFF_JWT_PUBLIC_KEY: STAFF_JWT_TEST_PUBLIC_KEY,
  STAFF_JWT_KEY_ID: STAFF_JWT_TEST_KEY_ID,
  STAFF_JWT_ISSUER: STAFF_JWT_TEST_ISSUER,
  STAFF_JWT_AUDIENCE: STAFF_JWT_TEST_AUDIENCE,
};

/** Mirrors ConfigService.getOrThrow: throws only when the value is undefined. */
function configWith(values: Record<string, string | undefined>): ConfigService {
  return {
    getOrThrow: jest.fn((key: string) => {
      if (values[key] === undefined) {
        throw new TypeError(`Configuration key "${key}" does not exist`);
      }
      return values[key];
    }),
  } as unknown as ConfigService;
}

const CLAIMS = { sub: 'user-uuid-123', email: 'ana@example.com', role: UserRole.ADMIN };

const INVALID = { error: new UnauthorizedException('Token inválido') };

/** passport-jwt rejected the token in jsonwebtoken.verify, before validate(). */
function failedWith(reason: string) {
  return { fail: expect.objectContaining({ message: expect.stringContaining(reason) }) };
}

const otherPrivateKey = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
}).privateKey;

/** Signs with the staff key and issuer, but without forcing exp, kid or typ. */
function signRaw(payload: object, options: SignOptions = {}): string {
  return sign(payload, STAFF_JWT_TEST_PRIVATE_KEY, {
    algorithm: 'RS256',
    issuer: STAFF_JWT_TEST_ISSUER,
    audience: STAFF_JWT_TEST_AUDIENCE,
    ...options,
  });
}

function withoutClaim(claim: keyof typeof CLAIMS): object {
  const claims: Partial<typeof CLAIMS> = { ...CLAIMS };
  delete claims[claim];
  return claims;
}

type Outcome = { success: unknown } | { fail: unknown } | { error: unknown };

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    strategy = new JwtStrategy(configWith(CONFIG));
  });

  describe('boot', () => {
    it('should fail to start without the public key', () => {
      expect(
        () => new JwtStrategy(configWith({ ...CONFIG, STAFF_JWT_PUBLIC_KEY: undefined })),
      ).toThrow('STAFF_JWT_PUBLIC_KEY');
      expect(() => new JwtStrategy(configWith({ ...CONFIG, STAFF_JWT_PUBLIC_KEY: '' }))).toThrow(
        'STAFF_JWT_PUBLIC_KEY não é uma chave pública PEM válida',
      );
    });
  });

  /** Runs the full passport-jwt flow: signature, alg, iss, aud and exp, then validate(). */
  function authenticate(token: string): Promise<Outcome> {
    return new Promise((resolve) => {
      Object.assign(strategy, {
        success: (user: unknown) => resolve({ success: user }),
        fail: (info: unknown) => resolve({ fail: info }),
        error: (error: unknown) => resolve({ error }),
      });
      strategy.authenticate({ headers: { authorization: `Bearer ${token}` } } as never);
    });
  }

  it('should accept a valid access token', async () => {
    await expect(authenticate(signTestStaffToken(CLAIMS))).resolves.toEqual({
      success: { sub: CLAIMS.sub, email: CLAIMS.email, role: UserRole.ADMIN },
    });
  });

  it('should reject an HS256 token signed with the public key', async () => {
    const token = sign({ ...CLAIMS, typ: 'access' }, STAFF_JWT_TEST_PUBLIC_KEY, {
      algorithm: 'HS256',
      keyid: STAFF_JWT_TEST_KEY_ID,
      issuer: STAFF_JWT_TEST_ISSUER,
      audience: STAFF_JWT_TEST_AUDIENCE,
      expiresIn: 600,
      // jsonwebtoken refuses an asymmetric key as HMAC secret unless told otherwise.
      allowInsecureKeySizes: true,
      allowInvalidAsymmetricKeyTypes: true,
    });

    await expect(authenticate(token)).resolves.toEqual(failedWith('invalid algorithm'));
  });

  it('should reject a token signed with another RS256 key', async () => {
    await expect(authenticate(signTestStaffToken(CLAIMS, {}, otherPrivateKey))).resolves.toEqual(
      failedWith('invalid signature'),
    );
  });

  it('should reject another issuer', async () => {
    await expect(
      authenticate(signTestStaffToken(CLAIMS, { issuer: 'other-issuer' })),
    ).resolves.toEqual(failedWith('jwt issuer invalid'));
  });

  it('should reject another audience', async () => {
    await expect(
      authenticate(signTestStaffToken(CLAIMS, { audience: 'other-audience' })),
    ).resolves.toEqual(failedWith('jwt audience invalid'));
  });

  it('should reject an expired token', async () => {
    await expect(authenticate(signTestStaffToken(CLAIMS, { expiresIn: -10 }))).resolves.toEqual(
      failedWith('jwt expired'),
    );
  });

  it('should reject a token without exp', async () => {
    const token = signRaw({ ...CLAIMS, typ: 'access' }, { keyid: STAFF_JWT_TEST_KEY_ID });

    await expect(authenticate(token)).resolves.toEqual(INVALID);
  });

  it('should reject a missing or different kid', async () => {
    const withoutKid = signRaw({ ...CLAIMS, typ: 'access' }, { expiresIn: 600 });
    const otherKid = signTestStaffToken(CLAIMS, { keyid: 'other-kid' });

    await expect(authenticate(withoutKid)).resolves.toEqual(INVALID);
    await expect(authenticate(otherKid)).resolves.toEqual(INVALID);
  });

  it('should reject a token without sub', async () => {
    await expect(authenticate(signTestStaffToken(withoutClaim('sub')))).resolves.toEqual(INVALID);
  });

  it('should reject a token without email', async () => {
    await expect(authenticate(signTestStaffToken(withoutClaim('email')))).resolves.toEqual(INVALID);
    await expect(authenticate(signTestStaffToken({ ...CLAIMS, email: 42 }))).resolves.toEqual(
      INVALID,
    );
  });

  it('should reject a token without role', async () => {
    await expect(authenticate(signTestStaffToken(withoutClaim('role')))).resolves.toEqual(INVALID);
  });

  it('should reject an unknown role', async () => {
    await expect(
      authenticate(signTestStaffToken({ ...CLAIMS, role: 'CUSTOMER' })),
    ).resolves.toEqual(INVALID);
  });

  it('should reject a customer token', async () => {
    // Customer-auth Lambda token: customer issuer and audience, no staff role.
    const token = sign({ sub: 'customer-uuid', typ: 'access' }, STAFF_JWT_TEST_PRIVATE_KEY, {
      algorithm: 'RS256',
      keyid: STAFF_JWT_TEST_KEY_ID,
      issuer: 'oficina-customer-auth',
      audience: 'oficina-customer',
      expiresIn: 600,
    });

    await expect(authenticate(token)).resolves.toEqual(failedWith('jwt audience invalid'));
  });

  it('should reject typ different from access', async () => {
    await expect(authenticate(signTestStaffToken({ ...CLAIMS, typ: 'refresh' }))).resolves.toEqual(
      INVALID,
    );
  });
});
