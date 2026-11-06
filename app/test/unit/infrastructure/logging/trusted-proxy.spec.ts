import express from 'express';
import request from 'supertest';

import { buildAccessLogAttributes } from '@infrastructure/logging/access-log.builder';
import {
  applyTrustProxy,
  resolveLoggerConfig,
  TRUST_PROXY_REJECTED_WARNING,
} from '@infrastructure/logging/logger.config';

function createApp(trustedProxyCidrs?: string): express.Express {
  const app = express();

  applyTrustProxy(
    app,
    resolveLoggerConfig({ TRUSTED_PROXY_CIDRS: trustedProxyCidrs }).trustedProxies,
  );

  app.get('/probe', (req, res) => {
    res.json({
      clientAddress: buildAccessLogAttributes(req, res, {})['client.address'],
    });
  });

  return app;
}

describe('client address resolution', () => {
  it('should ignore a forwarded header sent by an untrusted peer', async () => {
    const response = await request(createApp())
      .get('/probe')
      .set('x-forwarded-for', '203.0.113.9')
      .expect(200);

    expect(response.body.clientAddress).not.toBe('203.0.113.9');
  });

  it('should ignore a forwarded header when the configured list is invalid', async () => {
    const response = await request(createApp('not-an-ip'))
      .get('/probe')
      .set('x-forwarded-for', '203.0.113.9')
      .expect(200);

    expect(response.body.clientAddress).not.toBe('203.0.113.9');
  });

  it('should resolve a multi-hop chain to the first untrusted hop', async () => {
    const response = await request(createApp('loopback,10.0.0.0/8'))
      .get('/probe')
      .set('x-forwarded-for', '203.0.113.9, 198.51.100.7, 10.0.0.5')
      .expect(200);

    expect(response.body.clientAddress).toBe('198.51.100.7');
  });

  it('should not take the leftmost forwarded value when it is forgeable', async () => {
    const response = await request(createApp('loopback'))
      .get('/probe')
      .set('x-forwarded-for', '203.0.113.9, 198.51.100.7')
      .expect(200);

    expect(response.body.clientAddress).toBe('198.51.100.7');
  });

  it('should fall back to trusting nothing when Express rejects the configured list', async () => {
    const response = await request(createApp('1:2:3:4:5:6:7:8:9:10:11'))
      .get('/probe')
      .set('x-forwarded-for', '203.0.113.9')
      .expect(200);

    expect(response.body.clientAddress).not.toBe('203.0.113.9');
  });

  it('should warn and trust nothing when Express rejects the configured list', () => {
    const applied: string[] = [];
    const target = {
      set: (_setting: string, value: unknown) => {
        if (Array.isArray(value) && value.includes('::::')) {
          throw new TypeError('invalid IP address: ::::');
        }

        applied.push(String(value));

        return value;
      },
    };

    expect(applyTrustProxy(target, ['::::'])).toEqual([TRUST_PROXY_REJECTED_WARNING]);
    expect(applied).toEqual(['false']);
  });

  it('should emit no warning for a list Express accepts', () => {
    expect(applyTrustProxy({ set: () => undefined }, ['10.0.0.0/8'])).toEqual([]);
  });
});
