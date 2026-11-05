import { ApplicationException } from './application.exception';

export class ResourceNotFoundException extends ApplicationException {
  constructor(resource: string, identifier?: string) {
    const detail = identifier ? ` com identificador: ${identifier}` : '';
    super(`${resource} não encontrado(a)${detail}`);
  }
}
