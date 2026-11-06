import { Global, Module } from '@nestjs/common';

import { OtelMetricsAdapter } from './otel-metrics.adapter';
import { TelemetryLifecycleService } from './telemetry-lifecycle.service';

@Global()
@Module({
  providers: [
    OtelMetricsAdapter,
    { provide: 'IMetrics', useExisting: OtelMetricsAdapter },
    TelemetryLifecycleService,
  ],
  exports: [OtelMetricsAdapter, 'IMetrics'],
})
export class TelemetryModule {}
