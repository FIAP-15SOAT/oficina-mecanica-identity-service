import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';

import { DateSerializerInterceptor } from '@infrastructure/http/interceptors/date-serializer.interceptor';

function createCallHandler(data: unknown): CallHandler {
  return { handle: () => of(data) };
}

describe('DateSerializerInterceptor', () => {
  let interceptor: DateSerializerInterceptor;
  const mockContext = {} as ExecutionContext;

  beforeEach(() => {
    interceptor = new DateSerializerInterceptor();
  });

  it('should convert a Date to ISO string with -03:00 offset', async () => {
    const date = new Date('2026-04-24T12:00:00.000Z');
    const result = await lastValueFrom(interceptor.intercept(mockContext, createCallHandler(date)));

    expect(result).toBe('2026-04-24T09:00:00.000-03:00');
  });

  it('should convert Date fields in a plain object', async () => {
    const now = new Date('2026-04-24T15:00:00.000Z');
    const data = { name: 'Oil Change', createdAt: now };

    const result = await lastValueFrom(interceptor.intercept(mockContext, createCallHandler(data)));

    expect(result).toEqual({
      name: 'Oil Change',
      createdAt: '2026-04-24T12:00:00.000-03:00',
    });
  });

  it('should recursively convert Dates in nested objects', async () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    const data = { outer: { inner: { date } } };

    const result = (await lastValueFrom(
      interceptor.intercept(mockContext, createCallHandler(data)),
    )) as Record<string, unknown>;

    expect((result['outer'] as Record<string, unknown>)['inner']).toEqual({
      date: '2025-12-31T21:00:00.000-03:00',
    });
  });

  it('should convert Dates inside arrays', async () => {
    const date1 = new Date('2026-04-24T12:00:00.000Z');
    const date2 = new Date('2026-04-25T12:00:00.000Z');
    const data = [date1, date2];

    const result = await lastValueFrom(interceptor.intercept(mockContext, createCallHandler(data)));

    expect(result).toEqual(['2026-04-24T09:00:00.000-03:00', '2026-04-25T09:00:00.000-03:00']);
  });

  it('should convert Dates in objects inside arrays', async () => {
    const date = new Date('2026-04-24T18:00:00.000Z');
    const data = [{ createdAt: date }];

    const result = (await lastValueFrom(
      interceptor.intercept(mockContext, createCallHandler(data)),
    )) as Record<string, unknown>[];

    expect(result[0]['createdAt']).toBe('2026-04-24T15:00:00.000-03:00');
  });

  it('should pass through null unchanged', async () => {
    const result = await lastValueFrom(interceptor.intercept(mockContext, createCallHandler(null)));

    expect(result).toBeNull();
  });

  it('should pass through undefined unchanged', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(mockContext, createCallHandler(undefined)),
    );

    expect(result).toBeUndefined();
  });

  it('should pass through strings unchanged', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(mockContext, createCallHandler('hello')),
    );

    expect(result).toBe('hello');
  });

  it('should pass through numbers unchanged', async () => {
    const result = await lastValueFrom(interceptor.intercept(mockContext, createCallHandler(42)));

    expect(result).toBe(42);
  });

  it('should pass through null values inside objects', async () => {
    const data = { value: null };

    const result = await lastValueFrom(interceptor.intercept(mockContext, createCallHandler(data)));

    expect(result).toEqual({ value: null });
  });
});
