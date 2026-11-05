import { ApplicationException } from './application.exception';

export class ResourceConflictException extends ApplicationException {
  constructor(message: string) {
    super(message);
  }
}
