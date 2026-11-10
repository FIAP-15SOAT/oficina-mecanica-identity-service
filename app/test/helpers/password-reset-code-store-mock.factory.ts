import { IPasswordResetCodeStore } from '@application/ports/output/stores/password-reset-code-store.interface';

export function createMockPasswordResetCodeStore(): jest.Mocked<IPasswordResetCodeStore> {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    registerAttempt: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}
