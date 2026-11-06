import { SNSClient } from '@aws-sdk/client-sns';

import {
  createSnsClient,
  SNS_REQUEST_TIMEOUT_MS,
} from '@infrastructure/messaging/messaging-clients';

jest.mock('@aws-sdk/client-sns');

describe('messaging clients', () => {
  it('should create the SNS client with a single attempt and a 2 s request timeout that throws', () => {
    createSnsClient();

    expect(SNSClient).toHaveBeenCalledWith({
      maxAttempts: 1,
      requestHandler: { requestTimeout: SNS_REQUEST_TIMEOUT_MS, throwOnRequestTimeout: true },
    });
    expect(SNS_REQUEST_TIMEOUT_MS).toBe(2_000);
  });
});
