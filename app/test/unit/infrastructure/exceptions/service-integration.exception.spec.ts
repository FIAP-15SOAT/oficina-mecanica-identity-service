import { ServiceIntegrationException } from '@infrastructure/exceptions/service-integration.exception';
import { InfrastructureException } from '@infrastructure/exceptions/infrastructure.exception';

describe('ServiceIntegrationException', () => {
  it('should instantiate correctly and inherit from InfrastructureException', () => {
    const message = 'External service failed to respond';
    const exception = new ServiceIntegrationException(message);

    expect(exception).toBeInstanceOf(ServiceIntegrationException);
    expect(exception).toBeInstanceOf(InfrastructureException);
    expect(exception).toBeInstanceOf(Error);
    expect(exception.message).toBe(message);
    expect(exception.name).toBe('ServiceIntegrationException');
  });
});
