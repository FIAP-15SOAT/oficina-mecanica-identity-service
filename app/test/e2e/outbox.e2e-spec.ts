import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { context, propagation, trace } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { PublishCommandInput, SNSClient } from '@aws-sdk/client-sns';
import {
  DeleteMessageBatchCommand,
  GetQueueUrlCommand,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';

import { ILogger } from '@application/ports/output/services/logger.service.interface';
import { IUnitOfWork } from '@domain/interfaces/repositories/unit-of-work.interface';
import {
  OUTBOX_POLL_INTERVAL_MS,
  OUTBOX_RELAY_LOCK_KEY,
  OutboxRelayService,
} from '@infrastructure/messaging/outbox-relay.service';
import { PrismaService } from '@infrastructure/persistence/prisma/prisma.service';
import { TestContext, setupTestApp, teardownTestApp } from '../helpers/test-app.helper';

interface DeliveredMessage {
  messageId: string;
  workOrderId: string;
  traceparent?: string;
}

async function waitFor(
  condition: () => boolean | Promise<boolean>,
  description: string,
  timeoutMs = 20_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (!(await condition())) {
    if (Date.now() > deadline) {
      throw new Error(`${description}: condition not met within ${timeoutMs} ms`);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// The service has no use case yet: messages are written through the unit of work, as one would.
// Every test uses its own work order id (the FIFO group), so tests never block each other.
describe('Outbox (E2E)', () => {
  const tracerProvider = new NodeTracerProvider();
  // notification.fifo subscribes notification.email.send (filter policy of the copied
  // init-topology.sh), the message this service publishes.
  const QUEUE_NAME = 'notification.fifo';
  const MESSAGE_TYPE = 'notification.email.send';
  const EMAIL = {
    to: ['cliente@example.com'],
    subject: 'Assunto de teste',
    text: 'Texto de teste',
    html: '<p>Texto de teste</p>',
  };

  let ctx: TestContext;
  let unitOfWork: IUnitOfWork;
  let sns: SNSClient;
  let sqs: SQSClient;
  let queueUrl: string;
  const published: PublishCommandInput[] = [];
  const delivered: DeliveredMessage[] = [];

  beforeAll(async () => {
    // Registers the W3C propagator and the async context manager, as the preload does at runtime.
    tracerProvider.register();

    ctx = await setupTestApp({ withMessaging: true, captureLogs: true });
    unitOfWork = ctx.app.get<IUnitOfWork>('IUnitOfWork');
    sns = ctx.app.get(SNSClient);
    // The service has no SQS client; the test reads the subscribed queue to see what was published.
    sqs = new SQSClient({ useQueueUrlAsEndpoint: false });

    // Stand-in for AwsInstrumentation, which only runs under the preload (Jest bypasses its
    // require hook): it writes the context active at send time into the message attributes.
    // In production the published traceparent carries the span id of the PRODUCER span instead.
    sns.middlewareStack.add(
      (next) => (args) => {
        const input = args.input as PublishCommandInput;
        const carrier: Record<string, string> = {};
        propagation.inject(context.active(), carrier);

        for (const [key, value] of Object.entries(carrier)) {
          input.MessageAttributes = {
            ...input.MessageAttributes,
            [key]: { DataType: 'String', StringValue: value },
          };
        }

        published.push(input);

        return next(args);
      },
      { step: 'initialize', name: 'outboxE2eTraceAttributes' },
    );

    const { QueueUrl } = await sqs.send(new GetQueueUrlCommand({ QueueName: QUEUE_NAME }));
    queueUrl = QueueUrl as string;
  });

  afterAll(async () => {
    sqs.destroy();
    await teardownTestApp(ctx);
    await tracerProvider.shutdown();
    trace.disable();
    context.disable();
    propagation.disable();
  });

  function publishedIds(workOrderId: string): string[] {
    return published
      .filter((input) => JSON.parse(input.Message as string).workOrderId === workOrderId)
      .map((input) => input.MessageDeduplicationId as string);
  }

  async function receive(): Promise<void> {
    const { Messages = [] } = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 1,
        MessageAttributeNames: ['All'],
      }),
    );

    if (Messages.length === 0) {
      return;
    }

    for (const message of Messages) {
      const body = JSON.parse(message.Body as string) as { messageId: string; workOrderId: string };
      delivered.push({
        messageId: body.messageId,
        workOrderId: body.workOrderId,
        traceparent: message.MessageAttributes?.traceparent?.StringValue,
      });
    }

    await sqs.send(
      new DeleteMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: Messages.map((message, index) => ({
          Id: String(index),
          ReceiptHandle: message.ReceiptHandle,
        })),
      }),
    );
  }

  async function waitForDelivered(workOrderId: string, count: number): Promise<DeliveredMessage[]> {
    const ofGroup = () => delivered.filter((message) => message.workOrderId === workOrderId);

    await waitFor(async () => {
      await receive();
      return ofGroup().length >= count;
    }, `${count} ${MESSAGE_TYPE} message(s) of group ${workOrderId} in ${QUEUE_NAME}`);

    return ofGroup();
  }

  function addCommitted(workOrderId: string): Promise<void> {
    return unitOfWork.executeTransaction((repositories) =>
      repositories.outbox.add({
        type: MESSAGE_TYPE,
        workOrderId,
        payload: EMAIL,
      }),
    );
  }

  async function messageIdsOf(workOrderId: string): Promise<string[]> {
    const rows = await ctx.prisma.outboxMessage.findMany({
      where: { workOrderId },
      orderBy: { id: 'asc' },
    });

    return rows.map((row) => row.messageId);
  }

  // Runs work while another session holds the relay's advisory lock, so no relay publishes meanwhile.
  async function withRelayLock<T>(work: () => Promise<T>): Promise<T> {
    const client = new Client({ connectionString: ctx.postgresContainer.getConnectionUri() });
    await client.connect();

    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [OUTBOX_RELAY_LOCK_KEY]);

      return await work();
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      await client.end();
    }
  }

  it('should not publish when the outbox is empty', async () => {
    const runBatch = jest.spyOn(ctx.app.get(OutboxRelayService), 'runBatch');

    await new Promise((resolve) => setTimeout(resolve, OUTBOX_POLL_INTERVAL_MS * 4));
    // mockRestore also clears the recorded calls: read them first.
    const calls = runBatch.mock.calls.length;
    runBatch.mockRestore();

    expect(calls).toBeGreaterThan(0);
    expect(published).toEqual([]);
    expect(
      ctx.logCapture!.lines().filter((line) => line.message === 'outbox relay batch failed'),
    ).toEqual([]);
  });

  it('should publish in creation order and delete the row', async () => {
    const workOrderId = randomUUID();

    const { traceparent, messageIds } = await withRelayLock(async () => {
      const written = await trace.getTracer('outbox-e2e').startActiveSpan('write', async (span) => {
        await addCommitted(workOrderId);
        await addCommitted(workOrderId);
        span.end();

        const carrier: Record<string, string> = {};
        propagation.inject(trace.setSpan(context.active(), span), carrier);

        return carrier.traceparent;
      });

      return { traceparent: written, messageIds: await messageIdsOf(workOrderId) };
    });

    const received = await waitForDelivered(workOrderId, 2);

    expect(received).toEqual(
      messageIds.map((messageId) => ({ messageId, workOrderId, traceparent })),
    );
    expect(await messageIdsOf(workOrderId)).toEqual([]);
  });

  it('should not publish a message from a rolled back transaction', async () => {
    const workOrderId = randomUUID();

    const committed = await withRelayLock(async () => {
      await expect(
        unitOfWork.executeTransaction(async (repositories) => {
          await repositories.outbox.add({
            type: MESSAGE_TYPE,
            workOrderId,
            payload: EMAIL,
          });

          throw new Error('rollback');
        }),
      ).rejects.toThrow('rollback');

      // With the relay locked out, a row that wrongly committed would still be in the table.
      expect(await messageIdsOf(workOrderId)).toEqual([]);

      await addCommitted(workOrderId);
      const messageIds = await messageIdsOf(workOrderId);
      expect(messageIds).toHaveLength(1);

      return messageIds[0];
    });

    const received = await waitForDelivered(workOrderId, 1);

    expect(received.map((message) => message.messageId)).toEqual([committed]);
    expect(publishedIds(workOrderId)).toEqual([committed]);
  });

  it('should publish each message once, in creation order, with two relays running at the same time', async () => {
    const workOrderId = randomUUID();

    const messageIds = await withRelayLock(async () => {
      for (let index = 0; index < 15; index++) {
        await addCommitted(workOrderId);
      }

      return messageIdsOf(workOrderId);
    });

    // A second replica next to the application's own relay, over the same database and topic.
    const replica = new OutboxRelayService(
      ctx.app.get(PrismaService),
      sns,
      ctx.app.get(ConfigService),
      await ctx.app.resolve(PinoLogger),
      ctx.app.get<ILogger>('ILogger'),
    );
    const application = ctx.app.get(OutboxRelayService);
    const drain = async (relay: OutboxRelayService) => {
      while ((await messageIdsOf(workOrderId)).length > 0) {
        await relay.runBatch();
      }
    };

    await Promise.all([drain(replica), drain(application)]);

    const received = await waitForDelivered(workOrderId, messageIds.length);

    expect(publishedIds(workOrderId)).toEqual(messageIds);
    expect(received.map((message) => message.messageId)).toEqual(messageIds);
  });
});
