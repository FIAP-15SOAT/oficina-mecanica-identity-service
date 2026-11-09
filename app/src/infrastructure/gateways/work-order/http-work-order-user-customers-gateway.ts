import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ServiceRequestRejectedException } from '@application/exceptions/service-request-rejected.exception';
import { IWorkOrderUserCustomersGateway } from '@application/ports/output/gateways/work-order/work-order-user-customers-gateway.interface';
import { UserCustomerGatewayResponse } from '@application/ports/output/gateways/work-order/work-order-user-customers-gateway.response';
import { InternalHttpClient } from '@infrastructure/clients/internal-http-client';
import { ServiceIntegrationException } from '@infrastructure/exceptions/service-integration.exception';

const UNAVAILABLE_MESSAGE =
  'Não foi possível carregar os clientes vinculados agora. Tente novamente em instantes';

@Injectable()
export class HttpWorkOrderUserCustomersGateway implements IWorkOrderUserCustomersGateway {
  private readonly baseUrl: string;

  constructor(
    private readonly internalHttpClient: InternalHttpClient,
    configService: ConfigService,
  ) {
    this.baseUrl = configService.getOrThrow<string>('WORK_ORDER_SERVICE_URL');
  }

  async findByUserId(userId: string): Promise<UserCustomerGatewayResponse[]> {
    try {
      const { data } = await this.internalHttpClient.request<{
        data: UserCustomerGatewayResponse[];
      }>({ method: 'GET', url: `${this.baseUrl}/internal/users/${userId}/customers` });

      return data;
    } catch (error) {
      // A refusal is a contract drift, not something the user can fix: it answers like an outage.
      if (
        error instanceof ServiceIntegrationException ||
        error instanceof ServiceRequestRejectedException
      ) {
        throw new ServiceIntegrationException(UNAVAILABLE_MESSAGE);
      }

      throw error;
    }
  }
}
