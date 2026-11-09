import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { BcryptHashService } from './bcrypt-hash.service';
import { JwtTokenService } from './jwt-token.service';

@Module({
  imports: [JwtModule.register({})],
  providers: [
    { provide: 'IHashService', useClass: BcryptHashService },
    { provide: 'ITokenService', useClass: JwtTokenService },
  ],
  exports: ['IHashService', 'ITokenService'],
})
export class InfrastructureServicesModule {}
