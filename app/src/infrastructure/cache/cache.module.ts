import { Global, Module } from '@nestjs/common';

import { ValkeyCacheAdapter } from './valkey-cache.adapter';
import { ValkeyPasswordResetCodeStore } from './valkey-password-reset-code.store';

@Global()
@Module({
  providers: [
    { provide: 'ICache', useClass: ValkeyCacheAdapter },
    { provide: 'PASSWORD_RESET_CODE_STORE', useClass: ValkeyPasswordResetCodeStore },
  ],
  exports: ['ICache', 'PASSWORD_RESET_CODE_STORE'],
})
export class CacheModule {}
