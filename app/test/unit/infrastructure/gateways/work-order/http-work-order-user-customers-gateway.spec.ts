import { ConfigService } from '@nestjs/config';

import { ServiceRequestRejectedException } from '@application/exceptions/service-request-rejected.exception';
import { InternalHttpClient } from '@infrastructure/clients/internal-http-client';
import { ServiceIntegrationException } from '@infrastructure/exceptions/service-integration.exception';
import { HttpWorkOrderUserCustomersGateway } from '@infrastructure/gateways/work-order/http-work-order-user-customers-gateway';

import { readInternalUserCustomersFixture } from '../../../../helpers/work-order-user-customers-gateway-mock.factory';

const UNAVAILABLE_MESSAGE =
  'Não foi possível carregar os clientes vinculados agora. Tente novamente em instantes';

describe('HttpWorkOrderUserCustomersGateway', () => {
  const baseUrl = 'http://work-order-service.work-order.svc.cluster.local:3000';
  const fixture = readInternalUserCustomersFixture();

  let internalHttpClient: jest.Mocked<Pick<InternalHttpClient, 'request'>>;
  let gateway: HttpWorkOrderUserCustomersGateway;

  beforeEach(() => {
    internalHttpClient = { request: jest.fn() };

    gateway = new HttpWorkOrderUserCustomersGateway(
      internalHttpClient as unknown as InternalHttpClient,
      new ConfigService({ WORK_ORDER_SERVICE_URL: baseUrl }),
    );
  });

  it('should return the customers of the fixture', async () => {
    internalHttpClient.request.mockResolvedValue(fixture);

    const customers = await gateway.findByUserId('user-id');

    expect(customers).toEqual(fixture.data);

    expect(internalHttpClient.request).toHaveBeenCalledWith({
      method: 'GET',
      url: `${baseUrl}/internal/users/user-id/customers`,
    });
  });

  it.each([
    ['no response', new ServiceIntegrationException('Serviço de destino indisponível')],
    ['a 5xx answer', new ServiceIntegrationException('Serviço de destino indisponível')],
    ['a 4xx answer', new ServiceRequestRejectedException(404, 'Usuário não encontrado(a)')],
  ])('should throw ServiceIntegrationException with the message on %s', async (_case, error) => {
    internalHttpClient.request.mockRejectedValue(error);

    await expect(gateway.findByUserId('user-id')).rejects.toThrow(
      new ServiceIntegrationException(UNAVAILABLE_MESSAGE),
    );
  });

  it('should propagate an unexpected error', async () => {
    const unexpected = new TypeError('boom');

    internalHttpClient.request.mockRejectedValue(unexpected);

    await expect(gateway.findByUserId('user-id')).rejects.toBe(unexpected);
  });

  it('should refuse to start without WORK_ORDER_SERVICE_URL', () => {
    expect(
      () =>
        new HttpWorkOrderUserCustomersGateway(
          internalHttpClient as unknown as InternalHttpClient,
          new ConfigService({}),
        ),
    ).toThrow();
  });
});
