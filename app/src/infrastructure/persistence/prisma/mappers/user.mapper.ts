import { User as PrismaUser } from '@generated/client';
import { User } from '@domain/entities/user.entity';
import { UserRole } from '@domain/enums/user-role.enum';
import { Email } from '@domain/value-objects/email.vo';
import { Cpf } from '@domain/value-objects/cpf.vo';

export class UserMapper {
  static toDomain(record: PrismaUser): User {
    return User.reconstitute({
      id: record.id,
      name: record.name,
      email: Email.create(record.email),
      passwordHash: record.passwordHash,
      role: record.role as UserRole | null,
      cpf: record.cpf ? Cpf.create(record.cpf) : null,
      isActive: record.isActive,
      passwordChangedAt: record.passwordChangedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
