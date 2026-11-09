import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

import { AllExceptionsFilter } from './infrastructure/http/filters/all-exceptions.filter';
import { ApplicationExceptionFilter } from './infrastructure/http/filters/application-exception.filter';
import { DomainExceptionFilter } from './infrastructure/http/filters/domain-exception.filter';
import { InfrastructureExceptionFilter } from './infrastructure/http/filters/infrastructure-exception.filter';
import { AnyAuthGuard } from './infrastructure/http/guards/any-auth.guard';
import { AuthenticationGuard } from './infrastructure/http/guards/authentication.guard';
import { JwtAuthGuard } from './infrastructure/http/guards/jwt-auth.guard';
import { CustomerJwtStrategy } from './infrastructure/http/strategies/customer-jwt.strategy';
import { JwtStrategy } from './infrastructure/http/strategies/jwt.strategy';

import { LoggingModule } from './infrastructure/logging/logging.module';
import { TelemetryModule } from './infrastructure/telemetry/telemetry.module';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { RepositoriesModule } from './infrastructure/persistence/prisma/repositories/repositories.module';
import { AuthModule } from './infrastructure/http/controllers/auth/auth.module';
import { UserModule } from './infrastructure/http/controllers/user/user.module';
import { HealthModule } from './infrastructure/http/controllers/health/health.module';
import { MessagingModule } from './infrastructure/messaging/messaging.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { ClientsModule } from './infrastructure/clients/clients.module';
import { GatewaysModule } from './infrastructure/gateways/gateways.module';
import { MeModule } from './infrastructure/http/controllers/me/me.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggingModule,
    TelemetryModule,
    PrismaModule,
    RepositoriesModule,
    MessagingModule,
    CacheModule,
    ClientsModule,
    GatewaysModule,
    HealthModule,
    AuthModule,
    UserModule,
    MeModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: DomainExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: ApplicationExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: InfrastructureExceptionFilter,
    },
    JwtStrategy,
    CustomerJwtStrategy,
    JwtAuthGuard,
    AnyAuthGuard,
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
  ],
})
export class AppModule {}
