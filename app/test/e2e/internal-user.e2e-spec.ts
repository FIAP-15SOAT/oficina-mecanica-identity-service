import { randomUUID } from 'node:crypto';
import type { Server } from 'http';
import request from 'supertest';

import { UserRole } from '@domain/enums/user-role.enum';

import { jsonShape, readContractFixture } from '../helpers/contract-fixture.helper';
import { signTestStaffToken } from '../helpers/staff-jwt.helper';
import { TestContext, setupTestApp, teardownTestApp } from '../helpers/test-app.helper';

const MISSING_ID = '00000000-0000-0000-0000-000000000000';
const CPF = '12345678909';
const OTHER_CPF = '98765432100';
const WRONG_CHECK_DIGIT_CPF = '12345678900';
const PASSWORD = 'Senha@123';

describe('Internal user routes (E2E)', () => {
  let ctx: TestContext;
  let httpServer: Server;

  const admin = `Bearer ${signTestStaffToken({
    sub: randomUUID(),
    email: 'admin@e2e.test',
    role: UserRole.ADMIN,
  })}`;

  async function createStaffUser(email: string, name = 'Carlos Mecânico') {
    const response = await request(httpServer)
      .post('/api/users')
      .set('Authorization', admin)
      .send({ name, email, role: 'MECHANIC' })
      .expect(201);

    return response.body.data as { id: string };
  }

  async function defineCustomerPassword(userId: string): Promise<void> {
    const hash = await ctx.app
      .get<{ hash(value: string): Promise<string> }>('IHashService')
      .hash(PASSWORD);

    await ctx.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
  }

  beforeAll(async () => {
    ctx = await setupTestApp({ withSwagger: true });
    httpServer = ctx.httpServer;
  });

  afterAll(async () => {
    await teardownTestApp(ctx);
  });

  beforeEach(async () => {
    await ctx.prisma.outboxMessage.deleteMany();
    await ctx.prisma.user.deleteMany();
  });

  describe('GET /internal/users/:id', () => {
    it('should return the user without a token, matching the contract fixture', async () => {
      const { id } = await createStaffUser('carlos@e2e.test');

      const response = await request(httpServer).get(`/internal/users/${id}`).expect(200);

      expect(response.body).toEqual({
        data: {
          id,
          name: 'Carlos Mecânico',
          email: 'carlos@e2e.test',
          role: 'MECHANIC',
          isActive: true,
        },
      });

      expect(jsonShape(response.body)).toEqual(
        jsonShape(readContractFixture('internal-user.json')),
      );
    });

    it('should reflect a status change on the next read', async () => {
      const { id } = await createStaffUser('status@e2e.test');

      await request(httpServer).get(`/internal/users/${id}`).expect(200);

      await request(httpServer)
        .patch(`/api/users/${id}`)
        .set('Authorization', admin)
        .send({ active: false })
        .expect(200);

      const response = await request(httpServer).get(`/internal/users/${id}`).expect(200);

      expect(response.body.data.isActive).toBe(false);
    });

    it('should return 404 when the user does not exist', async () => {
      const response = await request(httpServer).get(`/internal/users/${MISSING_ID}`).expect(404);

      expect(response.body.message).toBe(
        `Usuário não encontrado(a) com identificador: ${MISSING_ID}`,
      );
    });

    it('should return 400 for an id that is not a UUID', async () => {
      await request(httpServer).get('/internal/users/not-a-uuid').expect(400);
    });

    it('should not list the internal routes in the Swagger document', async () => {
      const response = await request(httpServer).get('/api/docs-json').expect(200);

      expect(Object.keys(response.body.paths).filter((path) => path.includes('/internal'))).toEqual(
        [],
      );
    });
  });

  describe('POST /internal/customer-users', () => {
    const body = { name: 'Maria Cliente', email: 'maria@e2e.test', cpf: CPF };

    it('should create a user without role and keep one e-mail in the outbox, matching the contract fixture', async () => {
      const response = await request(httpServer)
        .post('/internal/customer-users')
        .send(body)
        .expect(200);

      const user = await ctx.prisma.user.findUniqueOrThrow({ where: { cpf: CPF } });
      const outbox = await ctx.prisma.outboxMessage.findMany();

      expect(response.body).toEqual({ data: { userId: user.id, created: true } });

      expect(jsonShape(response.body)).toEqual(
        jsonShape(readContractFixture('internal-customer-user.json')),
      );

      expect(user.role).toBeNull();
      expect(outbox).toHaveLength(1);

      expect(outbox[0].payload).toEqual(
        expect.objectContaining({ to: ['maria@e2e.test'], purpose: 'customer_initial_password' }),
      );
    });

    it('should return the same user id with created false and no second e-mail on a repeated call', async () => {
      const first = await request(httpServer)
        .post('/internal/customer-users')
        .send(body)
        .expect(200);

      const second = await request(httpServer)
        .post('/internal/customer-users')
        .send(body)
        .expect(200);

      expect(second.body).toEqual({ data: { userId: first.body.data.userId, created: false } });
      expect(await ctx.prisma.outboxMessage.count()).toBe(1);
      expect(await ctx.prisma.user.count()).toBe(1);
    });

    it.each([
      ['the CPF exists with the e-mail of another user', CPF],
      ['a new CPF comes with the e-mail of another user', OTHER_CPF],
    ])('should return 409 and write nothing when %s', async (_case, cpf) => {
      await request(httpServer).post('/internal/customer-users').send(body).expect(200);
      await createStaffUser('dono@e2e.test');
      const before = await ctx.prisma.outboxMessage.count();

      const response = await request(httpServer)
        .post('/internal/customer-users')
        .send({ name: 'Maria Cliente', email: 'dono@e2e.test', cpf })
        .expect(409);

      expect(response.body.message).toBe(
        'O e-mail informado já pertence a outro usuário. Verifique o cadastro do cliente',
      );
      expect(await ctx.prisma.outboxMessage.count()).toBe(before);
      expect(await ctx.prisma.user.count()).toBe(2);
    });

    it.each([
      ['a wrong check digit', WRONG_CHECK_DIGIT_CPF],
      ['repeated digits', '11111111111'],
    ])('should return 422 for a CPF with %s', async (_case, cpf) => {
      const response = await request(httpServer)
        .post('/internal/customer-users')
        .send({ ...body, cpf })
        .expect(422);

      expect(response.body.message).toBe('CPF inválido');
      expect(await ctx.prisma.user.count()).toBe(0);
    });

    it.each([
      ['O CPF é obrigatório', { name: body.name, email: body.email }],
      ['O CPF deve ser um texto', { ...body, cpf: 12345678909 }],
      ['O nome é obrigatório', { email: body.email, cpf: CPF, name: '' }],
      ['E-mail inválido', { ...body, email: 'not-an-email' }],
    ])('should return 400 with "%s" for an invalid body', async (message, invalidBody) => {
      const response = await request(httpServer)
        .post('/internal/customer-users')
        .send(invalidBody)
        .expect(400);

      expect(JSON.stringify(response.body.message)).toContain(message);
    });
  });

  describe('POST /internal/customer-authentications', () => {
    async function createCustomerWithPassword(): Promise<string> {
      const response = await request(httpServer)
        .post('/internal/customer-users')
        .send({ name: 'Maria Cliente', email: 'maria@e2e.test', cpf: CPF })
        .expect(200);

      const userId = response.body.data.userId as string;

      await defineCustomerPassword(userId);

      return userId;
    }

    it('should return the user id for a valid credential, matching the contract fixture', async () => {
      const userId = await createCustomerWithPassword();

      const response = await request(httpServer)
        .post('/internal/customer-authentications')
        .send({ cpf: '123.456.789-09', password: PASSWORD })
        .expect(200);

      expect(response.body).toEqual({ data: { userId } });

      expect(jsonShape(response.body)).toEqual(
        jsonShape(readContractFixture('internal-customer-authentication.json')),
      );
    });

    it('should accept a user with an internal role', async () => {
      const userId = await createCustomerWithPassword();
      await ctx.prisma.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });

      const response = await request(httpServer)
        .post('/internal/customer-authentications')
        .send({ cpf: CPF, password: PASSWORD })
        .expect(200);

      expect(response.body).toEqual({ data: { userId } });
    });

    it('should return the same 401 body for every refusal reason', async () => {
      const userId = await createCustomerWithPassword();

      const wrongPassword = await request(httpServer)
        .post('/internal/customer-authentications')
        .send({ cpf: CPF, password: 'Outra@123' })
        .expect(401);

      const unknownCpf = await request(httpServer)
        .post('/internal/customer-authentications')
        .send({ cpf: OTHER_CPF, password: PASSWORD })
        .expect(401);

      const invalidCpf = await request(httpServer)
        .post('/internal/customer-authentications')
        .send({ cpf: WRONG_CHECK_DIGIT_CPF, password: PASSWORD })
        .expect(401);

      await ctx.prisma.user.update({ where: { id: userId }, data: { isActive: false } });

      const inactive = await request(httpServer)
        .post('/internal/customer-authentications')
        .send({ cpf: CPF, password: PASSWORD })
        .expect(401);

      expect(wrongPassword.body.message).toBe('Credenciais inválidas');
      expect(unknownCpf.body).toEqual(wrongPassword.body);
      expect(invalidCpf.body).toEqual(wrongPassword.body);
      expect(inactive.body).toEqual(wrongPassword.body);
    });

    it.each([
      ['O CPF é obrigatório', { password: PASSWORD }],
      ['A senha é obrigatória', { cpf: CPF }],
      ['O CPF deve ser um texto', { cpf: 12345678909, password: PASSWORD }],
      ['A senha deve ser um texto', { cpf: CPF, password: 123456 }],
    ])('should return 400 with "%s" for a malformed body', async (message, invalidBody) => {
      const response = await request(httpServer)
        .post('/internal/customer-authentications')
        .send(invalidBody)
        .expect(400);

      expect(JSON.stringify(response.body.message)).toContain(message);
    });
  });
});
