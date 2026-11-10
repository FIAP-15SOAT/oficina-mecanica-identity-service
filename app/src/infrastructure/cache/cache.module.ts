import { Global, Module } from '@nestjs/common';

import { ValkeyCacheAdapter } from './valkey-cache.adapter';
import { ValkeyPasswordResetCodeStore } from './valkey-password-reset-code.store';

@Global()
@Module({
  providers: [
    { provide: 'ICache', useClass: ValkeyCacheAdapter },
    { provide: 'IPasswordResetCodeStore', useClass: ValkeyPasswordResetCodeStore },
  ],
  exports: ['ICache', 'IPasswordResetCodeStore'],
})
export class CacheModule {}
