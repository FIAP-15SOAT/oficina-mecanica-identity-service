import { User } from '@domain/entities/user.entity';
import { IRepositories, IUnitOfWork } from '@domain/interfaces/repositories/unit-of-work.interface';
import { PasswordGenerator } from '@domain/services/password-generator';
import { Cpf } from '@domain/value-objects/cpf.vo';

import { ResourceConflictException } from '@application/exceptions/resource-conflict.exception';
import { BUSINESS_EVENTS } from '@application/logging/business-event.catalog';
import { AccountEmailComposer } from '@application/notifications/account-email.composer';
import {
  EnsureCustomerUserDto,
  EnsureCustomerUserOutputDto,
} from '@application/ports/input/user/dto/ensure-customer-user.dto';
import { IEnsureCustomerUserUseCase } from '@application/ports/input/user/ensure-customer-user.use-case.interface';
import { IHashService } from '@application/ports/output/services/hash.service.interface';
import { ILogger } from '@application/ports/output/services/logger.service.interface';

export class EnsureCustomerUserUseCase implements IEnsureCustomerUserUseCase {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
    private readonly hashService: IHashService,
    private readonly logger: ILogger,
  ) {}

  async execute(input: EnsureCustomerUserDto): Promise<EnsureCustomerUserOutputDto> {
    const cpf = Cpf.create(input.cpf).value;
    const email = input.email.trim().toLowerCase();

    const result = await this.unitOfWork.executeTransaction((repos) =>
      this.resolveUser(repos, { name: input.name, email, cpf }),
    );

    if (result.created) {
      this.logger.event(BUSINESS_EVENTS.CUSTOMER_USER_CREATED, { targetUserId: result.userId });
    }

    return result;
  }

  // A matching CPF is the same person and is reused. An e-mail that belongs to anyone else is a
  // conflict and is never reused: an e-mail is typed by hand and can repeat across people.
  private async resolveUser(
    repos: IRepositories,
    input: EnsureCustomerUserDto,
  ): Promise<EnsureCustomerUserOutputDto> {
    const [userByCpf, userByEmail] = await Promise.all([
      repos.user.findByCpf(input.cpf),
      repos.user.findByEmail(input.email),
    ]);

    if (userByEmail && userByEmail.id !== userByCpf?.id) {
      throw new ResourceConflictException(
        'O e-mail informado já pertence a outro usuário. Verifique o cadastro do cliente',
      );
    }

    if (userByCpf) {
      return { userId: userByCpf.id, created: false };
    }

    const generatedPassword = PasswordGenerator.generate();

    const created = await repos.user.create(
      User.create({
        name: input.name,
        email: input.email,
        passwordHash: await this.hashService.hash(generatedPassword),
        role: null,
        cpf: input.cpf,
      }),
    );

    await repos.outbox.add(
      AccountEmailComposer.customerInitialPassword({
        toEmail: created.email.value,
        toName: created.name,
        password: generatedPassword,
      }),
    );

    return { userId: created.id, created: true };
  }
}
