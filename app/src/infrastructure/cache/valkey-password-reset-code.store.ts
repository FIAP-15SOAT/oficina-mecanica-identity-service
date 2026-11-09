import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import {
  IPasswordResetCodeStore,
  PasswordResetCodeAttempt,
} from '@application/ports/output/services/password-reset-code-store.interface';
import { PASSWORD_RESET_CODE_TTL_SECONDS } from '@domain/constants/validation/password-reset.constants';
import { ServiceIntegrationException } from '@infrastructure/exceptions/service-integration.exception';

import { createCacheClient } from './valkey-client';

const FAILURE_MESSAGE =
  'Não foi possível processar o código de redefinição agora. Tente novamente em instantes';

// Counts the attempt only while the key lives, so an expired code is never recreated by HINCRBY.
const REGISTER_ATTEMPT_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return nil end
local attempts = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
return { attempts, redis.call('HGET', KEYS[1], 'codeHash') }
`;

// Own client, not ICache: the cache swallows Valkey failures, while a reset code that cannot be
// stored or checked must fail the request.
@Injectable()
export class ValkeyPasswordResetCodeStore implements IPasswordResetCodeStore, OnModuleDestroy {
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = createCacheClient(config.getOrThrow<string>('CACHE_URL'));
  }

  async save(userId: string, codeHash: string): Promise<void> {
    const key = this.key(userId);

    let results: [Error | null, unknown][] | null;

    try {
      results = await this.client
        .multi()
        .hset(key, 'codeHash', codeHash, 'attempts', 0)
        .expire(key, PASSWORD_RESET_CODE_TTL_SECONDS)
        .exec();
    } catch {
      throw new ServiceIntegrationException(FAILURE_MESSAGE);
    }

    // exec resolves with per-command errors instead of rejecting, so a failed HSET or EXPIRE
    // would otherwise look like a stored code.
    if (!results || results.some(([error]) => error)) {
      throw new ServiceIntegrationException(FAILURE_MESSAGE);
    }
  }

  async registerAttempt(userId: string): Promise<PasswordResetCodeAttempt | null> {
    try {
      const result = (await this.client.eval(REGISTER_ATTEMPT_SCRIPT, 1, this.key(userId))) as
        | [number, string]
        | null;

      return result ? { attempts: result[0], codeHash: result[1] } : null;
    } catch {
      throw new ServiceIntegrationException(FAILURE_MESSAGE);
    }
  }

  async delete(userId: string): Promise<void> {
    try {
      await this.client.del(this.key(userId));
    } catch {
      throw new ServiceIntegrationException(FAILURE_MESSAGE);
    }
  }

  async onModuleDestroy(): Promise<void> {
    // With the offline queue off, quit rejects while the server is unreachable.
    await this.client.quit().catch(() => this.client.disconnect());
  }

  private key(userId: string): string {
    return `identity:reset-code:${userId}`;
  }
}
