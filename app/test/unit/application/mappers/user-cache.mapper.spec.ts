import {
  USER_CACHE_VERSION,
  fromCachedUser,
  toCachedUser,
} from '@application/mappers/user-cache.mapper';

import { createMockUser } from '../../../helpers/user-mock.factory';

describe('user cache mapper', () => {
  it('should write the dates as ISO strings', () => {
    const view = createMockUser().toPublicView();

    const cached = JSON.parse(toCachedUser(view));

    expect(cached.createdAt).toBe(view.createdAt.toISOString());
    expect(cached.updatedAt).toBe(view.updatedAt.toISOString());
  });

  it('should restore the public view with Date instances', () => {
    const view = createMockUser().toPublicView();

    const restored = fromCachedUser(JSON.parse(toCachedUser(view)));

    expect(restored).toEqual(view);
    expect(restored.createdAt).toBeInstanceOf(Date);
  });

  it('should write the cache version', () => {
    const cached = JSON.parse(toCachedUser(createMockUser().toPublicView()));

    expect(cached.cacheVersion).toBe(USER_CACHE_VERSION);
  });

  it('should not write the password hash', () => {
    const user = createMockUser();

    expect(toCachedUser(user.toPublicView())).not.toContain(user.passwordHash);
  });
});
