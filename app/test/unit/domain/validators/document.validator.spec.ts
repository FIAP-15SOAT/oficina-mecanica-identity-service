import { DocumentValidator } from '@domain/validators/document.validator';

describe('DocumentValidator', () => {
  describe('validateCpf', () => {
    it('should validate correct CPF', () => {
      expect(DocumentValidator.validateCpf('12345678909')).toBe(true);
      expect(DocumentValidator.validateCpf('11144477735')).toBe(true);
      expect(DocumentValidator.validateCpf('00000000191')).toBe(true);
      expect(DocumentValidator.validateCpf('123.456.789-09')).toBe(true);
    });

    it('should invalidate incorrect CPF (wrong check digit)', () => {
      expect(DocumentValidator.validateCpf('12345678919')).toBe(false);
    });

    it('should invalidate incorrect CPF', () => {
      expect(DocumentValidator.validateCpf('12345678900')).toBe(false);
      expect(DocumentValidator.validateCpf('11111111111')).toBe(false);
      expect(DocumentValidator.validateCpf('123')).toBe(false);
    });

    it('should accept check digits whose remainder is below 2', () => {
      expect(DocumentValidator.validateCpf('00000000604')).toBe(true);
      expect(DocumentValidator.validateCpf('00000001910')).toBe(true);
    });
  });
});
