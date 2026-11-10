import { Module } from '@nestjs/common';

import { AuthenticateUserUseCase } from '@application/use-cases/auth/authenticate-user.use-case';
import { RefreshTokenUseCase } from '@application/use-cases/auth/refresh-token.use-case';
import { ConfirmPasswordResetUseCase } from '@application/use-cases/auth/confirm-password-reset.use-case';
import { InfrastructureServicesModule } from '@infrastructure/services/infrastructure-services.module';

import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';
import { ICache } from '@application/ports/output/services/cache.service.interface';
import { IHashService } from '@application/ports/output/services/hash.service.interface';
import { ITokenService } from '@application/ports/output/services/token.service.interface';
import { IPasswordResetCodeStore } from '@application/ports/output/stores/password-reset-code-store.interface';
import { ILogger } from '@application/ports/output/services/logger.service.interface';

import { AuthController as AuthCleanController } from '@interface-adapters/auth/auth.controller';
import { AuthController } from './auth.controller';

@Module({
  imports: [InfrastructureServicesModule],
  controllers: [AuthController],
  providers: [
    {
      provide: AuthCleanController,
      useFactory: (
        userRepository: IUserRepository,
        cache: ICache,
        hashService: IHashService,
        tokenService: ITokenService,
        passwordResetCodeStore: IPasswordResetCodeStore,
        logger: ILogger,
      ) =>
        new AuthCleanController(
          new AuthenticateUserUseCase(
            userRepository,
            hashService,
            tokenService,
            logger.forContext(AuthenticateUserUseCase.name),
          ),
          new RefreshTokenUseCase(
            userRepository,
            tokenService,
            logger.forContext(RefreshTokenUseCase.name),
          ),
          new ConfirmPasswordResetUseCase(
            userRepository,
            passwordResetCodeStore,
            hashService,
            cache,
            logger.forContext(ConfirmPasswordResetUseCase.name),
          ),
        ),
      inject: [
        'IUserRepository',
        'ICache',
        'IHashService',
        'ITokenService',
        'IPasswordResetCodeStore',
        'ILogger',
      ],
    },
  ],
})
export class AuthModule {}
