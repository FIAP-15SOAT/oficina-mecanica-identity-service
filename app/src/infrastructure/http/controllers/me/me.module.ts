import { Module } from '@nestjs/common';

import { InfrastructureServicesModule } from '@infrastructure/services/infrastructure-services.module';

import { ChangeOwnPasswordUseCase } from '@application/use-cases/me/change-own-password.use-case';
import { GetUserProfileUseCase } from '@application/use-cases/me/get-user-profile.use-case';
import { FindUserByIdUseCase } from '@application/use-cases/user/find-user-by-id.use-case';

import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';
import { IWorkOrderUserCustomersGateway } from '@application/ports/output/gateways/work-order/work-order-user-customers-gateway.interface';
import { ICache } from '@application/ports/output/services/cache.service.interface';
import { IHashService } from '@application/ports/output/services/hash.service.interface';
import { ILogger } from '@application/ports/output/services/logger.service.interface';

import { MeController as MeCleanController } from '@interface-adapters/me/me.controller';
import { MeController } from './me.controller';

@Module({
  imports: [InfrastructureServicesModule],
  controllers: [MeController],
  providers: [
    {
      provide: MeCleanController,
      useFactory: (
        userRepository: IUserRepository,
        hashService: IHashService,
        cache: ICache,
        logger: ILogger,
        workOrderUserCustomersGateway: IWorkOrderUserCustomersGateway,
      ) =>
        new MeCleanController(
          new ChangeOwnPasswordUseCase(
            userRepository,
            hashService,
            cache,
            logger.forContext(ChangeOwnPasswordUseCase.name),
          ),
          new GetUserProfileUseCase(
            new FindUserByIdUseCase(userRepository, cache),
            workOrderUserCustomersGateway,
          ),
        ),
      inject: [
        'IUserRepository',
        'IHashService',
        'ICache',
        'ILogger',
        'IWorkOrderUserCustomersGateway',
      ],
    },
  ],
})
export class MeModule {}
