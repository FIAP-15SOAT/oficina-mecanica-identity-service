import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { PASSWORD_RESET_CODE_TTL_SECONDS } from '@domain/constants/validation/password-reset.constants';
import { createCacheClient } from '@infrastructure/cache/valkey-client';
import { ValkeyPasswordResetCodeStore } from '@infrastructure/cache/valkey-password-reset-code.store';
import { ServiceIntegrationException } from '@infrastructure/exceptions/service-integration.exception';

jest.mock('@infrastructure/cache/valkey-client');

const CACHE_URL = 'redis://localhost:6379';
const USER_ID = 'user-1';
const KEY = `identity:reset-code:${USER_ID}`;
const FAILURE_MESSAGE =
  'Não foi possível processar o código de redefinição agora. Tente novamente em instantes';

type MockMulti = { hset: jest.Mock; expire: jest.Mock; exec: jest.Mock };
type MockClient = jest.Mocked<Pick<Redis, 'eval' | 'del' | 'quit' | 'disconnect'>> & {
  multi: jest.Mock;
};

describe('ValkeyPasswordResetCodeStore', () => {
  let multi: MockMulti;
  let client: MockClient;
  let store: ValkeyPasswordResetCodeStore;

  beforeEach(() => {
    multi = { hset: jest.fn(), expire: jest.fn(), exec: jest.fn() };
    multi.hset.mockReturnValue(multi);
    multi.expire.mockReturnValue(multi);
    client = {
      multi: jest.fn().mockReturnValue(multi),
      eval: jest.fn(),
      del: jest.fn(),
      quit: jest.fn(),
      disconnect: jest.fn(),
    };
    jest.mocked(createCacheClient).mockReturnValue(client as unknown as Redis);
    store = new ValkeyPasswordResetCodeStore(new ConfigService({ CACHE_URL }));
  });

  it('should create the client from CACHE_URL', () => {
    expect(createCacheClient).toHaveBeenCalledWith(CACHE_URL);
  });

  it('should fail when CACHE_URL is missing', () => {
    expect(() => new ValkeyPasswordResetCodeStore(new ConfigService({}))).toThrow('CACHE_URL');
  });

  describe('save', () => {
    it('should save the hash with zero attempts and a 600 second expiry in one MULTI', async () => {
      multi.exec.mockResolvedValueOnce([
        [null, 2],
        [null, 1],
      ]);

      await store.save(USER_ID, 'hash');

      expect(multi.hset).toHaveBeenCalledWith(KEY, 'codeHash', 'hash', 'attempts', 0);
      expect(multi.expire).toHaveBeenCalledWith(KEY, PASSWORD_RESET_CODE_TTL_SECONDS);
      expect(multi.exec).toHaveBeenCalledTimes(1);
    });

    it('should throw ServiceIntegrationException when Valkey fails', async () => {
      multi.exec.mockRejectedValueOnce(new Error('down'));

      const result = store.save(USER_ID, 'hash');

      await expect(result).rejects.toThrow(new ServiceIntegrationException(FAILURE_MESSAGE));
    });
  });

  describe('save with a failed MULTI', () => {
    it('should throw ServiceIntegrationException when a MULTI command fails', async () => {
      multi.exec.mockResolvedValueOnce([
        [null, 2],
        [new Error('WRONGTYPE'), null],
      ]);

      const result = store.save(USER_ID, 'hash');

      await expect(result).rejects.toThrow(new ServiceIntegrationException(FAILURE_MESSAGE));
    });

    it('should throw ServiceIntegrationException when MULTI returns null', async () => {
      multi.exec.mockResolvedValueOnce(null);

      const result = store.save(USER_ID, 'hash');

      await expect(result).rejects.toThrow(new ServiceIntegrationException(FAILURE_MESSAGE));
    });
  });

  describe('registerAttempt', () => {
    it('should return null when the key does not exist', async () => {
      client.eval.mockResolvedValueOnce(null);

      const result = await store.registerAttempt(USER_ID);

      expect(result).toBeNull();
    });

    it('should return the incremented attempts and the hash', async () => {
      client.eval.mockResolvedValueOnce([3, 'hash']);

      const result = await store.registerAttempt(USER_ID);

      expect(client.eval).toHaveBeenCalledWith(expect.stringContaining('HINCRBY'), 1, KEY);
      expect(result).toEqual({ codeHash: 'hash', attempts: 3 });
    });

    it('should throw ServiceIntegrationException when Valkey fails', async () => {
      client.eval.mockRejectedValueOnce(new Error('down'));

      const result = store.registerAttempt(USER_ID);

      await expect(result).rejects.toThrow(new ServiceIntegrationException(FAILURE_MESSAGE));
    });
  });

  describe('delete', () => {
    it('should delete the key', async () => {
      client.del.mockResolvedValueOnce(1);

      await store.delete(USER_ID);

      expect(client.del).toHaveBeenCalledWith(KEY);
    });

    it('should throw ServiceIntegrationException when Valkey fails', async () => {
      client.del.mockRejectedValueOnce(new Error('down'));

      const result = store.delete(USER_ID);

      await expect(result).rejects.toThrow(new ServiceIntegrationException(FAILURE_MESSAGE));
    });
  });

  describe('onModuleDestroy', () => {
    it('should quit the client', async () => {
      client.quit.mockResolvedValueOnce('OK');

      await store.onModuleDestroy();

      expect(client.quit).toHaveBeenCalledTimes(1);
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('should disconnect when quit fails', async () => {
      client.quit.mockRejectedValueOnce(new Error('down'));

      await store.onModuleDestroy();

      expect(client.disconnect).toHaveBeenCalledTimes(1);
    });
  });
});
