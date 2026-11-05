import { Module } from '@nestjs/common';

import { PostgresHealthCheck } from '@infrastructure/health/postgres.health-check';
import { ReadinessState } from '@infrastructure/health/readiness-state';

import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  providers: [PostgresHealthCheck, ReadinessState],
})
export class HealthModule {}
