import { randomUUID } from 'node:crypto';
import { Prisma } from '@generated/client';

import { ResourceConflictException } from '@application/exceptions/resource-conflict.exception';
import { User } from '@domain/entities/user.entity';
import { UserRole } from '@domain/enums/user-role.enum';
import { Email } from '@domain/value-objects/email.vo';
import { Cpf } from '@domain/value-objects/cpf.vo';

import { PrismaUserRepository } from '@infrastructure/persistence/prisma/repositories/prisma-user.repository';

import {
  createMockPrismaClient,
  MockPrismaService,
} from '../../../../../helpers/prisma-mock.factory';

import { createMockPrismaUser } from '../../../../../helpers/user-mock.factory';

describe('PrismaUserRepository', () => {
  let repository: PrismaUserRepository;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaClient();
    repository = new PrismaUserRepository(prisma);
  });

  describe('create', () => {
    it('should create a user and return domain entity', async () => {
      const user = User.create({
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        passwordHash: '$2b$10$hashedpassword',
        role: UserRole.MECHANIC,
      });

      const prismaModel = createMockPrismaUser({
        name: user.name,
        email: user.email.value,
        passwordHash: user.passwordHash,
        role: user.role,
        isActive: user.isActive,
      });

      prisma.user.create.mockResolvedValue(prismaModel);

      const result = await repository.create(user);

      expect(result).toEqual(
        User.reconstitute({
          id: prismaModel.id,
          name: prismaModel.name,
          email: Email.create(prismaModel.email),
          passwordHash: prismaModel.passwordHash,
          role: prismaModel.role,
          cpf: prismaModel.cpf,
          isActive: prismaModel.isActive,
          passwordChangedAt: prismaModel.passwordChangedAt,
          createdAt: prismaModel.createdAt,
          updatedAt: prismaModel.updatedAt,
        }),
      );

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          name: user.name,
          email: user.email.value,
          cpf: user.cpf?.value ?? null,
          passwordHash: user.passwordHash,
          role: user.role,
          isActive: user.isActive,
          passwordChangedAt: user.passwordChangedAt,
        },
      });
    });

    it('should throw ResourceConflictException on P2002', async () => {
      const user = User.create({
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        passwordHash: '$2b$10$hashedpassword',
        role: UserRole.MECHANIC,
      });

      const error = new Prisma.PrismaClientKnownRequestError('Duplicate email', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      prisma.user.create.mockRejectedValue(error);

      await expect(repository.create(user)).rejects.toThrow(ResourceConflictException);
      await expect(repository.create(user)).rejects.toThrow('E-mail já cadastrado no sistema');
    });

    it('should report an e-mail conflict when the adapter names the e-mail index', async () => {
      const user = User.create({
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        passwordHash: '$2b$10$hashedpassword',
        role: UserRole.MECHANIC,
      });

      const error = new Prisma.PrismaClientKnownRequestError('Duplicate email', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: {
          driverAdapterError: {
            cause: { kind: 'UniqueConstraintViolation', constraint: { index: 'users_email_key' } },
          },
          modelName: 'User',
        },
      });
      prisma.user.create.mockRejectedValue(error);

      await expect(repository.create(user)).rejects.toThrow('E-mail já cadastrado no sistema');
    });

    it('should report a CPF conflict when the adapter names the CPF index', async () => {
      const user = User.create({
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        passwordHash: '$2b$10$hashedpassword',
        role: UserRole.MECHANIC,
        cpf: '12345678909',
      });

      const error = new Prisma.PrismaClientKnownRequestError('Duplicate cpf', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: {
          driverAdapterError: {
            cause: { kind: 'UniqueConstraintViolation', constraint: { index: 'users_cpf_key' } },
          },
          modelName: 'User',
        },
      });
      prisma.user.create.mockRejectedValue(error);

      await expect(repository.create(user)).rejects.toThrow('CPF já cadastrado');
    });

    it('should report a CPF conflict from the target list when the adapter error is absent', async () => {
      const user = User.create({
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        passwordHash: '$2b$10$hashedpassword',
        role: UserRole.MECHANIC,
        cpf: '12345678909',
      });

      const error = new Prisma.PrismaClientKnownRequestError('Duplicate cpf', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['cpf'] },
      });
      prisma.user.create.mockRejectedValue(error);

      await expect(repository.create(user)).rejects.toThrow('CPF já cadastrado');
    });

    it('should report a CPF conflict from the adapter constraint fields', async () => {
      const user = User.create({
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        passwordHash: '$2b$10$hashedpassword',
        role: UserRole.MECHANIC,
        cpf: '12345678909',
      });

      const error = new Prisma.PrismaClientKnownRequestError('Duplicate cpf', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: {
          driverAdapterError: { cause: { constraint: { fields: ['cpf'] } } },
        },
      });
      prisma.user.create.mockRejectedValue(error);

      await expect(repository.create(user)).rejects.toThrow('CPF já cadastrado');
    });

    it('should rethrow unexpected errors', async () => {
      const user = User.create({
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        passwordHash: '$2b$10$hashedpassword',
        role: UserRole.MECHANIC,
      });

      const error = new Error('Database connection lost');
      prisma.user.create.mockRejectedValue(error);

      await expect(repository.create(user)).rejects.toThrow('Database connection lost');
    });
  });

  describe('findById', () => {
    it('should find a user by id and return domain entity', async () => {
      const id = randomUUID();
      const prismaModel = createMockPrismaUser({ id });

      prisma.user.findUnique.mockResolvedValue(prismaModel);

      const result = await repository.findById(id);

      expect(result).toEqual(
        User.reconstitute({
          id: prismaModel.id,
          name: prismaModel.name,
          email: Email.create(prismaModel.email),
          passwordHash: prismaModel.passwordHash,
          role: prismaModel.role,
          cpf: prismaModel.cpf,
          isActive: prismaModel.isActive,
          passwordChangedAt: prismaModel.passwordChangedAt,
          createdAt: prismaModel.createdAt,
          updatedAt: prismaModel.updatedAt,
        }),
      );

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id } });
    });

    it('should return null when user is not found', async () => {
      const id = randomUUID();

      prisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findById(id);

      expect(result).toBeNull();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id } });
    });
  });

  describe('findByEmail', () => {
    it('should find a user by email and return domain entity', async () => {
      const email = 'john.doe@example.com';
      const prismaModel = createMockPrismaUser({ email });

      prisma.user.findUnique.mockResolvedValue(prismaModel);

      const result = await repository.findByEmail(email);

      expect(result).toEqual(
        User.reconstitute({
          id: prismaModel.id,
          name: prismaModel.name,
          email: Email.create(prismaModel.email),
          passwordHash: prismaModel.passwordHash,
          role: prismaModel.role,
          cpf: prismaModel.cpf,
          isActive: prismaModel.isActive,
          passwordChangedAt: prismaModel.passwordChangedAt,
          createdAt: prismaModel.createdAt,
          updatedAt: prismaModel.updatedAt,
        }),
      );

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email } });
    });

    it('should return null when user is not found', async () => {
      const email = 'nonexistent@example.com';

      prisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findByEmail(email);

      expect(result).toBeNull();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email } });
    });
  });

  describe('findAllPaginated', () => {
    it('should return paginated users without filters', async () => {
      const prismaModels = [createMockPrismaUser({ id: randomUUID(), name: 'User 1' })];

      prisma.user.findMany.mockResolvedValue(prismaModels);
      prisma.user.count.mockResolvedValue(1);

      const result = await repository.findAllPaginated({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return paginated users with role filter', async () => {
      const prismaModels = [createMockPrismaUser({ id: randomUUID(), role: UserRole.ADMIN })];

      prisma.user.findMany.mockResolvedValue(prismaModels);
      prisma.user.count.mockResolvedValue(1);

      const result = await repository.findAllPaginated(
        { page: 1, limit: 10 },
        { role: UserRole.ADMIN },
      );

      expect(result.items).toHaveLength(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { role: UserRole.ADMIN },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return paginated users with name filter', async () => {
      const prismaModels = [createMockPrismaUser({ id: randomUUID(), name: 'Target User' })];

      prisma.user.findMany.mockResolvedValue(prismaModels);
      prisma.user.count.mockResolvedValue(1);

      const result = await repository.findAllPaginated({ page: 1, limit: 10 }, { name: 'Target' });

      expect(result.items).toHaveLength(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          name: { contains: 'Target', mode: 'insensitive' },
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('update', () => {
    it('should update a user and return domain entity', async () => {
      const user = User.reconstitute({
        id: randomUUID(),
        name: 'Updated Name',
        email: Email.create('updated@example.com'),
        passwordHash: '$2b$10$newhash',
        role: UserRole.ADMIN,
        cpf: null,
        isActive: false,
        passwordChangedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updatedPrismaModel = createMockPrismaUser({
        id: user.id,
        name: user.name,
        email: user.email.value,
        passwordHash: user.passwordHash,
        role: user.role,
        isActive: user.isActive,
      });

      prisma.user.update.mockResolvedValue(updatedPrismaModel);

      const result = await repository.update(user);

      expect(result.name).toBe(user.name);
      expect(result.role).toBe(user.role);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: {
          name: user.name,
          email: user.email.value,
          cpf: user.cpf?.value ?? null,
          passwordHash: user.passwordHash,
          role: user.role,
          isActive: user.isActive,
          passwordChangedAt: user.passwordChangedAt,
        },
      });
    });

    it('should throw ResourceConflictException on P2002', async () => {
      const user = User.reconstitute({
        id: randomUUID(),
        name: 'Test',
        email: Email.create('dup@example.com'),
        passwordHash: '$2b$10$hash',
        role: UserRole.MECHANIC,
        cpf: null,
        isActive: true,
        passwordChangedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const error = new Prisma.PrismaClientKnownRequestError('Duplicate email', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      prisma.user.update.mockRejectedValue(error);

      await expect(repository.update(user)).rejects.toThrow(ResourceConflictException);
    });

    it('should report a CPF conflict distinctly from an email conflict on P2002 update', async () => {
      const user = User.reconstitute({
        id: randomUUID(),
        name: 'Test',
        email: Email.create('dup@example.com'),
        passwordHash: '$2b$10$hash',
        role: UserRole.MECHANIC,
        cpf: Cpf.create('12345678909'),
        isActive: true,
        passwordChangedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const error = new Prisma.PrismaClientKnownRequestError('Duplicate cpf', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: {
          driverAdapterError: {
            cause: { kind: 'UniqueConstraintViolation', constraint: { index: 'users_cpf_key' } },
          },
          modelName: 'User',
        },
      });
      prisma.user.update.mockRejectedValue(error);

      await expect(repository.update(user)).rejects.toThrow('CPF já cadastrado para outro usuário');
    });

    it('should rethrow unexpected errors from update', async () => {
      const user = User.reconstitute({
        id: randomUUID(),
        name: 'Test',
        email: Email.create('test@example.com'),
        passwordHash: '$2b$10$hash',
        role: UserRole.MECHANIC,
        cpf: null,
        isActive: true,
        passwordChangedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const unexpectedError = new Error('Database connection lost');
      prisma.user.update.mockRejectedValue(unexpectedError);

      await expect(repository.update(user)).rejects.toThrow('Database connection lost');
    });
  });

  describe('delete', () => {
    it('should delete a user', async () => {
      const id = randomUUID();

      prisma.user.delete.mockResolvedValue(createMockPrismaUser({ id }));

      await repository.delete(id);

      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id } });
    });
  });

  describe('findByCpf', () => {
    it('should return a user when found', async () => {
      const cpf = '12345678909';
      prisma.user.findUnique.mockResolvedValue(createMockPrismaUser({ cpf }));

      const result = await repository.findByCpf(cpf);

      expect(result).toBeDefined();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { cpf } });
    });

    it('should return null when not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findByCpf('12345678909');

      expect(result).toBeNull();
    });
  });
});
