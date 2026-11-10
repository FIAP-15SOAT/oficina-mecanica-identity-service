import { UnauthorizedAccessException } from '@application/exceptions/unauthorized-access.exception';
import { identityCacheKeys } from '@application/keys/identity-cache-keys';
import { BUSINESS_EVENTS } from '@application/logging/business-event.catalog';
import { ICache } from '@application/ports/output/services/cache.service.interface';
import { IHashService } from '@application/ports/output/services/hash.service.interface';
import { ILogger } from '@application/ports/output/services/logger.service.interface';
import { IPasswordResetCodeStore } from '@application/ports/output/stores/password-reset-code-store.interface';
import { ConfirmPasswordResetUseCase } from '@application/use-cases/auth/confirm-password-reset.use-case';
import { PASSWORD_RESET_MAX_ATTEMPTS } from '@domain/constants/validation/password-reset.constants';
import { DomainValidationException } from '@domain/exceptions/domain-validation.exception';
import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';

import { createMockCache } from '../../../../helpers/cache-mock.factory';
import { createMockHashService } from '../../../../helpers/hash-mock.factory';
import { createMockLogger } from '../../../../helpers/logger-mock.factory';
import { createMockPasswordResetCodeStore } from '../../../../helpers/password-reset-code-store-mock.factory';
import { createMockUser, createMockUserRepository } from '../../../../helpers/user-mock.factory';

