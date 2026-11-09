import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign, SignOptions } from 'jsonwebtoken';

import { AuthFlow } from '@domain/enums/auth-flow.enum';
import { CustomerJwtStrategy } from '@infrastructure/http/strategies/customer-jwt.strategy';

import {
  CUSTOMER_JWT_TEST_AUDIENCE,
  CUSTOMER_JWT_TEST_ISSUER,
  CUSTOMER_JWT_TEST_PRIVATE_KEY,
  CUSTOMER_JWT_TEST_PUBLIC_KEY,
  signTestCustomerToken,
} from '../../../../helpers/customer-jwt.helper';
import { signTestStaffToken } from '../../../../helpers/staff-jwt.helper';

const CONFIG: Record<string, string | undefined> = {
  CUSTOMER_JWT_PUBLIC_KEY: CUSTOMER_JWT_TEST_PUBLIC_KEY,
  CUSTOMER_JWT_ISSUER: CUSTOMER_JWT_TEST_ISSUER,
  CUSTOMER_JWT_AUDIENCE: CUSTOMER_JWT_TEST_AUDIENCE,
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

const INVALID = { error: new UnauthorizedException('Token inválido') };

/** passport-jwt rejected the token in jsonwebtoken.verify, before validate(). */
function failedWith(reason: string) {
  return { fail: expect.objectContaining({ message: expect.stringContaining(reason) }) };
}

/** Signs with the customer key and claims, without forcing exp. */
function signRaw(payload: object, options: SignOptions = {}): string {
  return sign(payload, CUSTOMER_JWT_TEST_PRIVATE_KEY, {
    algorithm: 'RS256',
    issuer: CUSTOMER_JWT_TEST_ISSUER,
    audience: CUSTOMER_JWT_TEST_AUDIENCE,
    ...options,
  });
}

type Outcome = { success: unknown } | { fail: unknown } | { error: unknown };

describe('CustomerJwtStrategy', () => {
  let strategy: CustomerJwtStrategy;

  beforeEach(() => {
    strategy = new CustomerJwtStrategy(configWith(CONFIG));
  });

  describe('boot', () => {
    it('should fail to start without the public key', () => {
      expect(
        () =>
          new CustomerJwtStrategy(configWith({ ...CONFIG, CUSTOMER_JWT_PUBLIC_KEY: undefined })),
      ).toThrow('CUSTOMER_JWT_PUBLIC_KEY');

      expect(
        () => new CustomerJwtStrategy(configWith({ ...CONFIG, CUSTOMER_JWT_PUBLIC_KEY: '' })),
      ).toThrow('CUSTOMER_JWT_PUBLIC_KEY não é uma chave pública PEM válida');
    });

    it('should fail to start without the issuer or the audience', () => {
      expect(
        () => new CustomerJwtStrategy(configWith({ ...CONFIG, CUSTOMER_JWT_ISSUER: undefined })),
      ).toThrow('CUSTOMER_JWT_ISSUER');

      expect(
        () => new CustomerJwtStrategy(configWith({ ...CONFIG, CUSTOMER_JWT_AUDIENCE: undefined })),
      ).toThrow('CUSTOMER_JWT_AUDIENCE');
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

  it('should accept a valid customer token', async () => {
    const userId = randomUUID();

    const outcome = await authenticate(signTestCustomerToken(userId));

    expect(outcome).toEqual({ success: { sub: userId, authFlow: AuthFlow.CUSTOMER } });
  });

  it('should not read the user', async () => {
    // Built with the configuration only: a subject that exists nowhere still authenticates.
    const unknownUserId = randomUUID();

    const outcome = await authenticate(signTestCustomerToken(unknownUserId));

    expect(outcome).toEqual({ success: { sub: unknownUserId, authFlow: AuthFlow.CUSTOMER } });
  });

  it('should accept a public key with literal \\n escape sequences', async () => {
    strategy = new CustomerJwtStrategy(
      configWith({
        ...CONFIG,
        CUSTOMER_JWT_PUBLIC_KEY: CUSTOMER_JWT_TEST_PUBLIC_KEY.replaceAll('\n', '\\n'),
      }),
    );

    const outcome = await authenticate(signTestCustomerToken('user-id'));

    expect(outcome).toEqual({ success: { sub: 'user-id', authFlow: AuthFlow.CUSTOMER } });
  });

  it('should reject an HS256 token signed with the public key as the secret', async () => {
    const token = sign({ sub: 'user-id' }, CUSTOMER_JWT_TEST_PUBLIC_KEY, {
      algorithm: 'HS256',
      issuer: CUSTOMER_JWT_TEST_ISSUER,
      audience: CUSTOMER_JWT_TEST_AUDIENCE,
      expiresIn: 3600,
    });

    await expect(authenticate(token)).resolves.toEqual(failedWith('invalid algorithm'));
  });

  it('should reject an RS384 token signed with the same key pair', async () => {
    await expect(
      authenticate(signTestCustomerToken('user-id', { algorithm: 'RS384' })),
    ).resolves.toEqual(failedWith('invalid algorithm'));
  });

  it('should reject a token signed by another key', async () => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const token = sign({ sub: 'user-id' }, privateKey, {
      algorithm: 'RS256',
      issuer: CUSTOMER_JWT_TEST_ISSUER,
      audience: CUSTOMER_JWT_TEST_AUDIENCE,
      expiresIn: 3600,
    });

    await expect(authenticate(token)).resolves.toEqual(failedWith('invalid signature'));
  });

  it('should reject the wrong issuer', async () => {
    await expect(
      authenticate(signTestCustomerToken('user-id', { issuer: 'oficina-identity' })),
    ).resolves.toEqual(failedWith('jwt issuer invalid'));
  });

  it('should reject the wrong audience', async () => {
    await expect(
      authenticate(signTestCustomerToken('user-id', { audience: 'oficina-services' })),
    ).resolves.toEqual(failedWith('jwt audience invalid'));
  });

  it('should reject an expired token', async () => {
    await expect(
      authenticate(signTestCustomerToken('user-id', { expiresIn: -10 })),
    ).resolves.toEqual(failedWith('jwt expired'));
  });

  it('should reject a staff access token', async () => {
    const token = signTestStaffToken({ sub: 'user-id', email: 'ana@example.com', role: 'ADMIN' });

    await expect(authenticate(token)).resolves.toEqual(failedWith('invalid signature'));
  });

  it('should reject a token without exp', async () => {
    await expect(authenticate(signRaw({ sub: 'user-id' }))).resolves.toEqual(INVALID);
  });

  it('should reject a token without a string subject', async () => {
    await expect(authenticate(signRaw({}, { expiresIn: 3600 }))).resolves.toEqual(INVALID);
    await expect(authenticate(signRaw({ sub: 42 }, { expiresIn: 3600 }))).resolves.toEqual(INVALID);
  });
});
