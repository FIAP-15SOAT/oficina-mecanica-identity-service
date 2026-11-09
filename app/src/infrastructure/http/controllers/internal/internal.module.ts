import { Module } from '@nestjs/common';

import { InfrastructureServicesModule } from '@infrastructure/services/infrastructure-services.module';

import { AuthenticateCustomerCredentialUseCase } from '@application/use-cases/auth/authenticate-customer-credential.use-case';
import { EnsureCustomerUserUseCase } from '@application/use-cases/user/ensure-customer-user.use-case';
import { FindUserByIdUseCase } from '@application/use-cases/user/find-user-by-id.use-case';

import { IUnitOfWork } from '@domain/interfaces/repositories/unit-of-work.interface';
import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';
import { ICache } from '@application/ports/output/services/cache.service.interface';
import { IHashService } from '@application/ports/output/services/hash.service.interface';
import { ILogger } from '@application/ports/output/services/logger.service.interface';

import { InternalUserController as InternalUserCleanController } from '@interface-adapters/user/internal-user.controller';
import { InternalUserController } from './internal-user.controller';

@Module({
  imports: [InfrastructureServicesModule],
  controllers: [InternalUserController],
  providers: [
    {
      provide: InternalUserCleanController,
      useFactory: (
        unitOfWork: IUnitOfWork,
        userRepository: IUserRepository,
        cache: ICache,
        hashService: IHashService,
        logger: ILogger,
      ) =>
        new InternalUserCleanController(
          new FindUserByIdUseCase(userRepository, cache),
          new EnsureCustomerUserUseCase(
            unitOfWork,
            hashService,
            logger.forContext(EnsureCustomerUserUseCase.name),
          ),
          new AuthenticateCustomerCredentialUseCase(
            userRepository,
            hashService,
            logger.forContext(AuthenticateCustomerCredentialUseCase.name),
          ),
        ),
      inject: ['IUnitOfWork', 'IUserRepository', 'ICache', 'IHashService', 'ILogger'],
    },
  ],
})
export class InternalModule {}
