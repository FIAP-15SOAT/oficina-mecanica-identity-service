import { generateKeyPairSync } from 'node:crypto';
import { sign, SignOptions } from 'jsonwebtoken';

// Ephemeral RS256 pair generated at runtime (never committed as PEM): it stands in for the
// customer-auth Lambda, which signs the customer token in the deployed solution.
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

export const CUSTOMER_JWT_TEST_PRIVATE_KEY = privateKey;
export const CUSTOMER_JWT_TEST_PUBLIC_KEY = publicKey;

export const CUSTOMER_JWT_TEST_ISSUER = 'oficina-customer-auth';
export const CUSTOMER_JWT_TEST_AUDIENCE = 'oficina-api';

/** Signs a customer token for the user; options override the issuer, audience and expiry. */
export function signTestCustomerToken(userId: string, options: SignOptions = {}): string {
  return sign({ sub: userId }, CUSTOMER_JWT_TEST_PRIVATE_KEY, {
    algorithm: 'RS256',
    issuer: CUSTOMER_JWT_TEST_ISSUER,
    audience: CUSTOMER_JWT_TEST_AUDIENCE,
    expiresIn: 3600,
    ...options,
  });
}