describe('ConfirmPasswordResetUseCase', () => {
  let useCase: ConfirmPasswordResetUseCase;
  let userRepository: jest.Mocked<IUserRepository>;
  let passwordResetCodeStore: jest.Mocked<IPasswordResetCodeStore>;
  let hashService: jest.Mocked<IHashService>;
  let cache: jest.Mocked<ICache>;
  let logger: jest.Mocked<ILogger>;

  const input = { email: 'john.doe@example.com', code: '042731', newPassword: 'NewPass@789' };
  const rejection = 'Código de redefinição inválido ou expirado';

  beforeEach(() => {
    userRepository = createMockUserRepository();
    passwordResetCodeStore = createMockPasswordResetCodeStore();
    hashService = createMockHashService();
    cache = createMockCache();
    logger = createMockLogger();

    useCase = new ConfirmPasswordResetUseCase(
      userRepository,
      passwordResetCodeStore,
      hashService,
      cache,
      logger,
    );
  });

  it('should change the password, delete the code and clear the user cache key in this order', async () => {
    const user = createMockUser();
    userRepository.findByEmail.mockResolvedValue(user);
    passwordResetCodeStore.registerAttempt.mockResolvedValue({
      codeHash: 'code-hash',
      attempts: 1,
    });
    hashService.hash.mockResolvedValue('new-password-hash');

    await useCase.execute(input);

    expect(hashService.compare).toHaveBeenCalledWith(input.code, 'code-hash');
    expect(userRepository.updatePassword).toHaveBeenCalledWith(
      expect.objectContaining({ id: user.id, passwordHash: 'new-password-hash' }),
    );
    expect(passwordResetCodeStore.delete).toHaveBeenCalledWith(user.id);
    expect(cache.delete).toHaveBeenCalledWith([identityCacheKeys.user(user.id)]);
    expect(userRepository.updatePassword.mock.invocationCallOrder[0]).toBeLessThan(
      passwordResetCodeStore.delete.mock.invocationCallOrder[0],
    );
    expect(passwordResetCodeStore.delete.mock.invocationCallOrder[0]).toBeLessThan(
      cache.delete.mock.invocationCallOrder[0],
    );
    expect(logger.event).toHaveBeenCalledWith(BUSINESS_EVENTS.USER_PASSWORD_RESET_COMPLETED, {
      targetUserId: user.id,
      resetOutcome: 'confirmed',
    });
  });

  it('should delete the user cache key after the change', async () => {
    const user = createMockUser();
    userRepository.findByEmail.mockResolvedValue(user);
    passwordResetCodeStore.registerAttempt.mockResolvedValue({
      codeHash: 'code-hash',
      attempts: 1,
    });

    await useCase.execute(input);

    expect(cache.delete).toHaveBeenCalledTimes(1);
    expect(cache.delete).toHaveBeenCalledWith([`identity:user:${user.id}`]);
  });

  it('should not touch the store for a weak password', async () => {
    await expect(useCase.execute({ ...input, newPassword: 'weak' })).rejects.toThrow(
      DomainValidationException,
    );

    expect(userRepository.findByEmail).not.toHaveBeenCalled();
    expect(passwordResetCodeStore.registerAttempt).not.toHaveBeenCalled();
    expect(passwordResetCodeStore.delete).not.toHaveBeenCalled();
  });

  it('should look the user up by the trimmed lowercase e-mail', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(useCase.execute({ ...input, email: '  John.Doe@Example.com ' })).rejects.toThrow(
      rejection,
    );

    expect(userRepository.findByEmail).toHaveBeenCalledWith('john.doe@example.com');
  });

  it('should reject an unknown e-mail without registering an attempt', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toThrow(rejection);

    expect(passwordResetCodeStore.registerAttempt).not.toHaveBeenCalled();
    expect(logger.event).toHaveBeenCalledWith(BUSINESS_EVENTS.USER_PASSWORD_RESET_REJECTED, {
      resetOutcome: 'unknown_user',
    });
  });

  it('should reject an expired code', async () => {
    userRepository.findByEmail.mockResolvedValue(createMockUser());
    passwordResetCodeStore.registerAttempt.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toThrow(UnauthorizedAccessException);

    expect(hashService.compare).not.toHaveBeenCalled();
    expect(logger.event).toHaveBeenCalledWith(BUSINESS_EVENTS.USER_PASSWORD_RESET_REJECTED, {
      resetOutcome: 'expired_or_missing',
    });
  });

  it('should reject the sixth attempt even with the right code', async () => {
    userRepository.findByEmail.mockResolvedValue(createMockUser());
    passwordResetCodeStore.registerAttempt.mockResolvedValue({
      codeHash: 'code-hash',
      attempts: PASSWORD_RESET_MAX_ATTEMPTS + 1,
    });

    await expect(useCase.execute(input)).rejects.toThrow(rejection);

    expect(hashService.compare).not.toHaveBeenCalled();
    expect(userRepository.updatePassword).not.toHaveBeenCalled();
    expect(logger.event).toHaveBeenCalledWith(BUSINESS_EVENTS.USER_PASSWORD_RESET_REJECTED, {
      resetOutcome: 'exhausted',
    });
  });

  it('should accept the fifth attempt with the right code', async () => {
    userRepository.findByEmail.mockResolvedValue(createMockUser());
    passwordResetCodeStore.registerAttempt.mockResolvedValue({
      codeHash: 'code-hash',
      attempts: PASSWORD_RESET_MAX_ATTEMPTS,
    });

    await expect(useCase.execute(input)).resolves.toBeUndefined();
  });

  it('should reject a wrong code and keep the stored code', async () => {
    userRepository.findByEmail.mockResolvedValue(createMockUser());
    passwordResetCodeStore.registerAttempt.mockResolvedValue({
      codeHash: 'code-hash',
      attempts: 1,
    });
    hashService.compare.mockResolvedValue(false);

    await expect(useCase.execute(input)).rejects.toThrow(rejection);

    expect(userRepository.updatePassword).not.toHaveBeenCalled();
    expect(passwordResetCodeStore.delete).not.toHaveBeenCalled();
    expect(cache.delete).not.toHaveBeenCalled();
    expect(logger.event).toHaveBeenCalledWith(BUSINESS_EVENTS.USER_PASSWORD_RESET_REJECTED, {
      resetOutcome: 'wrong_code',
    });
  });

  it('should not compare the new password with the current one', async () => {
    userRepository.findByEmail.mockResolvedValue(createMockUser());
    passwordResetCodeStore.registerAttempt.mockResolvedValue({
      codeHash: 'code-hash',
      attempts: 1,
    });

    await useCase.execute(input);

    expect(hashService.compare).toHaveBeenCalledTimes(1);
    expect(hashService.compare).toHaveBeenCalledWith(input.code, 'code-hash');
  });

  it('should never log the code or the new password', async () => {
    userRepository.findByEmail.mockResolvedValue(createMockUser());
    passwordResetCodeStore.registerAttempt.mockResolvedValue({
      codeHash: 'code-hash',
      attempts: 1,
    });

    await useCase.execute(input);

    const logged = JSON.stringify(logger.event.mock.calls);

    expect(logged).not.toContain(input.code);
    expect(logged).not.toContain(input.newPassword);
  });
});
