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
  });

  describe('validateCnpj', () => {
    it('should validate correct CNPJ (numeric)', () => {
      expect(DocumentValidator.validateCnpj('12345678000195')).toBe(true);
      expect(DocumentValidator.validateCnpj('00000000000191')).toBe(true);
      expect(DocumentValidator.validateCnpj('12.345.678/0001-95')).toBe(true);
    });

    it('should accept the alphanumeric CNPJ format only when check digits match', () => {
      expect(DocumentValidator.validateCnpj('12ABC345000135')).toBe(false);
      expect(DocumentValidator.validateCnpj('12345678000195')).toBe(true);
    });

    it('should invalidate CNPJ with non-numeric check digits', () => {
      expect(DocumentValidator.validateCnpj('123456780001AA')).toBe(false);
    });

    it('should invalidate incorrect CNPJ', () => {
      expect(DocumentValidator.validateCnpj('12345678000100')).toBe(false);
      expect(DocumentValidator.validateCnpj('00000000000000')).toBe(false);
      expect(DocumentValidator.validateCnpj('abc')).toBe(false);
    });
  });

  describe('validateCpfCnpj', () => {
    it('should route to validateCpf for 11 digits', () => {
      expect(DocumentValidator.validateCpfCnpj('12345678909')).toBe(true);
    });

    it('should route to validateCnpj for 14 digits', () => {
      expect(DocumentValidator.validateCpfCnpj('12345678000195')).toBe(true);
    });

    it('should return false for other lengths', () => {
      expect(DocumentValidator.validateCpfCnpj('12345')).toBe(false);
    });

    it('should cover remainder < 2 for CPF and CNPJ check digits', () => {
      expect(DocumentValidator.validateCpf('00000000604')).toBe(true);
      expect(DocumentValidator.validateCpf('00000001910')).toBe(true);
      expect(DocumentValidator.validateCnpj('00000000000604')).toBe(true);
      expect(DocumentValidator.validateCnpj('00000000001910')).toBe(true);
    });
  });
});
