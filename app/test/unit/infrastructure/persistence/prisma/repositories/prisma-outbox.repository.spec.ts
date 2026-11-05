import { context, propagation, trace } from '@opentelemetry/api';
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { PrismaOutboxRepository } from '@infrastructure/persistence/prisma/repositories/prisma-outbox.repository';
import {
  createMockPrismaClient,
  MockPrismaService,
} from '../../../../../helpers/prisma-mock.factory';

describe('PrismaOutboxRepository', () => {
  let repository: PrismaOutboxRepository;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaClient();
    repository = new PrismaOutboxRepository(prisma);
  });

  describe('add', () => {
    it('should create the outbox row with type, workOrderId and payload', async () => {
      await repository.add({
        type: 'notification.email.send',
        workOrderId: 'wo-1',
        payload: { to: ['a@example.com'], subject: 's', text: 't', html: '<p>t</p>' },
      });

      expect(prisma.outboxMessage.create).toHaveBeenCalledWith({
        data: {
          type: 'notification.email.send',
          workOrderId: 'wo-1',
          payload: { to: ['a@example.com'], subject: 's', text: 't', html: '<p>t</p>' },
          traceContext: {},
        },
      });
    });

    describe('with an active span', () => {
      let provider: NodeTracerProvider;

      beforeAll(() => {
        provider = new NodeTracerProvider({
          spanProcessors: [new SimpleSpanProcessor(new InMemorySpanExporter())],
        });
        provider.register();
      });

      afterAll(async () => {
        await provider.shutdown();
        trace.disable();
        context.disable();
        propagation.disable();
      });

      it('should store the active W3C trace context', async () => {
        const tracer = trace.getTracer('test');
        const spanContext = await tracer.startActiveSpan('write', async (span) => {
          await repository.add({
            type: 'notification.email.send',
            workOrderId: 'wo-1',
            payload: { to: ['a@example.com'], subject: 's', text: 't', html: '<p>t</p>' },
          });
          span.end();
          return span.spanContext();
        });

        const [{ data }] = prisma.outboxMessage.create.mock.calls[0] as [
          { data: { traceContext: Record<string, string> } },
        ];
        expect(data.traceContext.traceparent).toMatch(
          new RegExp(`^00-${spanContext.traceId}-${spanContext.spanId}-01$`),
        );
      });
    });
  });
});
