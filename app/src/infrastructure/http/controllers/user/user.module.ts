import { Module } from '@nestjs/common';

import { InfrastructureServicesModule } from '@infrastructure/services/infrastructure-services.module';

import { CreateUserUseCase } from '@application/use-cases/user/create-user.use-case';
import { DeleteUserUseCase } from '@application/use-cases/user/delete-user.use-case';
import { FindAllUsersUseCase } from '@application/use-cases/user/find-all-users.use-case';
import { FindUserByIdUseCase } from '@application/use-cases/user/find-user-by-id.use-case';
import { UpdateUserStatusUseCase } from '@application/use-cases/user/update-user-status.use-case';
import { UpdateUserUseCase } from '@application/use-cases/user/update-user.use-case';

import { IUnitOfWork } from '@domain/interfaces/repositories/unit-of-work.interface';
import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';
import { ICache } from '@application/ports/output/services/cache.service.interface';
import { IHashService } from '@application/ports/output/services/hash.service.interface';
import { ILogger } from '@application/ports/output/services/logger.service.interface';

import { UserController as UserCleanController } from '@interface-adapters/user/user.controller';
import { UserController } from './user.controller';

@Module({
  imports: [InfrastructureServicesModule],
  controllers: [UserController],
  providers: [
    {
      provide: UserCleanController,
      useFactory: (
        unitOfWork: IUnitOfWork,
        userRepository: IUserRepository,
        cache: ICache,
        hashService: IHashService,
        logger: ILogger,
      ) =>
        new UserCleanController(
          new CreateUserUseCase(unitOfWork, hashService),
          new FindUserByIdUseCase(userRepository, cache),
          new FindAllUsersUseCase(userRepository),
          new UpdateUserUseCase(userRepository, cache),
          new UpdateUserStatusUseCase(
            userRepository,
            cache,
            logger.forContext(UpdateUserStatusUseCase.name),
          ),
          new DeleteUserUseCase(userRepository, cache),
        ),
      inject: ['IUnitOfWork', 'IUserRepository', 'ICache', 'IHashService', 'ILogger'],
    },
  ],
})
export class UserModule {}
