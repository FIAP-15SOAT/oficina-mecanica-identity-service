import { ResetCodeGenerator } from '@domain/services/reset-code-generator';
import { IUnitOfWork } from '@domain/interfaces/repositories/unit-of-work.interface';
import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';

import { IHashService } from '@application/ports/output/services/hash.service.interface';
import { ILogger } from '@application/ports/output/services/logger.service.interface';
import { IPasswordResetCodeStore } from '@application/ports/output/services/password-reset-code-store.interface';
import { IIssuePasswordResetCodeUseCase } from '@application/ports/input/auth/issue-password-reset-code.use-case.interface';
import { AccountEmailComposer } from '@application/notifications/account-email.composer';
import { BUSINESS_EVENTS } from '@application/logging/business-event.catalog';
import { ResourceNotFoundException } from '@application/exceptions/resource-not-found.exception';

export class IssuePasswordResetCodeUseCase implements IIssuePasswordResetCodeUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly resetCodeStore: IPasswordResetCodeStore,
    private readonly hashService: IHashService,
    private readonly unitOfWork: IUnitOfWork,
    private readonly logger: ILogger,
  ) {}

  async execute(userId: string, actingUserId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new ResourceNotFoundException('Usuário', userId);
    }

    const plainCode = ResetCodeGenerator.generate();

    // The code must be stored before the e-mail is queued: an e-mail with a code nobody can confirm is worse than no e-mail.
    await this.resetCodeStore.save(user.id, await this.hashService.hash(plainCode));

    await this.unitOfWork.executeTransaction((repos) =>
      repos.outbox.add(
        AccountEmailComposer.passwordResetCode({
          toEmail: user.email.value,
          toName: user.name,
          code: plainCode,
        }),
      ),
    );

    this.logger.event(BUSINESS_EVENTS.USER_PASSWORD_RESET_ISSUED, {
      subjectId: actingUserId,
      targetUserId: user.id,
    });
  }
}
