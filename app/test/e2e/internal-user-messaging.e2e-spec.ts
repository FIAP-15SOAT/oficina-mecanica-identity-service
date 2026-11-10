import { randomUUID } from 'node:crypto';
import type { Server } from 'http';
import request from 'supertest';
import {
  DeleteMessageBatchCommand,
  GetQueueUrlCommand,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';

import { TestContext, setupTestApp, teardownTestApp } from '../helpers/test-app.helper';

interface PublishedEmail {
  type: string;
  workOrderId: string | null;
  payload: { to: string[]; subject: string; text: string; html: string; purpose: string };
}

describe('Internal customer user e-mail through the outbox (E2E)', () => {
  let ctx: TestContext;
  let httpServer: Server;
  let sqs: SQSClient;
  let queueUrl: string;

  async function receiveEmailTo(email: string, timeoutMs = 20_000): Promise<PublishedEmail> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const { Messages = [] } = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 1,
        }),
      );

      if (Messages.length > 0) {
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

      const found = Messages.map(
        (message) => JSON.parse(message.Body as string) as PublishedEmail,
      ).find((message) => message.payload.to.includes(email));

      if (found) {
        return found;
      }
    }

    throw new Error(`no e-mail to ${email} reached notification.fifo within ${timeoutMs} ms`);
  }

  beforeAll(async () => {
    ctx = await setupTestApp({ withMessaging: true });
    httpServer = ctx.httpServer;
    sqs = new SQSClient({ useQueueUrlAsEndpoint: false });

    const { QueueUrl } = await sqs.send(new GetQueueUrlCommand({ QueueName: 'notification.fifo' }));
    queueUrl = QueueUrl as string;
  });

  afterAll(async () => {
    sqs.destroy();
    await teardownTestApp(ctx);
  });

  it('should publish the customer_initial_password e-mail to notification.fifo', async () => {
    const email = `${randomUUID()}@e2e.test`;

    await request(httpServer)
      .post('/internal/customer-users')
      .send({ name: 'Maria Cliente', email, cpf: '12345678909' })
      .expect(200);

    const message = await receiveEmailTo(email);

    expect(message.type).toBe('notification.email.send');
    expect(message.workOrderId).toBeNull();
    expect(message.payload.purpose).toBe('customer_initial_password');
    expect(message.payload.text).toContain('Senha inicial:');
  });
});
