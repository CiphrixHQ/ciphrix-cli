import { describe, expect, it, vi } from 'vitest';

import { ApiError, type ApiClient } from '../src/api.js';
import { pollForToken, requestDeviceCode } from '../src/deviceFlow.js';

const clientWith = (request: unknown): ApiClient =>
  ({ baseUrl: 'https://api.example.com/api', request }) as ApiClient;

const pending = () => new ApiError('authorization_pending', 400, 'authorization_pending');

describe('requestDeviceCode', () => {
  it('maps the server response', async () => {
    const request = vi.fn().mockResolvedValue({
      device_code: 'device',
      user_code: 'user',
      verification_uri: 'https://app.example.com/device',
      interval: 5,
      expires_in: 600,
    });

    await expect(requestDeviceCode(clientWith(request))).resolves.toEqual({
      deviceCode: 'device',
      userCode: 'user',
      verificationUri: 'https://app.example.com/device',
      verificationUriComplete: null,
      intervalSeconds: 5,
      expiresInSeconds: 600,
    });
  });

  it('rejects a response without a device code', async () => {
    const request = vi.fn().mockResolvedValue({});
    await expect(requestDeviceCode(clientWith(request))).rejects.toThrow(/device code/);
  });
});

describe('pollForToken', () => {
  const options = (request: unknown, overrides = {}) => ({
    client: clientWith(request),
    deviceCode: 'device',
    intervalSeconds: 0,
    expiresInSeconds: 60,
    sleep: () => Promise.resolve(),
    now: () => 0,
    ...overrides,
  });

  it('returns the token once approved, retrying while pending', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(pending())
      .mockResolvedValueOnce({ access_token: 'token' });

    await expect(pollForToken(options(request))).resolves.toBe('token');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('backs off on slow_down', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('slow_down', 400, 'slow_down'))
      .mockResolvedValueOnce({ access_token: 'token' });

    await expect(pollForToken(options(request))).resolves.toBe('token');
  });

  it('propagates a denied request', async () => {
    const request = vi.fn().mockRejectedValue(new ApiError('access_denied', 400, 'access_denied'));
    await expect(pollForToken(options(request))).rejects.toThrow(/access_denied/);
  });

  it('fails once the code expires', async () => {
    let now = 0;
    const request = vi.fn().mockRejectedValue(pending());
    await expect(
      pollForToken(
        options(request, {
          expiresInSeconds: 1,
          sleep: () => {
            now = 10_000;
            return Promise.resolve();
          },
          now: () => now,
        }),
      ),
    ).rejects.toThrow(/expired/);
  });
});
