import { generateKeyPairSync, randomUUID } from 'node:crypto';
import type { Server } from 'http';
import * as bcrypt from 'bcrypt';
import { decode, JwtPayload, sign, verify } from 'jsonwebtoken';
import Redis from 'ioredis';
import request from 'supertest';

import { UserRole } from '@domain/enums/user-role.enum';

import {
  STAFF_JWT_TEST_KEY_ID,
  STAFF_JWT_TEST_PRIVATE_KEY,
  STAFF_JWT_TEST_PUBLIC_KEY,
  STAFF_REFRESH_TEST_PUBLIC_KEY,
  signTestRefreshToken,
  signTestStaffToken,
} from '../helpers/staff-jwt.helper';
import { TestContext, setupTestApp, teardownTestApp } from '../helpers/test-app.helper';

const PASSWORD = 'Senha@123';
const NEW_PASSWORD = 'NewPass@789';
const WRONG_CODE = '999999';
const CODE_REJECTION = 'Código de redefinição inválido ou expirado';
const RESET_UNAVAILABLE =
  'Não foi possível processar o código de redefinição agora. Tente novamente em instantes';

describe('Auth (E2E)', () => {
  let ctx: TestContext;
  let httpServer: Server;
  let valkey: Redis;
  let admin: string;

  async function createUser(
    email: string,
    overrides: { role?: UserRole | null; isActive?: boolean; password?: string } = {},
  ) {
    return ctx.prisma.user.create({
      data: {
        name: 'Usuário de Teste',
        email,
        passwordHash: await bcrypt.hash(overrides.password ?? PASSWORD, 4),
        role: overrides.role === undefined ? UserRole.ADMIN : overrides.role,
        isActive: overrides.isActive ?? true,
      },
    });
  }

  async function login(email: string, password = PASSWORD) {
    const response = await request(httpServer)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    return response.body.data as {
      accessToken: string;
      refreshToken: string;
      user: { id: string; name: string; email: string; role: string };
    };
  }

  async function issueResetCode(userId: string, email: string): Promise<string> {
    await request(httpServer)
      .post(`/api/users/${userId}/password-resets`)
      .set('Authorization', admin)
      .expect(204);

    const messages = await ctx.prisma.outboxMessage.findMany({ orderBy: { id: 'desc' } });
    const message = messages.find((item) => {
      const payload = item.payload as { to: string[]; purpose: string };

      return payload.purpose === 'password_reset_code' && payload.to.includes(email);
    });
    const text = (message!.payload as { text: string }).text;

    return /Código: (\d{6})/.exec(text)![1];
  }

  function confirmReset(email: string, code: string, newPassword = NEW_PASSWORD) {
    return request(httpServer)
      .post('/api/auth/password-reset-confirmations')
      .send({ email, code, newPassword });
  }

  beforeAll(async () => {
    ctx = await setupTestApp({ captureLogs: true });
    httpServer = ctx.httpServer;
    valkey = new Redis(ctx.valkeyContainer.getConnectionUrl());
  });

  afterAll(async () => {
    await teardownTestApp(ctx);
  });

  beforeEach(async () => {
    await ctx.prisma.outboxMessage.deleteMany();
    await ctx.prisma.user.deleteMany();
    if (valkey.status === 'ready') await valkey.flushall();

    admin = `Bearer ${signTestStaffToken({
      sub: randomUUID(),
      email: 'actor@e2e.test',
      role: UserRole.ADMIN,
    })}`;
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await createUser('login@e2e.test');
    });

    it('should login the admin and return the user summary', async () => {
      const response = await request(httpServer)
        .post('/api/auth/login')
        .send({ email: 'login@e2e.test', password: PASSWORD })
        .expect(200);

      expect(response.body.data).toEqual({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: {
          id: expect.any(String),
          name: 'Usuário de Teste',
          email: 'login@e2e.test',
          role: 'ADMIN',
        },
      });
    });

    it('should issue an access token with the RS256 staff profile', async () => {
      const auth = await login('login@e2e.test');

      const { header } = decode(auth.accessToken, { complete: true })!;
      const claims = verify(auth.accessToken, STAFF_JWT_TEST_PUBLIC_KEY, {
        algorithms: ['RS256'],
        issuer: 'oficina-identity',
        audience: 'oficina-services',
      }) as JwtPayload;

      expect(header).toMatchObject({ alg: 'RS256', kid: STAFF_JWT_TEST_KEY_ID });
      expect(claims).toMatchObject({
        sub: auth.user.id,
        email: 'login@e2e.test',
        name: 'Usuário de Teste',
        role: 'ADMIN',
        typ: 'access',
        iss: 'oficina-identity',
        aud: 'oficina-services',
      });
      expect(claims.exp! - claims.iat!).toBe(600);
    });

    it('should issue a refresh token with its own key, audience and type', async () => {
      const auth = await login('login@e2e.test');

      const { header } = decode(auth.refreshToken, { complete: true })!;
      const claims = verify(auth.refreshToken, STAFF_REFRESH_TEST_PUBLIC_KEY, {
        algorithms: ['RS256'],
        issuer: 'oficina-identity',
        audience: 'oficina-identity',
      }) as JwtPayload;

      expect(header.kid).toBeUndefined();
      expect(claims.typ).toBe('refresh');
      expect(claims.exp! - claims.iat!).toBe(604800);
    });

    it('should return 401 with the generic message for a wrong password', async () => {
      const response = await request(httpServer)
        .post('/api/auth/login')
        .send({ email: 'login@e2e.test', password: 'WrongPassword' })
        .expect(401);

      expect(response.body.message).toBe('Credenciais inválidas');
    });

    it('should return 401 with the generic message for an unknown e-mail', async () => {
      const response = await request(httpServer)
        .post('/api/auth/login')
        .send({ email: 'nope@e2e.test', password: PASSWORD })
        .expect(401);

      expect(response.body.message).toBe('Credenciais inválidas');
    });

    it('should return 400 when the password is missing', async () => {
      const response = await request(httpServer)
        .post('/api/auth/login')
        .send({ email: 'login@e2e.test' })
        .expect(400);

      expect(response.body.message).toContain('A senha é obrigatória');
    });

    it('should return 401 when the user is deactivated', async () => {
      await ctx.prisma.user.updateMany({
        where: { email: 'login@e2e.test' },
        data: { isActive: false },
      });

      await request(httpServer)
        .post('/api/auth/login')
        .send({ email: 'login@e2e.test', password: PASSWORD })
        .expect(401);
    });

    it('should return 401 for a customer user without role, never issuing a token', async () => {
      await createUser('customer@e2e.test', { role: null });

      const response = await request(httpServer)
        .post('/api/auth/login')
        .send({ email: 'customer@e2e.test', password: PASSWORD })
        .expect(401);

      expect(response.body.message).toBe('Credenciais inválidas');
      expect(response.body.data).toBeUndefined();
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should exchange a refresh token for a new pair', async () => {
      await createUser('refresh@e2e.test');
      const auth = await login('refresh@e2e.test');

      const response = await request(httpServer)
        .post('/api/auth/refresh')
        .send({ refreshToken: auth.refreshToken })
        .expect(200);

      expect(response.body.data).toEqual(
        expect.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          user: expect.objectContaining({ id: auth.user.id, role: 'ADMIN' }),
        }),
      );
    });

    it('should return 401 with an invalid refresh token', async () => {
      const response = await request(httpServer)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid.token.here' })
        .expect(401);

      expect(response.body.message).toBe('Refresh token inválido ou expirado');
    });

    it('should return 400 when the refresh token is missing', async () => {
      await request(httpServer).post('/api/auth/refresh').send({}).expect(400);
    });

    it('should reject an access token sent to refresh', async () => {
      await createUser('access-as-refresh@e2e.test');
      const auth = await login('access-as-refresh@e2e.test');

      const response = await request(httpServer)
        .post('/api/auth/refresh')
        .send({ refreshToken: auth.accessToken })
        .expect(401);

      expect(response.body.data).toBeUndefined();
    });

    it('should reject a refresh token sent as access token on a protected route', async () => {
      await createUser('refresh-as-access@e2e.test');
      const auth = await login('refresh-as-access@e2e.test');

      await request(httpServer)
        .get('/api/users')
        .set('Authorization', `Bearer ${auth.refreshToken}`)
        .expect(401);
    });

    it('should return 401 when the user was deleted after the token was issued', async () => {
      const user = await createUser('refresh-deleted@e2e.test');
      const auth = await login('refresh-deleted@e2e.test');

      await ctx.prisma.user.delete({ where: { id: user.id } });

      await request(httpServer)
        .post('/api/auth/refresh')
        .send({ refreshToken: auth.refreshToken })
        .expect(401);
    });

    it('should return 401 when the user is deactivated after the token was issued', async () => {
      const user = await createUser('refresh-inactive@e2e.test');
      const auth = await login('refresh-inactive@e2e.test');

      await ctx.prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

      await request(httpServer)
        .post('/api/auth/refresh')
        .send({ refreshToken: auth.refreshToken })
        .expect(401);
    });

    it('should return 401 for a refresh token of a user without role', async () => {
      const user = await createUser('refresh-customer@e2e.test', { role: null });

      await request(httpServer)
        .post('/api/auth/refresh')
        .send({
          refreshToken: signTestRefreshToken({
            sub: user.id,
            email: user.email,
            name: user.name,
            role: null,
          }),
        })
        .expect(401);
    });

    it('should return 401 for a refresh token signed by another key', async () => {
      const user = await createUser('refresh-forged@e2e.test');
      const { privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });
      const forged = sign(
        { typ: 'refresh', sub: user.id, email: user.email, name: user.name, role: 'ADMIN' },
        privateKey,
        {
          algorithm: 'RS256',
          issuer: 'oficina-identity',
          audience: 'oficina-identity',
          expiresIn: '7d',
        },
      );

      await request(httpServer)
        .post('/api/auth/refresh')
        .send({ refreshToken: forged })
        .expect(401);
    });

    it('should reject an access token signed with the access key as refresh', async () => {
      const user = await createUser('refresh-access-key@e2e.test');
      const token = signTestStaffToken(
        { sub: user.id, email: user.email, name: user.name, role: 'ADMIN' },
        { audience: 'oficina-identity' },
        STAFF_JWT_TEST_PRIVATE_KEY,
      );

      await request(httpServer).post('/api/auth/refresh').send({ refreshToken: token }).expect(401);
    });
  });

  describe('POST /api/users/:userId/password-resets', () => {
    it('should answer 204 and add only the password_reset_code e-mail to the outbox', async () => {
      const user = await createUser('target@e2e.test', { role: UserRole.ATTENDANT });

      await request(httpServer)
        .post(`/api/users/${user.id}/password-resets`)
        .set('Authorization', admin)
        .expect(204);

      const messages = await ctx.prisma.outboxMessage.findMany();

      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        type: 'notification.email.send',
        workOrderId: null,
        payload: expect.objectContaining({
          to: ['target@e2e.test'],
          purpose: 'password_reset_code',
        }),
      });
      expect(await valkey.hget(`identity:reset-code:${user.id}`, 'attempts')).toBe('0');
    });

    it('should answer 404 for a non-existent user', async () => {
      await request(httpServer)
        .post(`/api/users/${randomUUID()}/password-resets`)
        .set('Authorization', admin)
        .expect(404);
    });

    it('should answer 403 for a non-admin staff token', async () => {
      const token = signTestStaffToken({
        sub: randomUUID(),
        email: 'mechanic@e2e.test',
        role: UserRole.MECHANIC,
      });

      await request(httpServer)
        .post(`/api/users/${randomUUID()}/password-resets`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('POST /api/auth/password-reset-confirmations', () => {
    it('should change the password, delete the code and end the sessions issued before', async () => {
      const user = await createUser('reset@e2e.test', { role: UserRole.ATTENDANT });
      const before = await login('reset@e2e.test');
      const code = await issueResetCode(user.id, 'reset@e2e.test');

      // iat has one-second granularity: make the change land in a later second than the login.
      await new Promise((resolve) => setTimeout(resolve, 1100));

      await confirmReset('reset@e2e.test', code).expect(204);

      expect(await valkey.exists(`identity:reset-code:${user.id}`)).toBe(0);

      await request(httpServer)
        .post('/api/auth/login')
        .send({ email: 'reset@e2e.test', password: PASSWORD })
        .expect(401);

      await login('reset@e2e.test', NEW_PASSWORD);

      const refresh = await request(httpServer)
        .post('/api/auth/refresh')
        .send({ refreshToken: before.refreshToken })
        .expect(401);

      expect(refresh.body.message).toBe('Refresh token inválido ou expirado');
    });

    it('should reject the sixth attempt even with the right code', async () => {
      const user = await createUser('exhaust@e2e.test');
      const code = await issueResetCode(user.id, 'exhaust@e2e.test');

      for (let attempt = 0; attempt < 5; attempt++) {
        await confirmReset('exhaust@e2e.test', WRONG_CODE).expect(401);
      }

      const response = await confirmReset('exhaust@e2e.test', code).expect(401);

      expect(response.body.message).toBe(CODE_REJECTION);

      await request(httpServer)
        .post('/api/auth/login')
        .send({ email: 'exhaust@e2e.test', password: PASSWORD })
        .expect(200);
    });

    it('should count concurrent wrong attempts atomically', async () => {
      const user = await createUser('race@e2e.test');
      const code = await issueResetCode(user.id, 'race@e2e.test');

      // supertest listens on an ephemeral port per request, which is unsafe when requests overlap.
      await ctx.app.listen(0);

      await Promise.all(
        Array.from({ length: 10 }, () => confirmReset('race@e2e.test', WRONG_CODE).expect(401)),
      );

      await confirmReset('race@e2e.test', code).expect(401);
    });

    it('should reject an expired code and not recreate its key', async () => {
      const user = await createUser('expired@e2e.test');
      const code = await issueResetCode(user.id, 'expired@e2e.test');
      await valkey.pexpire(`identity:reset-code:${user.id}`, 50);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const response = await confirmReset('expired@e2e.test', code).expect(401);

      expect(response.body.message).toBe(CODE_REJECTION);
      expect(await valkey.exists(`identity:reset-code:${user.id}`)).toBe(0);
    });

    it('should invalidate a previously issued code when a new one is issued', async () => {
      const user = await createUser('reissue@e2e.test');
      const oldCode = await issueResetCode(user.id, 'reissue@e2e.test');
      const newCode = await issueResetCode(user.id, 'reissue@e2e.test');

      if (oldCode !== newCode) {
        await confirmReset('reissue@e2e.test', oldCode).expect(401);
      }

      await confirmReset('reissue@e2e.test', newCode).expect(204);
    });

    it('should answer 422 for a weak password without spending an attempt', async () => {
      const user = await createUser('weak@e2e.test');
      const code = await issueResetCode(user.id, 'weak@e2e.test');

      const response = await confirmReset('weak@e2e.test', code, 'weak').expect(422);

      expect(response.body.message).toContain('A senha deve ter no mínimo 8 caracteres');
      expect(await valkey.hget(`identity:reset-code:${user.id}`, 'attempts')).toBe('0');
    });

    it('should answer 401 for an unknown e-mail', async () => {
      const response = await confirmReset('unknown@e2e.test', '123456').expect(401);

      expect(response.body.message).toBe(CODE_REJECTION);
    });

    it('should answer 401 when no code was ever issued', async () => {
      await createUser('never@e2e.test');

      const response = await confirmReset('never@e2e.test', '123456').expect(401);

      expect(response.body.message).toBe(CODE_REJECTION);
    });

    it('should answer 400 when the code is not six digits long', async () => {
      const response = await confirmReset('short@e2e.test', '123').expect(400);

      expect(response.body.message).toContain('O código deve ter 6 dígitos');
    });
  });

  describe('Log inspection', () => {
    it('should never log the code, the new password or the e-mail body', async () => {
      const user = await createUser('logs@e2e.test');
      ctx.logCapture!.clear();

      const code = await issueResetCode(user.id, 'logs@e2e.test');
      const messages = await ctx.prisma.outboxMessage.findMany();
      const body = (messages[0].payload as { text: string }).text;

      await confirmReset('logs@e2e.test', WRONG_CODE).expect(401);
      await confirmReset('logs@e2e.test', code, 'weak').expect(422);
      await confirmReset('logs@e2e.test', code).expect(204);

      const logged = JSON.stringify(ctx.logCapture!.lines());

      expect(logged).toContain('user.password_reset.completed');
      expect(logged).not.toContain(code);
      expect(logged).not.toContain(NEW_PASSWORD);
      expect(logged).not.toContain(body);
      expect(logged).not.toContain('Use o código abaixo');
    });
  });

  describe('Valkey unavailable', () => {
    it('should keep the password unchanged and answer 503 when Valkey is down on confirmation', async () => {
      const user = await createUser('down-confirm@e2e.test');
      const code = await issueResetCode(user.id, 'down-confirm@e2e.test');
      const before = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      // Closing the inspector first: a client left reconnecting to a stopped container keeps Jest alive.
      await valkey.quit();
      await ctx.valkeyContainer.stop();

      const response = await confirmReset('down-confirm@e2e.test', code).expect(503);

      const after = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });

      expect(response.body.message).toBe(RESET_UNAVAILABLE);
      expect(after.passwordHash).toBe(before.passwordHash);
      expect(after.passwordChangedAt).toEqual(before.passwordChangedAt);
    });

    it('should answer 503 with the reset message and an empty outbox when issuing with Valkey down', async () => {
      const user = await createUser('down-issue@e2e.test');
      await ctx.prisma.outboxMessage.deleteMany();

      const response = await request(httpServer)
        .post(`/api/users/${user.id}/password-resets`)
        .set('Authorization', admin)
        .expect(503);

      expect(response.body.message).toBe(RESET_UNAVAILABLE);
      expect(await ctx.prisma.outboxMessage.count()).toBe(0);
    });
  });
});
