import { SanitizeStringsPipe } from '@infrastructure/http/pipes/sanitize-strings.pipe';
import { ArgumentMetadata } from '@nestjs/common';

describe('SanitizeStringsPipe', () => {
  let pipe: SanitizeStringsPipe;

  beforeEach(() => {
    pipe = new SanitizeStringsPipe();
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should remove null characters from string', () => {
    const input = 'Hello\0World';
    const output = 'HelloWorld';
    expect(pipe.transform(input, {} as unknown as ArgumentMetadata)).toBe(output);
  });

  it('should recursively sanitize objects', () => {
    const input = {
      name: 'John\0Doe',
      meta: {
        info: 'Secret\0Info',
        count: 10,
      },
    };
    const output = {
      name: 'JohnDoe',
      meta: {
        info: 'SecretInfo',
        count: 10,
      },
    };
    expect(pipe.transform(input, {} as unknown as ArgumentMetadata)).toEqual(output);
  });

  it('should recursively sanitize arrays', () => {
    const input = ['Item\0One', { key: 'Val\0ue' }, 123];
    const output = ['ItemOne', { key: 'Value' }, 123];
    expect(pipe.transform(input, {} as unknown as ArgumentMetadata)).toEqual(output);
  });

  it('should return null/undefined as is', () => {
    expect(pipe.transform(null, {} as unknown as ArgumentMetadata)).toBeNull();
    expect(pipe.transform(undefined, {} as unknown as ArgumentMetadata)).toBeUndefined();
  });

  it('should return numbers as is', () => {
    expect(pipe.transform(123, {} as unknown as ArgumentMetadata)).toBe(123);
  });
});
