import { DomainException } from './domain.exception';

export class BusinessRuleViolationException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
