import { randomUUID } from 'node:crypto';
import type { Server } from 'http';
import request from 'supertest';

import { UserRole } from '@domain/enums/user-role.enum';

import { signTestStaffToken } from '../helpers/staff-jwt.helper';
import { TestContext, setupTestApp, teardownTestApp } from '../helpers/test-app.helper';

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

function bearer(role: UserRole): string {
  return `Bearer ${signTestStaffToken({ sub: randomUUID(), email: 'actor@e2e.test', role })}`;
}

describe('User (E2E)', () => {
  let ctx: TestContext;
  let httpServer: Server;
  let admin: string;

  async function createUser(email: string, role = 'MECHANIC', name = 'Usuário de Teste') {
    const response = await request(httpServer)
      .post('/api/users')
      .set('Authorization', admin)
      .send({ name, email, role })
      .expect(201);

    return response.body.data as { id: string; name: string; email: string };
  }

  beforeAll(async () => {
    ctx = await setupTestApp();
    httpServer = ctx.httpServer;
  });

  afterAll(async () => {
    await teardownTestApp(ctx);
  });

  beforeEach(async () => {
    await ctx.prisma.outboxMessage.deleteMany();
    await ctx.prisma.user.deleteMany();

    admin = bearer(UserRole.ADMIN);
  });

  describe('POST /api/users', () => {
    it('should create a user and return 201 without any credential', async () => {
      const response = await request(httpServer)
        .post('/api/users')
        .set('Authorization', admin)
        .send({ name: 'Novo Usuário', email: 'novo@e2e.test', role: 'MECHANIC' })
        .expect(201);

      expect(response.body.data).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: 'Novo Usuário',
          email: 'novo@e2e.test',
          role: 'MECHANIC',
          isActive: true,
        }),
      );

      expect(response.body.data).not.toHaveProperty('password');
      expect(response.body.data).not.toHaveProperty('passwordHash');
    });

    it('should list the staff initial password e-mail in the outbox', async () => {
      await createUser('outbox@e2e.test');

      const messages = await ctx.prisma.outboxMessage.findMany();

      expect(messages).toHaveLength(1);

      expect(messages[0]).toMatchObject({
        type: 'notification.email.send',
        workOrderId: null,
        payload: expect.objectContaining({
          to: ['outbox@e2e.test'],
          purpose: 'staff_initial_password',
        }),
      });
    });

    it('should return 409 with the CPF message when the CPF belongs to another user', async () => {
      await request(httpServer)
        .post('/api/users')
        .set('Authorization', admin)
        .send({ name: 'User A', email: 'cpf-a@e2e.test', role: 'MECHANIC', cpf: '12345678909' })
        .expect(201);

      const response = await request(httpServer)
        .post('/api/users')
        .set('Authorization', admin)
        .send({ name: 'User B', email: 'cpf-b@e2e.test', role: 'MECHANIC', cpf: '12345678909' })
        .expect(409);

      expect(response.body.message).toBe('CPF já cadastrado');
    });

    it('should return 409 and keep a single outbox message when the e-mail is duplicated', async () => {
      await createUser('dup@e2e.test');

      const response = await request(httpServer)
        .post('/api/users')
        .set('Authorization', admin)
        .send({ name: 'User B', email: 'dup@e2e.test', role: 'MECHANIC' })
        .expect(409);

      expect(response.body.message).toBe('E-mail já cadastrado no sistema');
      expect(await ctx.prisma.outboxMessage.count()).toBe(1);
    });

    it.each([
      ['a name shorter than the minimum', { name: 'ab', email: 'a@e2e.test', role: 'MECHANIC' }],
      [
        'a name longer than the maximum',
        { name: 'a'.repeat(151), email: 'b@e2e.test', role: 'MECHANIC' },
      ],
      ['an invalid e-mail', { name: 'Valid Name', email: 'notanemail', role: 'MECHANIC' }],
      ['an invalid role', { name: 'Valid Name', email: 'c@e2e.test', role: 'INVALID' }],
      [
        'a password field',
        { name: 'Valid Name', email: 'd@e2e.test', role: 'MECHANIC', password: 'Senha@123' },
      ],
    ])('should return 400 with %s', async (_description, body) => {
      await request(httpServer)
        .post('/api/users')
        .set('Authorization', admin)
        .send(body)
        .expect(400);
    });

    it('should return 401 without a token', async () => {
      await request(httpServer).post('/api/users').send({}).expect(401);
    });
  });

  describe('role matrix', () => {
    it.each([UserRole.MECHANIC, UserRole.ATTENDANT])(
      'should return 403 on every user route for %s',
      async (role) => {
        const authorization = bearer(role);

        await request(httpServer)
          .post('/api/users')
          .set('Authorization', authorization)
          .send({})
          .expect(403);
        await request(httpServer).get('/api/users').set('Authorization', authorization).expect(403);
        await request(httpServer)
          .get(`/api/users/${MISSING_ID}`)
          .set('Authorization', authorization)
          .expect(403);
        await request(httpServer)
          .put(`/api/users/${MISSING_ID}`)
          .set('Authorization', authorization)
          .send({})
          .expect(403);
        await request(httpServer)
          .patch(`/api/users/${MISSING_ID}`)
          .set('Authorization', authorization)
          .send({ active: false })
          .expect(403);
        await request(httpServer)
          .delete(`/api/users/${MISSING_ID}`)
          .set('Authorization', authorization)
          .expect(403);
      },
    );
  });

  describe('GET /api/users', () => {
    it('should list users with the default pagination', async () => {
      await createUser('list@e2e.test');

      const response = await request(httpServer)
        .get('/api/users')
        .set('Authorization', admin)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination).toMatchObject({ page: 1, limit: 10, totalRecords: 1 });
    });

    it('should filter users by role and by name', async () => {
      await createUser('mech@e2e.test', 'MECHANIC', 'Carlos Mecânico');
      await createUser('att@e2e.test', 'ATTENDANT', 'Ana Atendente');

      const byRole = await request(httpServer)
        .get('/api/users?role=ATTENDANT')
        .set('Authorization', admin)
        .expect(200);

      const byName = await request(httpServer)
        .get('/api/users?name=Carlos')
        .set('Authorization', admin)
        .expect(200);

      expect(byRole.body.data.map((user: { email: string }) => user.email)).toEqual([
        'att@e2e.test',
      ]);

      expect(byName.body.data.map((user: { email: string }) => user.email)).toEqual([
        'mech@e2e.test',
      ]);
    });

    it('should return 401 without a token', async () => {
      await request(httpServer).get('/api/users').expect(401);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return the user by id', async () => {
      const user = await createUser('find@e2e.test', 'MECHANIC', 'Find Me');

      const response = await request(httpServer)
        .get(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .expect(200);

      expect(response.body.data).toMatchObject({ id: user.id, name: 'Find Me' });
      expect(response.body.data).not.toHaveProperty('passwordHash');
      expect(response.body.data).not.toHaveProperty('customers');
    });

    it('should return 404 with the standard message for a missing user', async () => {
      const response = await request(httpServer)
        .get(`/api/users/${MISSING_ID}`)
        .set('Authorization', admin)
        .expect(404);

      expect(response.body.message).toBe(
        `Usuário não encontrado(a) com identificador: ${MISSING_ID}`,
      );
    });

    it('should return 400 for an invalid UUID', async () => {
      await request(httpServer)
        .get('/api/users/not-a-uuid')
        .set('Authorization', admin)
        .expect(400);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update the user data', async () => {
      const user = await createUser('upd@e2e.test', 'ATTENDANT');

      const response = await request(httpServer)
        .put(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .send({ name: 'Updated Name', role: 'MECHANIC', email: 'new@e2e.test' })
        .expect(200);

      expect(response.body.data).toMatchObject({
        name: 'Updated Name',
        role: 'MECHANIC',
        email: 'new@e2e.test',
      });
    });

    it('should return the new name after an update of a cached user', async () => {
      const user = await createUser('cached@e2e.test', 'MECHANIC', 'Nome Antigo');
      await request(httpServer)
        .get(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .expect(200);

      await request(httpServer)
        .put(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .send({ name: 'Nome Novo' })
        .expect(200);

      const response = await request(httpServer)
        .get(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .expect(200);

      expect(response.body.data.name).toBe('Nome Novo');
    });

    it('should return 409 when the e-mail belongs to another user', async () => {
      const user = await createUser('one@e2e.test');
      await createUser('two@e2e.test');

      const response = await request(httpServer)
        .put(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .send({ email: 'two@e2e.test' })
        .expect(409);

      expect(response.body.message).toBe('E-mail já cadastrado no sistema');
    });

    it('should return 404 for a missing user', async () => {
      await request(httpServer)
        .put(`/api/users/${MISSING_ID}`)
        .set('Authorization', admin)
        .send({ name: 'Ghost' })
        .expect(404);
    });

    it('should return 400 for a name longer than the maximum', async () => {
      const user = await createUser('long@e2e.test');

      await request(httpServer)
        .put(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .send({ name: 'a'.repeat(151) })
        .expect(400);
    });

    it('should update keeping the same e-mail', async () => {
      const user = await createUser('same-email@e2e.test');

      const response = await request(httpServer)
        .put(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .send({ email: 'same-email@e2e.test', name: 'Same Email Name' })
        .expect(200);

      expect(response.body.data).toMatchObject({
        name: 'Same Email Name',
        email: 'same-email@e2e.test',
      });
    });

    it('should return 400 for a name shorter than the minimum', async () => {
      const user = await createUser('short@e2e.test');

      await request(httpServer)
        .put(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .send({ name: 'ab' })
        .expect(400);
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('should deactivate and reactivate the user', async () => {
      const user = await createUser('status@e2e.test');

      const deactivated = await request(httpServer)
        .patch(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .send({ active: false })
        .expect(200);

      const reactivated = await request(httpServer)
        .patch(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .send({ active: true })
        .expect(200);

      expect(deactivated.body.data.isActive).toBe(false);
      expect(reactivated.body.data.isActive).toBe(true);
    });

    it('should return the new status after a status change of a cached user', async () => {
      const user = await createUser('statuscache@e2e.test');
      await request(httpServer)
        .get(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .expect(200);

      await request(httpServer)
        .patch(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .send({ active: false })
        .expect(200);

      const response = await request(httpServer)
        .get(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .expect(200);

      expect(response.body.data.isActive).toBe(false);
    });

    it('should return 422 when deactivating an already inactive user', async () => {
      const user = await createUser('inactive@e2e.test');

      await request(httpServer)
        .patch(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .send({ active: false })
        .expect(200);

      await request(httpServer)
        .patch(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .send({ active: false })
        .expect(422);
    });

    it('should return 422 when the user is already in the requested status', async () => {
      const user = await createUser('same@e2e.test');

      await request(httpServer)
        .patch(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .send({ active: true })
        .expect(422);
    });

    it('should return 404 for a missing user', async () => {
      await request(httpServer)
        .patch(`/api/users/${MISSING_ID}`)
        .set('Authorization', admin)
        .send({ active: false })
        .expect(404);
    });

    it('should return 400 when active is not a boolean', async () => {
      const user = await createUser('bool@e2e.test');

      await request(httpServer)
        .patch(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .send({ active: 'yes' })
        .expect(400);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete the user and return 404 afterwards, even if it was cached', async () => {
      const user = await createUser('delete@e2e.test');
      await request(httpServer)
        .get(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .expect(200);

      await request(httpServer)
        .delete(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .expect(204);

      await request(httpServer)
        .get(`/api/users/${user.id}`)
        .set('Authorization', admin)
        .expect(404);
    });

    it('should return 404 for a missing user', async () => {
      await request(httpServer)
        .delete(`/api/users/${MISSING_ID}`)
        .set('Authorization', admin)
        .expect(404);
    });
  });
});
