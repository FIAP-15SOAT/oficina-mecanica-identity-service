import { PasswordGenerator } from '@domain/services/password-generator';
import { User } from '@domain/entities/user.entity';

describe('PasswordGenerator', () => {
  it('should generate a password with at least 12 characters', () => {
    const password = PasswordGenerator.generate();

    expect(password.length).toBeGreaterThanOrEqual(12);
  });

  it('should always satisfy the domain password strength policy', () => {
    for (let i = 0; i < 200; i++) {
      const password = PasswordGenerator.generate();

      expect(() => User.validatePasswordStrength(password)).not.toThrow();
    }
  });

  it('should generate different passwords across calls', () => {
    const passwords = new Set(Array.from({ length: 50 }, () => PasswordGenerator.generate()));

    expect(passwords.size).toBe(50);
  });
});
