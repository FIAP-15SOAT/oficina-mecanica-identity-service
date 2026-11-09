import { ResetCodeGenerator } from '@domain/services/reset-code-generator';

describe('ResetCodeGenerator', () => {
  it('should generate exactly 6 digits', () => {
    for (let i = 0; i < 100; i++) {
      const code = ResetCodeGenerator.generate();

      expect(code).toMatch(/^\d{6}$/);
    }
  });
});
