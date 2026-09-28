import { ApiError, type ApiClient } from './api.js';
import { CLI_CLIENT_ID } from './config.js';
import type { DeviceIdentity } from './deviceInfo.js';

export const DEVICE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

export interface DeviceCodeRequest {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string | null;
  intervalSeconds: number;
  expiresInSeconds: number;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const asNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export const requestDeviceCode = async (
  client: ApiClient,
  clientId = CLI_CLIENT_ID,
  identity: DeviceIdentity = {},
): Promise<DeviceCodeRequest> => {
  const body: Record<string, unknown> = { client_id: clientId };
  if (identity.deviceName) body.device_name = identity.deviceName;
  if (identity.devicePlatform) body.device_platform = identity.devicePlatform;

  const data = asRecord(await client.request('/auth/device/code', { method: 'POST', body }));

  const deviceCode = asString(data.device_code);
  const userCode = asString(data.user_code);
  const verificationUri = asString(data.verification_uri);
  if (!deviceCode || !userCode || !verificationUri) {
    throw new Error('The server did not return a device code.');
  }

  const verificationUriComplete = asString(data.verification_uri_complete);

  return {
    deviceCode,
    userCode,
    verificationUri,
    verificationUriComplete: verificationUriComplete || null,
    intervalSeconds: asNumber(data.interval, 5),
    expiresInSeconds: asNumber(data.expires_in, 600),
  };
};

export interface PollOptions {
  client: ApiClient;
  deviceCode: string;
  intervalSeconds: number;
  expiresInSeconds: number;
  clientId?: string;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  onPoll?: () => void;
}

/**
 * Polls the token endpoint until the user approves, the code expires, or the
 * request is denied. Honours `authorization_pending` and `slow_down` per RFC 8628.
 */
export const pollForToken = async ({
  client,
  deviceCode,
  intervalSeconds,
  expiresInSeconds,
  clientId = CLI_CLIENT_ID,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  onPoll,
}: PollOptions): Promise<string> => {
  const deadline = now() + expiresInSeconds * 1000;
  let interval = intervalSeconds;

  while (now() < deadline) {
    await sleep(interval * 1000);
    try {
      const data = asRecord(
        await client.request('/auth/device/token', {
          method: 'POST',
          body: { grant_type: DEVICE_GRANT_TYPE, device_code: deviceCode, client_id: clientId },
        }),
      );
      const token = asString(data.access_token);
      if (!token) throw new Error('The server did not return an access token.');
      return token;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'authorization_pending') {
        onPoll?.();
        continue;
      }
      if (error instanceof ApiError && error.code === 'slow_down') {
        interval += 5;
        onPoll?.();
        continue;
      }
      throw error;
    }
  }

  throw new Error('The device code expired before it was approved. Run `ciphrix login` again.');
};
