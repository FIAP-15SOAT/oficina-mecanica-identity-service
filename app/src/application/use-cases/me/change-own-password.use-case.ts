import { User } from '@domain/entities/user.entity';
import { BusinessRuleViolationException } from '@domain/exceptions/business-rule-violation.exception';
import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';

import { ResourceNotFoundException } from '@application/exceptions/resource-not-found.exception';
import { UnauthorizedAccessException } from '@application/exceptions/unauthorized-access.exception';
import { identityCacheKeys } from '@application/keys/identity-cache-keys';
import { BUSINESS_EVENTS } from '@application/logging/business-event.catalog';
import { IChangeOwnPasswordUseCase } from '@application/ports/input/me/change-own-password.use-case.interface';
import { ChangeOwnPasswordDto } from '@application/ports/input/me/dto/change-own-password.dto';
import { ICache } from '@application/ports/output/services/cache.service.interface';
import { IHashService } from '@application/ports/output/services/hash.service.interface';
import { ILogger } from '@application/ports/output/services/logger.service.interface';

export class ChangeOwnPasswordUseCase implements IChangeOwnPasswordUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hashService: IHashService,
    private readonly cache: ICache,
    private readonly logger: ILogger,
  ) {}

  async execute(userId: string, dto: ChangeOwnPasswordDto): Promise<void> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new ResourceNotFoundException('Usuário', userId);
    }

    await this.validatePassword(user, dto);

    const newHash = await this.hashService.hash(dto.newPassword);
    user.changePassword(newHash);

    await this.userRepository.update(user);
    await this.cache.delete([identityCacheKeys.user(userId)]);

    this.logger.event(BUSINESS_EVENTS.USER_PASSWORD_CHANGED, { subjectId: userId });
  }

  private async validatePassword(user: User, dto: ChangeOwnPasswordDto): Promise<void> {
    const currentMatches = await this.hashService.compare(dto.currentPassword, user.passwordHash);

    if (!currentMatches) {
      throw new UnauthorizedAccessException('Senha atual incorreta');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BusinessRuleViolationException('A nova senha não pode ser igual à senha atual');
    }

    User.validatePasswordStrength(dto.newPassword);
  }
}
