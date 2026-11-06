import type { Server } from 'http';
import { Controller, Get } from '@nestjs/common';
import { context, trace } from '@opentelemetry/api';
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';

import { DECLARED_FIELD_NAMES } from '@infrastructure/logging/field-registry';

import { signTestStaffToken } from '../helpers/staff-jwt.helper';
import { LogCapture, TestContext, setupTestApp, teardownTestApp } from '../helpers/test-app.helper';

const ACCESS_LOG_MESSAGE = 'http request';

const TEST_SPAN_NAME = 'e2e server span';

const PROBE_PATH = '/api/telemetry-probe';

/** Authenticated route that exists only in this suite. */
@Controller('telemetry-probe')
class TelemetryProbeController {
  @Get()
  probe(): { data: unknown[] } {
    return { data: [] };
  }
}

/**
 * ⚠️ Auto-instrumentation **does not work under Jest**: `jest-runtime` has its
 * own module registry and does not go through Node's loader, which is where
 * `require-in-the-middle` hooks in. A test asserting something about spans
 * produced by instrumentation would stay green **without checking anything** —
 * and an empty test is worse than no test, because it buys confidence.
 *
 * What this suite checks is what **is ours** and works without patching: the
 * correlation `mixin` reading the active span and the three fields surviving the
 * output normalizer. The server span is opened by the test's own middleware, which
 * reproduces what `instrumentation-http` does — including the response's
 * `context.bind`, without which `pino-http`'s completion listener would run
 * outside the context and `trace_id` would vanish from the access log line.
 *
 * Real server spans, the parameterized `http.route`, probe exclusion and the
 * absence of `url.query` are checked in the smoke test outside Jest, over the
 * compose stack, which runs the real `CMD` with the preload.
 */
function openServerSpan(app: NestExpressApplication): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const span = trace.getTracer('e2e').startSpan(TEST_SPAN_NAME);
    const spanContext = trace.setSpan(context.active(), span);

    context.with(spanContext, () => {
      context.bind(spanContext, req);
      context.bind(spanContext, res);

      res.on('finish', () => span.end());

      next();
    });
  });
}

describe('Telemetry (E2E)', () => {
  let ctx: TestContext;
  let httpServer: Server;
  let capture: LogCapture;
  let adminToken: string;
  let spanExporter: InMemorySpanExporter;
  let tracerProvider: NodeTracerProvider;

  beforeAll(async () => {
    spanExporter = new InMemorySpanExporter();
    tracerProvider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(spanExporter)],
    });
    tracerProvider.register();

    ctx = await setupTestApp({
      captureBootstrap: true,
      configure: openServerSpan,
      controllers: [TelemetryProbeController],
    });
    httpServer = ctx.httpServer;
    capture = ctx.logCapture!;
    adminToken = signTestStaffToken({
      sub: 'staff-telemetry-1',
      email: 'admin.telemetria@e2e.test',
      role: 'ADMIN',
    });
  });

  afterAll(async () => {
    await teardownTestApp(ctx);
    await tracerProvider.shutdown();
    context.disable();
    trace.disable();
  });

  beforeEach(() => {
    capture.clear();
    spanExporter.reset();
  });

  function accessLines(): Record<string, unknown>[] {
    return capture.lines().filter((line) => line.message === ACCESS_LOG_MESSAGE);
  }

  describe('log↔trace correlation', () => {
    it('should carry trace_id, span_id and request.id on the same access log line', async () => {
      await request(httpServer)
        .get(PROBE_PATH)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const [line] = accessLines();
      const [span] = spanExporter.getFinishedSpans();

      expect(span.name).toBe(TEST_SPAN_NAME);
      expect(line['trace_id']).toBe(span.spanContext().traceId);
      expect(line['span_id']).toBe(span.spanContext().spanId);
      expect(line['trace_flags']).toBe('01');
      expect(line['service.name']).toBe('oficina-mecanica-identity-service');

      // `request.id` stays: it is the key that also exists outside a span, is
      // echoed in the response header and is the one a user quotes in a ticket.
      expect(line['request.id']).toEqual(expect.any(String));
    });

    it('should keep the identifiers stable within the same request', async () => {
      await request(httpServer)
        .get(PROBE_PATH)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const traceIds = new Set(capture.lines().map((line) => line['trace_id']));

      expect(traceIds.size).toBe(1);
      expect([...traceIds][0]).toBeDefined();
    });

    /**
     * An empty or synthetic identifier is worse than no field: it would make
     * the destination try to correlate with a trace that does not exist.
     */
    it('should not emit trace fields on bootstrap lines, which live outside any span', () => {
      const bootstrapLines = capture.bootstrapLines();

      expect(bootstrapLines.length).toBeGreaterThan(0);

      for (const line of bootstrapLines) {
        expect(line).not.toHaveProperty('trace_id');
        expect(line).not.toHaveProperty('span_id');
        expect(line).not.toHaveProperty('trace_flags');
      }
    });

    /**
     * Without a dictionary declaration, `normalizeLogRecord` would drop all
     * three silently — a correlation promised and not delivered.
     */
    it('should keep the dictionary closed with the three new fields', async () => {
      await request(httpServer)
        .get(PROBE_PATH)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const lines = capture.lines();
      const undeclared = lines
        .flatMap((line) => Object.keys(line))
        .filter((key) => !DECLARED_FIELD_NAMES.has(key));

      expect(undeclared).toEqual([]);
      expect(DECLARED_FIELD_NAMES.has('trace_id')).toBe(true);
      expect(DECLARED_FIELD_NAMES.has('span_id')).toBe(true);
      expect(DECLARED_FIELD_NAMES.has('trace_flags')).toBe(true);
    });

    it('should declare the three fields as strings, as the dictionary promises', async () => {
      await request(httpServer)
        .get(PROBE_PATH)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const [line] = accessLines();

      expect(typeof line['trace_id']).toBe('string');
      expect(typeof line['span_id']).toBe('string');
      expect(typeof line['trace_flags']).toBe('string');
    });
  });
});
