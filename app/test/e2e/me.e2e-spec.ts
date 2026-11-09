import { randomUUID } from 'node:crypto';
import type { Server } from 'http';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import request from 'supertest';

import { identityCacheKeys } from '@application/keys/identity-cache-keys';
import { PASSWORD_REQUIREMENTS_MESSAGE } from '@domain/constants/validation/user.constants';
import { UserRole } from '@domain/enums/user-role.enum';

import { signTestCustomerToken } from '../helpers/customer-jwt.helper';
import { signTestStaffToken } from '../helpers/staff-jwt.helper';
import { TestContext, setupTestApp, teardownTestApp } from '../helpers/test-app.helper';
import { WorkOrderStub, startWorkOrderStub, stubUserCustomers } from '../helpers/work-order-stub';
import { readInternalUserCustomersFixture } from '../helpers/work-order-user-customers-gateway-mock.factory';

const PASSWORD = 'Senha@123';
const NEW_PASSWORD = 'NovaSenha@456';
const CUSTOMERS_UNAVAILABLE =
  'Não foi possível carregar os clientes vinculados agora. Tente novamente em instantes';

describe('Me (E2E)', () => {
  let stub: WorkOrderStub;
  let ctx: TestContext;
  let httpServer: Server;
  let valkey: Redis;

  const company = readInternalUserCustomersFixture().data.find(({ type }) => type === 'COMPANY')!;

  async function createUser(role: UserRole | null) {
    return ctx.prisma.user.create({
      data: {
        name: 'Maria Souza',
        email: `maria.${randomUUID()}@email.com`,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        role,
        passwordChangedAt: new Date(0),
      },
    });
  }

  function staffTokenFor(user: { id: string; email: string; role: string | null }): string {
    return `Bearer ${signTestStaffToken({ sub: user.id, email: user.email, role: user.role })}`;
  }

  function customerTokenFor(user: { id: string }): string {
    return `Bearer ${signTestCustomerToken(user.id)}`;
  }

  beforeAll(async () => {
    stub = await startWorkOrderStub();
    ctx = await setupTestApp({ workOrderUrl: stub.url });
    httpServer = ctx.httpServer;
    valkey = new Redis(ctx.valkeyContainer.getConnectionUrl());
  });

  afterAll(async () => {
    valkey.disconnect();
    await teardownTestApp(ctx);
    await stub.close();
  });

  beforeEach(async () => {
    stub.customersByUserId.clear();
    stub.failures.clear();
    await valkey.flushall();
    await ctx.prisma.user.deleteMany();
  });

  describe('GET /api/me', () => {
    it('should return the staff profile with only the linked company', async () => {
      const user = await createUser(UserRole.ATTENDANT);
      stubUserCustomers(stub, user.id);

      const response = await request(httpServer)
        .get('/api/me')
        .set('Authorization', staffTokenFor(user))
        .expect(200);

      expect(response.body).toEqual({
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: UserRole.ATTENDANT,
          customers: [{ id: company.id, name: company.name, type: 'COMPANY' }],
        },
      });
    });

    it('should return the customer profile with only the linked company', async () => {
      const user = await createUser(null);
      stubUserCustomers(stub, user.id);

      const response = await request(httpServer)
        .get('/api/me')
        .set('Authorization', customerTokenFor(user))
        .expect(200);

      expect(response.body).toEqual({
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: null,
          customers: [{ id: company.id, name: company.name, type: 'COMPANY' }],
        },
      });
    });

    it('should return an empty customer list for a user without links', async () => {
      const user = await createUser(UserRole.ADMIN);

      const response = await request(httpServer)
        .get('/api/me')
        .set('Authorization', staffTokenFor(user))
        .expect(200);

      expect(response.body.data.customers).toEqual([]);
    });

    it.each([
      ['does not answer', 'drop' as const],
      ['answers 500', 500],
      ['answers 404', 404],
    ])('should return 503 when the work order %s', async (_case, failure) => {
      const user = await createUser(UserRole.ADMIN);
      stub.failures.set(user.id, failure);

      const response = await request(httpServer)
        .get('/api/me')
        .set('Authorization', staffTokenFor(user))
        .expect(503);

      expect(response.body).toMatchObject({ statusCode: 503, message: CUSTOMERS_UNAVAILABLE });
    });

    it('should return 404 for a token of a deleted user', async () => {
      const deletedUserId = randomUUID();

      const response = await request(httpServer)
        .get('/api/me')
        .set('Authorization', customerTokenFor({ id: deletedUserId }))
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        message: `Usuário não encontrado(a) com identificador: ${deletedUserId}`,
      });
    });

    it('should return 401 without a token', async () => {
      await request(httpServer).get('/api/me').expect(401);
    });
  });

  it('should return 401 for a customer token on a staff route', async () => {
    const user = await createUser(null);

    const response = await request(httpServer)
      .get('/api/users')
      .set('Authorization', customerTokenFor(user))
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'Token de autenticação inválido ou ausente',
    });
  });

  describe('PATCH /api/me/password', () => {
    it('should let a customer change the password and invalidate the cached user', async () => {
      const user = await createUser(null);
      await request(httpServer).get('/api/me').set('Authorization', customerTokenFor(user));

      expect(await valkey.exists(identityCacheKeys.user(user.id))).toBe(1);

      await request(httpServer)
        .patch('/api/me/password')
        .set('Authorization', customerTokenFor(user))
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
        .expect(204);

      const updated = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });

      expect(await bcrypt.compare(NEW_PASSWORD, updated.passwordHash)).toBe(true);
      expect(updated.passwordChangedAt.getTime()).toBeGreaterThan(0);
      expect(await valkey.exists(identityCacheKeys.user(user.id))).toBe(0);
    });

    it('should let a staff user change the password', async () => {
      const user = await createUser(UserRole.MECHANIC);

      await request(httpServer)
        .patch('/api/me/password')
        .set('Authorization', staffTokenFor(user))
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
        .expect(204);

      const updated = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });

      expect(await bcrypt.compare(NEW_PASSWORD, updated.passwordHash)).toBe(true);
    });

    it.each([
      [401, 'Senha atual incorreta', { currentPassword: 'Errada@123', newPassword: NEW_PASSWORD }],
      [
        409,
        'A nova senha não pode ser igual à senha atual',
        { currentPassword: PASSWORD, newPassword: PASSWORD },
      ],
    ])('should return %i with "%s" and keep the password', async (status, message, body) => {
      const user = await createUser(null);

      const response = await request(httpServer)
        .patch('/api/me/password')
        .set('Authorization', customerTokenFor(user))
        .send(body)
        .expect(status);

      const unchanged = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });

      expect(response.body).toMatchObject({ statusCode: status, message });
      expect(unchanged.passwordHash).toBe(user.passwordHash);
    });

    it.each([
      ['a weak', 'fracasenha'],
      ['a short', 'Ab@1'],
    ])('should return 422 with the strength message for %s new password', async (_case, weak) => {
      const user = await createUser(UserRole.ADMIN);

      const response = await request(httpServer)
        .patch('/api/me/password')
        .set('Authorization', staffTokenFor(user))
        .send({ currentPassword: PASSWORD, newPassword: weak })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        message: PASSWORD_REQUIREMENTS_MESSAGE,
      });
    });

    it('should return 400 without the current password', async () => {
      const user = await createUser(UserRole.ADMIN);

      const response = await request(httpServer)
        .patch('/api/me/password')
        .set('Authorization', staffTokenFor(user))
        .send({ newPassword: NEW_PASSWORD })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining(['A senha atual deve ser um texto']),
      );
    });

    it('should return 401 without a token', async () => {
      await request(httpServer)
        .patch('/api/me/password')
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
        .expect(401);
    });
  });
});
