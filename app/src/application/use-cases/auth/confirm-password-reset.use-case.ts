import { User } from '@domain/entities/user.entity';
import { PASSWORD_RESET_MAX_ATTEMPTS } from '@domain/constants/validation/password-reset.constants';
import { IUnitOfWork } from '@domain/interfaces/repositories/unit-of-work.interface';
import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';

import { ICache } from '@application/ports/output/services/cache.service.interface';
import { IHashService } from '@application/ports/output/services/hash.service.interface';
import { ILogger } from '@application/ports/output/services/logger.service.interface';
import { IPasswordResetCodeStore } from '@application/ports/output/services/password-reset-code-store.interface';
import { ConfirmPasswordResetDto } from '@application/ports/input/auth/dto/confirm-password-reset.dto';
import { IConfirmPasswordResetUseCase } from '@application/ports/input/auth/confirm-password-reset.use-case.interface';
import { identityCacheKeys } from '@application/keys/identity-cache-keys';
import { BUSINESS_EVENTS } from '@application/logging/business-event.catalog';
import { UnauthorizedAccessException } from '@application/exceptions/unauthorized-access.exception';

export class ConfirmPasswordResetUseCase implements IConfirmPasswordResetUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly resetCodeStore: IPasswordResetCodeStore,
    private readonly hashService: IHashService,
    private readonly unitOfWork: IUnitOfWork,
    private readonly cache: ICache,
    private readonly logger: ILogger,
  ) {}

  async execute(dto: ConfirmPasswordResetDto): Promise<void> {
    // A weak password is a request error: it must not spend an attempt of the code.
    User.validatePasswordStrength(dto.newPassword);

    const user = await this.userRepository.findByEmail(dto.email);

    if (!user) {
      throw this.reject('unknown_user');
    }

    const attempt = await this.resetCodeStore.registerAttempt(user.id);

    if (!attempt) {
      throw this.reject('expired_or_missing');
    }

    if (attempt.attempts > PASSWORD_RESET_MAX_ATTEMPTS) {
      throw this.reject('exhausted');
    }

    if (!(await this.hashService.compare(dto.code, attempt.codeHash))) {
      throw this.reject('wrong_code');
    }

    user.changePassword(await this.hashService.hash(dto.newPassword));

    await this.unitOfWork.executeTransaction((repos) => repos.user.update(user));
    await this.resetCodeStore.delete(user.id);
    await this.cache.delete([identityCacheKeys.user(user.id)]);

    this.logger.event(BUSINESS_EVENTS.USER_PASSWORD_RESET_COMPLETED, {
      targetUserId: user.id,
      resetOutcome: 'confirmed',
    });
  }

  private reject(reason: string): UnauthorizedAccessException {
    this.logger.event(BUSINESS_EVENTS.USER_PASSWORD_RESET_REJECTED, { resetOutcome: reason });

    return new UnauthorizedAccessException('Código de redefinição inválido ou expirado');
  }
}
