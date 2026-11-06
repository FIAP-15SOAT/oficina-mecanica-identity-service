import { Global, Module } from '@nestjs/common';
import { SNSClient } from '@aws-sdk/client-sns';

import { createSnsClient } from './messaging-clients';
import { OutboxRelayService } from './outbox-relay.service';

@Global()
@Module({
  providers: [{ provide: SNSClient, useFactory: createSnsClient }, OutboxRelayService],
  exports: [SNSClient],
})
export class MessagingModule {}
