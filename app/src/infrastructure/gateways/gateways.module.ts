import { Global, Module } from '@nestjs/common';

import { HttpWorkOrderUserCustomersGateway } from './work-order/http-work-order-user-customers-gateway';

const GATEWAY_PROVIDERS = [
  { provide: 'IWorkOrderUserCustomersGateway', useClass: HttpWorkOrderUserCustomersGateway },
];

@Global()
@Module({
  providers: GATEWAY_PROVIDERS,
  exports: GATEWAY_PROVIDERS,
})
export class GatewaysModule {}
