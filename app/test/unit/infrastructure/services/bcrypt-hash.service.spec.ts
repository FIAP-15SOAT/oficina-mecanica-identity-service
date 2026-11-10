import { ConfigService } from '@nestjs/config';
import { BcryptHashService } from '@infrastructure/services/bcrypt-hash.service';

describe('BcryptHashService', () => {
  let service: BcryptHashService;

  beforeEach(() => {
    const configService = {
      get: jest.fn().mockReturnValue(4),
    } as unknown as ConfigService;

    service = new BcryptHashService(configService);
  });

  describe('hash', () => {
    it('should generate a bcrypt hash', async () => {
      const hash = await service.hash('minhaSenha123');

      expect(hash).toBeDefined();
      expect(hash).not.toBe('minhaSenha123');
      expect(hash.startsWith('$2b$')).toBe(true);
    });

    it('should generate different hashes for same value', async () => {
      const hash1 = await service.hash('minhaSenha123');
      const hash2 = await service.hash('minhaSenha123');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('compare', () => {
    it('should return true for correct password', async () => {
      const hash = await service.hash('Senha@123');

      const result = await service.compare('Senha@123', hash);

      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const hash = await service.hash('Senha@123');

      const result = await service.compare('SenhaErrada', hash);

      expect(result).toBe(false);
    });
  });
});
