import { Module } from '@nestjs/common';

import { BcryptHashService } from './bcrypt-hash.service';

@Module({
  providers: [{ provide: 'IHashService', useClass: BcryptHashService }],
  exports: ['IHashService'],
})
export class InfrastructureServicesModule {}
