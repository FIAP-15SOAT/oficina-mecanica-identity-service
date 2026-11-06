import { DomainException } from './domain.exception';

export class EntityNotFoundException extends DomainException {
  constructor(entity: string, identifier: string) {
    super(`${entity} não encontrado(a) com identificador: ${identifier}`);
  }
}
