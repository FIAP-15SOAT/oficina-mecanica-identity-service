import { InfrastructureException } from './infrastructure.exception';

export class DatabaseOperationException extends InfrastructureException {
  constructor(operation: string, detail?: string) {
    const msg = detail
      ? `Erro na operação ${operation}: ${detail}`
      : `Erro na operação ${operation}`;
    super(msg);
  }
}
