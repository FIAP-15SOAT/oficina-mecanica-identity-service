import { Response } from 'express';

import { PostgresHealthCheck } from '@infrastructure/health/postgres.health-check';
import { ReadinessState } from '@infrastructure/health/readiness-state';

export type MockPostgresHealthCheck = { run: jest.Mock } & PostgresHealthCheck;

export type MockReadinessState = { isReady: jest.Mock } & ReadinessState;

export type MockResponse = { setHeader: jest.Mock; status: jest.Mock } & Response;

export function createMockPostgresHealthCheck(): MockPostgresHealthCheck {
  return { run: jest.fn() } as unknown as MockPostgresHealthCheck;
}

export function createMockReadinessState(): MockReadinessState {
  return { isReady: jest.fn() } as unknown as MockReadinessState;
}

export function createMockResponse(): MockResponse {
  const response = { setHeader: jest.fn(), status: jest.fn() };

  response.status.mockReturnValue(response);

  return response as unknown as MockResponse;
}
