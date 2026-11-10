import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { IWorkOrderUserCustomersGateway } from '@application/ports/output/gateways/work-order/work-order-user-customers-gateway.interface';
import { UserCustomerGatewayResponse } from '@application/ports/output/gateways/work-order/work-order-user-customers-gateway.response';

export interface InternalUserCustomersFixture {
  data: UserCustomerGatewayResponse[];
}

export function readInternalUserCustomersFixture(): InternalUserCustomersFixture {
  return JSON.parse(
    readFileSync(join(__dirname, '../contracts/work-order/internal-user-customers.json'), 'utf8'),
  ) as InternalUserCustomersFixture;
}

export function createMockWorkOrderUserCustomersGateway(): jest.Mocked<IWorkOrderUserCustomersGateway> {
  return { findByUserId: jest.fn() };
}
