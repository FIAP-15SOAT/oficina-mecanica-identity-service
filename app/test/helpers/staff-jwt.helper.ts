import { generateKeyPairSync } from 'node:crypto';
import { sign, SignOptions } from 'jsonwebtoken';

// Ephemeral RS256 pair generated at runtime (never committed as PEM) for the staff access token.
const accessPair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

export const STAFF_JWT_TEST_PRIVATE_KEY = accessPair.privateKey;
export const STAFF_JWT_TEST_PUBLIC_KEY = accessPair.publicKey;

export const STAFF_JWT_TEST_KEY_ID = 'staff-test';
export const STAFF_JWT_TEST_ISSUER = 'oficina-identity';
export const STAFF_JWT_TEST_AUDIENCE = 'oficina-services';

/** Signs a staff access token with the full profile; options and payload override it. */
export function signTestStaffToken(
  payload: object,
  options: SignOptions = {},
  privateKey: string = STAFF_JWT_TEST_PRIVATE_KEY,
): string {
  return sign({ typ: 'access', ...payload }, privateKey, {
    algorithm: 'RS256',
    keyid: STAFF_JWT_TEST_KEY_ID,
    issuer: STAFF_JWT_TEST_ISSUER,
    audience: STAFF_JWT_TEST_AUDIENCE,
    expiresIn: 600,
    ...options,
  });
}
