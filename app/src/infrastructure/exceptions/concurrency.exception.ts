import { InfrastructureException } from './infrastructure.exception';

export class ConcurrencyException extends InfrastructureException {
  constructor(message: string) {
    super(message);
  }
}
