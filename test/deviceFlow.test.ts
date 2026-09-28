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

  it('uses the RFC default interval when the optional interval is absent', async () => {
    const request = vi.fn().mockResolvedValue({
      device_code: 'device',
      user_code: 'user',
      verification_uri: 'https://app.example.com/device',
      expires_in: 600,
    });
    await expect(requestDeviceCode(clientWith(request))).resolves.toMatchObject({
      intervalSeconds: 5,
      expiresInSeconds: 600,
    });
  });

  it.each([
    'file:///tmp/authorize',
    'javascript:alert(1)',
    'http://app.example.com/device',
    'https://user:pass@app.example.com/device',
  ])('rejects an unsafe verification URL: %s', async (verification_uri) => {
    const request = vi.fn().mockResolvedValue({
      device_code: 'device',
      user_code: 'user',
      verification_uri,
      expires_in: 600,
    });
    await expect(requestDeviceCode(clientWith(request))).rejects.toThrow(/verification URL/);
  });

  it('permits a loopback HTTP verification URL for local testing', async () => {
    const request = vi.fn().mockResolvedValue({
      device_code: 'device',
      user_code: 'user',
      verification_uri: 'http://localhost:3000/device',
      expires_in: 600,
    });
    await expect(requestDeviceCode(clientWith(request))).resolves.toMatchObject({
      verificationUri: 'http://localhost:3000/device',
    });
  });

  it('rejects a missing, non-integer, or non-positive required expiry', async () => {
    for (const expires_in of [undefined, 0, -1, 1.5, '600']) {
      const request = vi.fn().mockResolvedValue({
        device_code: 'device',
        user_code: 'user',
        verification_uri: 'https://app.example.com/device',
        expires_in,
      });
      await expect(requestDeviceCode(clientWith(request))).rejects.toThrow(/device-code lifetime/);
    }
  });

  it('clamps a very long server expiry to a one-hour local limit', async () => {
    const request = vi.fn().mockResolvedValue({
      device_code: 'device',
      user_code: 'user',
      verification_uri: 'https://app.example.com/device',
      interval: 5,
      expires_in: 99_999,
    });
    await expect(requestDeviceCode(clientWith(request))).resolves.toMatchObject({
      expiresInSeconds: 3600,
    });
  });

  it('rejects an initial polling interval above the supported maximum', async () => {
    const request = vi.fn().mockResolvedValue({
      device_code: 'device',
      user_code: 'user',
      verification_uri: 'https://app.example.com/device',
      interval: 99_999,
      expires_in: 600,
    });
    await expect(requestDeviceCode(clientWith(request))).rejects.toThrow(
      /unsupported polling interval/,
    );
  });

  it.each([0, -1, 1.5, '5'])(
    'rejects an invalid initial polling interval: %s',
    async (interval) => {
      const request = vi.fn().mockResolvedValue({
        device_code: 'device',
        user_code: 'user',
        verification_uri: 'https://app.example.com/device',
        interval,
        expires_in: 600,
      });
      await expect(requestDeviceCode(clientWith(request))).rejects.toThrow(/polling interval/);
    },
  );
});

describe('pollForToken', () => {
  const options = (request: unknown, overrides = {}) => ({
    client: clientWith(request),
    deviceCode: 'device',
    intervalSeconds: 5,
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
    const sleeps: number[] = [];
    const request = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('slow_down', 400, 'slow_down'))
      .mockResolvedValueOnce({ access_token: 'token' });

    await expect(
      pollForToken(
        options(request, {
          sleep: (ms: number) => {
            sleeps.push(ms);
            return Promise.resolve();
          },
        }),
      ),
    ).resolves.toBe('token');
    expect(sleeps).toEqual([5_000, 10_000]);
  });

  it('waits the interval before the first poll and every authorization_pending retry', async () => {
    const sleeps: number[] = [];
    const request = vi
      .fn()
      .mockRejectedValueOnce(pending())
      .mockResolvedValueOnce({ access_token: 'token' });
    await expect(
      pollForToken(
        options(request, {
          intervalSeconds: 7,
          sleep: (ms: number) => {
            sleeps.push(ms);
            return Promise.resolve();
          },
        }),
      ),
    ).resolves.toBe('token');
    expect(request).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([7_000, 7_000]);
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

  it('never sleeps beyond the remaining lifetime and skips a poll if the interval reaches expiry', async () => {
    let now = 0;
    const sleeps: number[] = [];
    const request = vi.fn().mockRejectedValue(pending());
    await expect(
      pollForToken(
        options(request, {
          intervalSeconds: 5,
          expiresInSeconds: 2,
          sleep: (ms: number) => {
            sleeps.push(ms);
            now += ms;
            return Promise.resolve();
          },
          now: () => now,
        }),
      ),
    ).rejects.toThrow(/expired/);
    expect(request).not.toHaveBeenCalled();
    expect(sleeps).toEqual([2_000]);
  });

  it('increases by five seconds on every slow_down and stops before an unbounded interval', async () => {
    const sleeps: number[] = [];
    const request = vi.fn().mockRejectedValue(new ApiError('slow_down', 400, 'slow_down'));
    await expect(
      pollForToken(
        options(request, {
          intervalSeconds: 60,
          expiresInSeconds: 900,
          sleep: (ms: number) => {
            sleeps.push(ms);
            return Promise.resolve();
          },
        }),
      ),
    ).rejects.toThrow(/poll too slowly/);
    expect(sleeps.slice(0, 2)).toEqual([60_000, 65_000]);
    expect(sleeps).toHaveLength(49);
  });
});
