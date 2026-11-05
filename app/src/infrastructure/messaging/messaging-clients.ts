import { SNSClient } from '@aws-sdk/client-sns';

// Without a timeout a black-holed endpoint hangs the call, the relay batch and the shutdown that
// waits for it; without throwOnRequestTimeout the SDK only writes a warning to the console.
export const SNS_REQUEST_TIMEOUT_MS = 2_000;

// Region, credentials and endpoint come from the environment (AWS_REGION, AWS_ENDPOINT_URL).
export function createSnsClient(): SNSClient {
  // The relay retries on its next tick; SDK retries would multiply the timeout inside the batch.
  return new SNSClient({
    maxAttempts: 1,
    requestHandler: { requestTimeout: SNS_REQUEST_TIMEOUT_MS, throwOnRequestTimeout: true },
  });
}
