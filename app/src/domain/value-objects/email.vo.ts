import { DomainValidationException } from '../exceptions/domain-validation.exception';
import { EMAIL_REGEX } from '../constants/regex/email.regex';

const MAX_EMAIL_LENGTH = 150;

export class Email {
  private constructor(public readonly value: string) {}

  static create(value: string): Email {
    Email.validatePresence(value);

    const normalized = value.trim().toLowerCase();

    Email.validateFormat(normalized);
    Email.validateLength(normalized);

    return new Email(normalized);
  }

  private static validatePresence(value: string | null | undefined): void {
    if (!value || value.trim().length === 0) {
      throw new DomainValidationException('E-mail é obrigatório');
    }
  }

  private static validateFormat(value: string): void {
    if (!EMAIL_REGEX.test(value)) {
      throw new DomainValidationException('E-mail inválido');
    }
  }

  private static validateLength(value: string): void {
    if (value.length > MAX_EMAIL_LENGTH) {
      throw new DomainValidationException(
        `E-mail deve ter no máximo ${MAX_EMAIL_LENGTH} caracteres`,
      );
    }
  }

  equals(other: Email): boolean {
    return other instanceof Email && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
