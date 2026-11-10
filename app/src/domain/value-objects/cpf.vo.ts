import { DomainValidationException } from '../exceptions/domain-validation.exception';
import { DocumentValidator } from '../validators/document.validator';

export class Cpf {
  private constructor(public readonly value: string) {}

  static create(value: string): Cpf {
    const sanitized = Cpf.sanitize(value);

    Cpf.validate(sanitized);

    return new Cpf(sanitized);
  }

  private static sanitize(value: string): string {
    return value.replaceAll(/\D/g, '');
  }

  private static validate(value: string): void {
    if (!DocumentValidator.validateCpf(value)) {
      throw new DomainValidationException('CPF inválido');
    }
  }

  equals(other: Cpf): boolean {
    return other instanceof Cpf && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
