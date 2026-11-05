import { Response } from 'express';

const REQUEST_LOG_CONTEXT = Symbol.for('oficina.logging.request-context');

export interface RequestLogContext {
  codeFunctionName?: string;
  errorType?: string;
  errorMessage?: string;
}

type ContextCarrier = Record<symbol, RequestLogContext | undefined>;

export function getRequestLogContext(response: unknown): RequestLogContext {
  const locals = resolveLocals(response);

  return locals?.[REQUEST_LOG_CONTEXT] ?? {};
}

export function assignRequestLogContext(response: unknown, patch: RequestLogContext): void {
  const locals = resolveLocals(response);

  if (!locals) {
    return;
  }

  locals[REQUEST_LOG_CONTEXT] = { ...locals[REQUEST_LOG_CONTEXT], ...patch };
}

function resolveLocals(response: unknown): ContextCarrier | undefined {
  const locals = (response as Response | undefined)?.locals as ContextCarrier | undefined;

  return typeof locals === 'object' && locals !== null ? locals : undefined;
}
