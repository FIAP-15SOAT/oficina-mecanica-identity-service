import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';
import { DomainValidationException } from '@domain/exceptions/domain-validation.exception';
import { Cpf } from '@domain/value-objects/cpf.vo';

import { UnauthorizedAccessException } from '@application/exceptions/unauthorized-access.exception';
import {
  AuthenticationFailureReason,
  BUSINESS_EVENTS,
} from '@application/logging/business-event.catalog';
import { IAuthenticateCustomerCredentialUseCase } from '@application/ports/input/auth/authenticate-customer-credential.use-case.interface';
import {
  AuthenticateCustomerCredentialDto,
  AuthenticateCustomerCredentialOutputDto,
} from '@application/ports/input/auth/dto/authenticate-customer-credential.dto';
import { IHashService } from '@application/ports/output/services/hash.service.interface';
import { ILogger } from '@application/ports/output/services/logger.service.interface';

interface Subject {
  subjectId: string;
  subjectName: string;
  subjectEmail: string;
}

const INVALID_CREDENTIALS_MESSAGE = 'Credenciais inválidas';

// Every refusal answers the same, so the caller cannot tell an unknown CPF from a wrong password.
// The internal role is ignored: a staff member who is also a customer signs in through this flow.
export class AuthenticateCustomerCredentialUseCase implements IAuthenticateCustomerCredentialUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hashService: IHashService,
    private readonly logger: ILogger,
  ) {}

  async execute(
    input: AuthenticateCustomerCredentialDto,
  ): Promise<AuthenticateCustomerCredentialOutputDto> {
    const cpf = this.parseCpf(input.cpf);

    if (cpf === null) {
      return this.refuse('invalid_cpf');
    }

    const user = await this.userRepository.findByCpf(cpf);

    if (!user) {
      return this.refuse('unknown_user');
    }

    const subject: Subject = {
      subjectId: user.id,
      subjectName: user.name,
      subjectEmail: user.email.value,
    };

    if (!user.isActive) {
      return this.refuse('inactive_user', subject);
    }

    if (!(await this.hashService.compare(input.password, user.passwordHash))) {
      return this.refuse('wrong_password', subject);
    }

    this.logger.event(BUSINESS_EVENTS.CUSTOMER_CREDENTIAL_ACCEPTED, subject);

    return { userId: user.id };
  }

  private parseCpf(raw: string): string | null {
    try {
      return Cpf.create(raw).value;
    } catch (error) {
      if (error instanceof DomainValidationException) {
        return null;
      }

      throw error;
    }
  }

  private refuse(
    failureReason: AuthenticationFailureReason,
    subject: Partial<Subject> = {},
  ): never {
    this.logger.event(BUSINESS_EVENTS.AUTHENTICATION_FAILED, { failureReason, ...subject });

    throw new UnauthorizedAccessException(INVALID_CREDENTIALS_MESSAGE);
  }
}
