import { InfrastructureException } from './infrastructure.exception';

export class ServiceIntegrationException extends InfrastructureException {
  constructor(message: string) {
    super(message);
  }
}
