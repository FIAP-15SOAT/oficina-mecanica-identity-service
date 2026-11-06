import { MASK, maskScalar } from '@infrastructure/logging/redaction/pii-masker';

describe('maskScalar', () => {
  it('should mask a person name preserving the edges', () => {
    expect(maskScalar('Maria Silva')).toBe('Ma***va');
  });

  it('should mask a CPF preserving its shape', () => {
    expect(maskScalar('123.456.789-09')).toBe('***.***.789-09');
  });

  it('should mask a CNPJ preserving its shape', () => {
    expect(maskScalar('12.345.678/0001-95')).toBe('**.***.***/****-95');
  });

  it('should mask a phone preserving its shape', () => {
    expect(maskScalar('(11) 98765-4321')).toBe('(**) *****-4321');
  });

  it('should mask a zip code preserving its shape', () => {
    expect(maskScalar('01310-100')).toBe('*****-100');
  });

  it('should mask the local part of an e-mail and keep the domain', () => {
    expect(maskScalar('maria.silva@gmail.com')).toBe('ma***va@gmail.com');
  });

  it.each([
    ['maria@a.b', 'm***@a.b'],
    ['maria@a..b', 'm***@a..b'],
    ['maria@..b', 'm***@..b'],
    ['maria@a.b.c', 'm***@a.b.c'],
    ['maria@a.b.', 'm***@a.b.'],
    ['maria@a..', 'm***@a..'],
    ['maria@.b', 'ma***.b'],
    ['maria@a.', 'ma***a.'],
    ['maria@domain', 'ma***in'],
    ['maria@@a.b', 'ma***.b'],
    ['maria@a b.c', 'ma***.c'],
    ['maria@a.b\n', 'ma***b\n'],
    ['maria@a.b\t', 'ma***b\t'],
  ])('should preserve masking for the e-mail candidate %p', (value, expected) => {
    expect(maskScalar(value)).toBe(expected);
  });

  it('should bound the runtime for a dot-heavy invalid e-mail', () => {
    const value = `maria@${'.'.repeat(30_000)} `;
    const startedAt = process.hrtime.bigint();

    const masked = maskScalar(value);
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    expect(masked).toBe('ma***. ');
    expect(elapsedMs).toBeLessThan(100);
  });

  it('should reveal a single leading character between four and six characters', () => {
    expect(maskScalar('Lucas')).toBe('L***');
    expect(maskScalar('Ana2')).toBe('A***');
  });

  it('should fully mask values too short for any reveal', () => {
    expect(maskScalar('SP')).toBe(MASK);
    expect(maskScalar('Ana')).toBe(MASK);
  });

  it('should leave an empty value empty, so the log does not imply content', () => {
    expect(maskScalar('')).toBe('');
  });

  it('should be deterministic so occurrences can be correlated', () => {
    expect(maskScalar('Maria Silva')).toBe(maskScalar('Maria Silva'));
    expect(maskScalar('Maria Silva')).not.toBe(maskScalar('Mario Santos'));
  });

  it('should not allow reconstructing the full value', () => {
    const masked = maskScalar('Maria Silva');

    expect(masked).not.toContain('ria Sil');
    expect(masked.length).toBeLessThan('Maria Silva'.length);
  });

  it('should coerce non-string scalars', () => {
    expect(maskScalar(12345678909)).toBe('12***09');
    expect(maskScalar(true)).toBe('t***');
  });
});
