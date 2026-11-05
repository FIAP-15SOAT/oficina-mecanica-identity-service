import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaUnitOfWork } from './repositories/prisma-unit-of-work';

const UNIT_OF_WORK_PROVIDER = { provide: 'IUnitOfWork', useClass: PrismaUnitOfWork };

@Global()
@Module({
  providers: [PrismaService, UNIT_OF_WORK_PROVIDER],
  exports: [PrismaService, UNIT_OF_WORK_PROVIDER],
})
export class PrismaModule {}
