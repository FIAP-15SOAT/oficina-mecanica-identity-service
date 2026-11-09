import { Injectable } from '@nestjs/common';
import { Prisma, User as PrismaUser } from '@generated/client';

import { PrismaService } from '../prisma.service';

import { ResourceConflictException } from '@application/exceptions/resource-conflict.exception';

import { User } from '@domain/entities/user.entity';
import {
  IUserRepository,
  UserFilters,
} from '@domain/interfaces/repositories/user.repository.interface';
import {
  PaginatedRepositoryResult,
  PaginationInput,
} from '@domain/interfaces/common/pagination.interface';

import { UserMapper } from '../mappers/user.mapper';
import { paginate } from '../helpers/prisma-paginate.helper';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: User): Promise<User> {
    try {
      const created = await this.prisma.user.create({
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

      return UserMapper.toDomain(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ResourceConflictException(
          conflictingField(error) === 'cpf'
            ? 'CPF já cadastrado'
            : 'E-mail já cadastrado no sistema',
        );
      }
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });

    if (!record) return null;

    return UserMapper.toDomain(record);
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { email } });

    if (!record) return null;

    return UserMapper.toDomain(record);
  }

  async findByCpf(cpf: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { cpf } });

    if (!record) return null;

    return UserMapper.toDomain(record);
  }

  async findAllPaginated(
    pagination: PaginationInput,
    filters?: UserFilters,
  ): Promise<PaginatedRepositoryResult<User>> {
    const where: Prisma.UserWhereInput = {};

    if (filters?.role) {
      where.role = filters.role;
    }

    if (filters?.name) {
      where.name = { contains: filters.name.trim(), mode: 'insensitive' };
    }

    const result = await paginate(
      this.prisma.user,
      {
        where,
        orderBy: { createdAt: 'desc' },
      },
      pagination,
    );

    return {
      items: result.items.map((record: PrismaUser) => UserMapper.toDomain(record)),
      total: result.total,
    };
  }

  async update(user: User): Promise<User> {
    try {
      const updated = await this.prisma.user.update({
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

      return UserMapper.toDomain(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ResourceConflictException(
          conflictingField(error) === 'cpf'
            ? 'CPF já cadastrado para outro usuário'
            : 'E-mail já cadastrado para outro usuário',
        );
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}

type AdapterConstraint = { index?: string; fields?: string[] };

// Prisma 7 with the pg adapter reports the violated constraint under meta.driverAdapterError
// (index name such as users_cpf_key) and no longer sends meta.target.
function conflictingField(error: Prisma.PrismaClientKnownRequestError): string | undefined {
  const meta = error.meta as
    | {
        target?: string | string[];
        driverAdapterError?: { cause?: { constraint?: AdapterConstraint } };
      }
    | undefined;
  const constraint = meta?.driverAdapterError?.cause?.constraint;

  if (constraint?.fields?.length) return constraint.fields[0];
  if (constraint?.index) return constraint.index.includes('cpf') ? 'cpf' : 'email';

  const target = meta?.target;

  if (Array.isArray(target)) return target[0];

  return target;
}
