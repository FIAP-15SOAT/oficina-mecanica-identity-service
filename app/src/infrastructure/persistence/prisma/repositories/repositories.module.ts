import { Global, Module } from '@nestjs/common';

import { PrismaUnitOfWork } from './prisma-unit-of-work';

const REPOSITORY_PROVIDERS = [{ provide: 'IUnitOfWork', useClass: PrismaUnitOfWork }];

@Global()
@Module({
  providers: REPOSITORY_PROVIDERS,
  exports: REPOSITORY_PROVIDERS,
})
export class RepositoriesModule {}
