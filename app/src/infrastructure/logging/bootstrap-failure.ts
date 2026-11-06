import { hostname } from 'node:os';

import { describeError } from './error-serializer';
import { resolveLoggerConfig } from './logger.config';
import { reportLoggingFailure } from './logging-diagnostics';
import { TECHNICAL_EVENTS } from './technical-event.catalog';

export interface BootstrapFailureTarget {
  write(chunk: string): unknown;
}

const EVENT = TECHNICAL_EVENTS.APPLICATION_BOOTSTRAP_FAILED;

export function reportBootstrapFailure(
  error: unknown,
  target: BootstrapFailureTarget = process.stdout,
): void {
  try {
    const { level, resource } = resolveLoggerConfig();

    if (level === 'silent') {
      return;
    }

    target.write(
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        level: EVENT.level,
        message: EVENT.message,
        ...resource,
        'host.name': hostname(),
        'process.pid': process.pid,
        'oficina.event.name': EVENT.name,
        ...describeError(error),
      })}\n`,
    );
  } catch {
    reportLoggingFailure('bootstrap');
  }
}
