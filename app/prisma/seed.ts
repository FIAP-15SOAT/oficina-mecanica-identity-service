/* eslint-disable no-console */
import 'dotenv/config';
import { PrismaClient } from './generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { seedUsers } from './seeds/user.seed';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  console.log('Starting database seed...\n');

  await seedUsers(prisma);

  console.log('\nSeed completed successfully');
}

main()
  .catch((e: Error) => {
    console.error('Seed failed:', e.message);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
