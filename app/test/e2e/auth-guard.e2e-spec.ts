import { generateKeyPairSync } from 'node:crypto';
import { Controller, Get, UseGuards } from '@nestjs/common';
import request from 'supertest';

import { UserRole } from '@domain/enums/user-role.enum';
import { CurrentPrincipal } from '@infrastructure/http/decorators/current-principal.decorator';
import { Roles } from '@infrastructure/http/decorators/roles.decorator';
import { RolesGuard } from '@infrastructure/http/guards/roles.guard';
import type { AuthenticatedPrincipal } from '@application/auth/authenticated-principal';

import { signTestStaffToken } from '../helpers/staff-jwt.helper';
import { TestContext, setupTestApp, teardownTestApp } from '../helpers/test-app.helper';

/** Route that exists only in this suite: no @Public(), so the global guard applies. */
@Controller('auth-guard-probe')
@UseGuards(RolesGuard)
class AuthGuardProbeController {
  @Get()
  @Roles(UserRole.ADMIN)
  probe(@CurrentPrincipal() principal: AuthenticatedPrincipal): AuthenticatedPrincipal {
    return principal;
  }
}

const PROBE_PATH = '/api/auth-guard-probe';
const UNAUTHORIZED = {
  statusCode: 401,
  error: 'Unauthorized',
  message: 'Token de autenticação inválido ou ausente',
};
const ADMIN = { sub: 'staff-uuid-1', email: 'admin@example.com', role: UserRole.ADMIN };

describe('Authentication guard (E2E)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestApp({ controllers: [AuthGuardProbeController], withSwagger: true });
  });

  afterAll(async () => {
    await teardownTestApp(ctx);
  });

  it('should return 401 without a token', async () => {
    const response = await request(ctx.httpServer).get(PROBE_PATH).expect(401);

    expect(response.body).toEqual(UNAUTHORIZED);
  });

  it('should return 401 with a token signed by another key', async () => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const response = await request(ctx.httpServer)
      .get(PROBE_PATH)
      .set('Authorization', `Bearer ${signTestStaffToken(ADMIN, {}, privateKey)}`)
      .expect(401);

    expect(response.body).toEqual(UNAUTHORIZED);
  });

  it('should return 403 for a role the route does not allow', async () => {
    const token = signTestStaffToken({ ...ADMIN, role: UserRole.MECHANIC });

    const response = await request(ctx.httpServer)
      .get(PROBE_PATH)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(response.body).toMatchObject({ statusCode: 403, error: 'Forbidden' });
  });

  it('should return 200 with the principal for the required role', async () => {
    const response = await request(ctx.httpServer)
      .get(PROBE_PATH)
      .set('Authorization', `Bearer ${signTestStaffToken(ADMIN)}`)
      .expect(200);

    expect(response.body).toEqual({ ...ADMIN, authFlow: 'INTERNAL' });
  });

  it('should serve /api/health/live without a token', async () => {
    await request(ctx.httpServer).get('/api/health/live').expect(200);
  });

  it('should serve /api/health/ready without a token', async () => {
    const response = await request(ctx.httpServer).get('/api/health/ready');

    expect(response.status).not.toBe(401);
    expect(response.status).toBe(200);
  });

  it('should serve /api/docs without a token', async () => {
    await request(ctx.httpServer).get('/api/docs').expect(200);
  });
});
