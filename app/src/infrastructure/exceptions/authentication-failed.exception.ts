import { InfrastructureException } from './infrastructure.exception';

export class AuthenticationFailedException extends InfrastructureException {
  constructor(message = 'Falha na autenticação') {
    super(message);
  }
}
