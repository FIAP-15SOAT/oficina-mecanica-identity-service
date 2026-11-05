import { ApplicationException } from './application.exception';

export class UnauthorizedAccessException extends ApplicationException {
  constructor(message = 'Acesso não autorizado') {
    super(message);
  }
}
