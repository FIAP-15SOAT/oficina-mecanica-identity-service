import { GLOBAL_PREFIX } from '@infrastructure/http/http.constants';

export const HEALTH_SEGMENT = 'health';
export const LIVENESS_SEGMENT = 'live';
export const READINESS_SEGMENT = 'ready';

export const LIVENESS_PATH = `/${GLOBAL_PREFIX}/${HEALTH_SEGMENT}/${LIVENESS_SEGMENT}`;
export const READINESS_PATH = `/${GLOBAL_PREFIX}/${HEALTH_SEGMENT}/${READINESS_SEGMENT}`;

export const HEALTH_PATHS: ReadonlySet<string> = new Set([LIVENESS_PATH, READINESS_PATH]);

export function isHealthProbePath(pathname: string): boolean {
  return HEALTH_PATHS.has(pathname);
}

export const HEALTHY_BODY = { status: 'ok' } as const;
export const UNAVAILABLE_BODY = { status: 'unavailable' } as const;
