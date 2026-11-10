import { Global, Module } from '@nestjs/common';

import { PrismaUnitOfWork } from './prisma-unit-of-work';
import { PrismaUserRepository } from './prisma-user.repository';

const REPOSITORY_PROVIDERS = [
  { provide: 'IUnitOfWork', useClass: PrismaUnitOfWork },
  { provide: 'IUserRepository', useClass: PrismaUserRepository },
];

@Global()
@Module({
  providers: REPOSITORY_PROVIDERS,
  exports: REPOSITORY_PROVIDERS,
})
export class RepositoriesModule {}
