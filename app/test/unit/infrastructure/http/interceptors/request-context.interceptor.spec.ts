import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { Response } from 'express';

import { RequestContextInterceptor } from '@infrastructure/http/interceptors/request-context.interceptor';
import {
  assignRequestLogContext,
  getRequestLogContext,
} from '@infrastructure/logging/request-log-context';

class CustomerController {
  create(): void {}
}

function createExecutionContext(
  response: unknown,
  type: 'http' | 'rpc' = 'http',
): ExecutionContext {
  return {
    getType: () => type,
    getClass: () => CustomerController,
    getHandler: () => CustomerController.prototype.create,
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ExecutionContext;
}

describe('RequestContextInterceptor', () => {
  const next: CallHandler = { handle: () => of('payload') };

  it('should write the handler name into the request-local context without emitting a line', () => {
    const response = { locals: {} } as unknown as Response;

    new RequestContextInterceptor().intercept(createExecutionContext(response), next);

    expect(getRequestLogContext(response).codeFunctionName).toBe('CustomerController.create');
  });

  it('should forward the handler result unchanged', (done) => {
    const response = { locals: {} } as unknown as Response;

    new RequestContextInterceptor().intercept(createExecutionContext(response), next).subscribe({
      next: (value) => {
        expect(value).toBe('payload');
        done();
      },
    });
  });

  it('should do nothing outside an http context', () => {
    const response = { locals: {} } as unknown as Response;

    new RequestContextInterceptor().intercept(createExecutionContext(response, 'rpc'), next);

    expect(getRequestLogContext(response)).toEqual({});
  });

  it('should not throw when the response has no locals', () => {
    expect(() =>
      new RequestContextInterceptor().intercept(createExecutionContext({}), next),
    ).not.toThrow();
  });
});

describe('request log context', () => {
  it('should merge successive patches from the interceptor and the filters', () => {
    const response = { locals: {} } as unknown as Response;

    assignRequestLogContext(response, { codeFunctionName: 'QuoteController.approve' });
    assignRequestLogContext(response, { errorType: 'BusinessRuleViolationException' });
    assignRequestLogContext(response, { errorMessage: 'status inválido' });

    expect(getRequestLogContext(response)).toEqual({
      codeFunctionName: 'QuoteController.approve',
      errorType: 'BusinessRuleViolationException',
      errorMessage: 'status inválido',
    });
  });

  it('should return an empty context when there is no carrier', () => {
    expect(getRequestLogContext(undefined)).toEqual({});
    expect(getRequestLogContext({})).toEqual({});
  });

  it('should ignore a write when there is no carrier', () => {
    expect(() => assignRequestLogContext(undefined, { errorType: 'X' })).not.toThrow();
  });
});
