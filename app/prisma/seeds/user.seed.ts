/* eslint-disable no-console */
import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '../generated/client';
import { SEED_IDS } from './seed-ids';

const SALT_ROUNDS = 12;
const DEFAULT_PASSWORD = 'Tech@2026';

interface UserSeed {
  name: string;
  email: string;
  role: UserRole | null;
  cpf?: string;
}

const users: UserSeed[] = [
  {
    name: 'Guilherme da Rocha Salvador',
    email: 'guilhermedarochasalvador@gmail.com',
    role: UserRole.ADMIN,
  },
  {
    name: 'Lucas Almeida da Silva',
    email: 'lucas.almeida-silva@hotmail.com',
    role: UserRole.ADMIN,
  },
  {
    name: 'Ramoon Lincoln Barros Camacho',
    email: 'ramooncamacho@hotmail.com',
    role: UserRole.ADMIN,
  },
  {
    name: 'Renan Santana Camacho',
    email: 'camacho.renan@gmail.com',
    role: UserRole.ADMIN,
  },
  {
    name: 'João da Silva',
    email: 'joao.silva@email.com',
    role: null,
    cpf: '12345678909',
  },
  {
    name: 'Maria Souza',
    email: 'maria.souza@email.com',
    role: null,
    cpf: '98765432100',
  },
];

export async function seedUsers(prisma: PrismaClient): Promise<void> {
  console.log('Seeding users...');

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  // Skips any conflict (id, email, cpf): a re-seed must never overwrite or fail on edited rows.
  const { count } = await prisma.user.createMany({
    data: users.map((user) => ({
      id: SEED_IDS.users[user.email],
      name: user.name,
      email: user.email,
      passwordHash,
      role: user.role,
      cpf: user.cpf ?? null,
      isActive: true,
    })),
    skipDuplicates: true,
  });

  console.log(`${count} of ${users.length} users created`);
}
