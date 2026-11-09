import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { StartedValkeyContainer, ValkeyContainer } from '@testcontainers/valkey';

import { PASSWORD_RESET_CODE_TTL_SECONDS } from '@domain/constants/validation/password-reset.constants';
import { ValkeyPasswordResetCodeStore } from '@infrastructure/cache/valkey-password-reset-code.store';

const USER_ID = 'user-1';
const KEY = `identity:reset-code:${USER_ID}`;

describe('ValkeyPasswordResetCodeStore (e2e)', () => {
  let container: StartedValkeyContainer;
  let inspector: Redis;
  let store: ValkeyPasswordResetCodeStore;

  beforeAll(async () => {
    container = await new ValkeyContainer('valkey/valkey:9.1').start();
    inspector = new Redis(container.getConnectionUrl());
    store = new ValkeyPasswordResetCodeStore(
      new ConfigService({ CACHE_URL: container.getConnectionUrl() }),
    );
  }, 120_000);

  afterAll(async () => {
    await store.onModuleDestroy();
    await inspector.quit();
    await container.stop();
  });

  beforeEach(async () => {
    await inspector.flushall();
  });

  it('should keep the ttl after six attempts', async () => {
    await store.save(USER_ID, 'hash');

    const attempts: number[] = [];
    for (let i = 0; i < 6; i++) {
      attempts.push((await store.registerAttempt(USER_ID))!.attempts);
    }

    expect(attempts).toEqual([1, 2, 3, 4, 5, 6]);
    const ttl = await inspector.ttl(KEY);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(PASSWORD_RESET_CODE_TTL_SECONDS);
  });

  it('should not recreate the key after it expires', async () => {
    await store.save(USER_ID, 'hash');
    await inspector.pexpire(KEY, 50);
    await new Promise((resolve) => setTimeout(resolve, 150));

    const result = await store.registerAttempt(USER_ID);

    expect(result).toBeNull();
    expect(await inspector.exists(KEY)).toBe(0);
  });

  it('should replace a pending code on save', async () => {
    await store.save(USER_ID, 'first');
    await store.registerAttempt(USER_ID);
    await store.registerAttempt(USER_ID);

    await store.save(USER_ID, 'second');

    expect(await store.registerAttempt(USER_ID)).toEqual({ codeHash: 'second', attempts: 1 });
  });

  it('should delete the code', async () => {
    await store.save(USER_ID, 'hash');

    await store.delete(USER_ID);

    expect(await store.registerAttempt(USER_ID)).toBeNull();
  });
});
