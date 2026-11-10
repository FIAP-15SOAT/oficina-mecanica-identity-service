import { UserPublicView } from '@domain/entities/user.entity';

// Bump when the cached shape changes: values written by the previous code then read as misses.
export const USER_CACHE_VERSION = 1;

export type CachedUser = Omit<UserPublicView, 'createdAt' | 'updatedAt'> & {
  cacheVersion: number;
  createdAt: string;
  updatedAt: string;
};

export function toCachedUser(view: UserPublicView): string {
  const cached: CachedUser = {
    ...view,
    cacheVersion: USER_CACHE_VERSION,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };

  return JSON.stringify(cached);
}

export function fromCachedUser(cached: CachedUser): UserPublicView {
  const { cacheVersion: _cacheVersion, ...view } = cached;

  return {
    ...view,
    createdAt: new Date(cached.createdAt),
    updatedAt: new Date(cached.updatedAt),
  };
}
