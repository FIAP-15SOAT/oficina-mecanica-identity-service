import { IncomingMessage } from 'node:http';

import { isHealthProbePath } from '@infrastructure/health/health.constants';

import { extractRequestPathname } from './span-request-attributes';

export function isIgnoredIncomingRequest(request: IncomingMessage): boolean {
  return isHealthProbePath(extractRequestPathname(request.url));
}
