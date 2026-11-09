import { randomUUID } from 'node:crypto';
import { User } from '@domain/entities/user.entity';
import { UserRole } from '@domain/enums/user-role.enum';
import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';
import { Email } from '@domain/value-objects/email.vo';

export function createMockPrismaUser(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: randomUUID(),
    name: 'John Doe',
    email: 'john.doe@example.com',
    passwordHash: '$2b$10$hashedpassword',
    role: UserRole.ATTENDANT,
    cpf: null,
    isActive: true,
    passwordChangedAt: new Date(0),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockUser(overrides: Partial<User> = {}): User {
  const now = new Date();

  return User.reconstitute({
    id: randomUUID(),
    name: 'John Doe',
    email: Email.create('john.doe@example.com'),
    passwordHash: '$2b$10$hashedpassword',
    role: UserRole.ATTENDANT,
    cpf: null,
    isActive: true,
    passwordChangedAt: new Date(0),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

export function createMockUserRepository(): jest.Mocked<IUserRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByCpf: jest.fn(),
    findAllPaginated: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}
