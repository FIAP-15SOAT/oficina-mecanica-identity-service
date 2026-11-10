import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { readInternalUserCustomersFixture } from './work-order-user-customers-gateway-mock.factory';

/** `drop` closes the connection without an answer; a number answers with that error status. */
export type WorkOrderStubFailure = 'drop' | number;

export interface WorkOrderStub {
  url: string;
  customersByUserId: Map<string, object[]>;
  failures: Map<string, WorkOrderStubFailure>;
  close(): Promise<void>;
}

const USER_CUSTOMERS_PATH = /^\/internal\/users\/([^/]+)\/customers$/;

/** Serves GET /internal/users/:userId/customers from in-memory maps; unknown users have no links. */
export async function startWorkOrderStub(): Promise<WorkOrderStub> {
  const customersByUserId = new Map<string, object[]>();
  const failures = new Map<string, WorkOrderStubFailure>();

  const server = createServer((req, res) => {
    const userId = USER_CUSTOMERS_PATH.exec(req.url ?? '')?.[1] ?? '';
    const failure = failures.get(userId);
    const reply = (statusCode: number, body: object): void => {
      res.writeHead(statusCode, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (failure === 'drop') {
      req.socket.destroy();
    } else if (failure !== undefined) {
      reply(failure, { statusCode: failure, message: 'Erro no work-order' });
    } else {
      reply(200, { data: customersByUserId.get(userId) ?? [] });
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    customersByUserId,
    failures,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/** Links the user to the fixture customers: one INDIVIDUAL and one COMPANY. */
export function stubUserCustomers(stub: WorkOrderStub, userId: string): void {
  stub.customersByUserId.set(userId, readInternalUserCustomersFixture().data);
}
