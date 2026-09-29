import { ApiError, type ApiClient } from './api.js';
import { CLI_CLIENT_ID } from './config.js';
import type { DeviceIdentity } from './deviceInfo.js';

export const DEVICE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';
export const DEFAULT_POLL_INTERVAL_SECONDS = 5;
export const MIN_POLL_INTERVAL_SECONDS = 1;
export const MAX_INITIAL_POLL_INTERVAL_SECONDS = 60;
export const MAX_POLL_INTERVAL_SECONDS = 300;
export const MAX_DEVICE_CODE_LIFETIME_SECONDS = 3600;

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

const boundedInteger = (
  value: unknown,
  label: string,
  min: number,
  max: number,
  fallback?: number,
  clampMaximum = true,
): number => {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) {
    throw new Error(`The server returned an invalid ${label}.`);
  }
  if (value > max && !clampMaximum) throw new Error(`The server returned an unsupported ${label}.`);
  return Math.min(value, max);
};

const verificationUrl = (value: string, label: string): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`The server returned an invalid ${label}.`);
  }
  const isLoopback =
    url.hostname === 'localhost' ||
    url.hostname === '[::1]' ||
    /^127(?:\.\d{1,3}){3}$/.test(url.hostname);
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) ||
    url.username ||
    url.password
  ) {
    throw new Error(`The server returned an invalid ${label}.`);
  }
  return url.href;
};

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
  const rawVerificationUri = asString(data.verification_uri);
  if (!deviceCode || !userCode || !rawVerificationUri) {
    throw new Error('The server did not return a device code.');
  }

  const verificationUri = verificationUrl(rawVerificationUri, 'verification URL');
  const rawVerificationUriComplete = asString(data.verification_uri_complete);
  const verificationUriComplete = rawVerificationUriComplete
    ? verificationUrl(rawVerificationUriComplete, 'complete verification URL')
    : null;
  const intervalSeconds = boundedInteger(
    data.interval,
    'polling interval',
    MIN_POLL_INTERVAL_SECONDS,
    MAX_INITIAL_POLL_INTERVAL_SECONDS,
    DEFAULT_POLL_INTERVAL_SECONDS,
    false,
  );
  // RFC 8628 requires expires_in. There is no protocol default, so reject a missing or malformed
  // lifetime instead of guessing and potentially polling after the authorization code expires.
  const expiresInSeconds = boundedInteger(
    data.expires_in,
    'device-code lifetime',
    1,
    MAX_DEVICE_CODE_LIFETIME_SECONDS,
  );

  return {
    deviceCode,
    userCode,
    verificationUri,
    verificationUriComplete,
    intervalSeconds,
    expiresInSeconds,
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
  const safeInterval = boundedInteger(
    intervalSeconds,
    'polling interval',
    MIN_POLL_INTERVAL_SECONDS,
    MAX_INITIAL_POLL_INTERVAL_SECONDS,
    undefined,
    false,
  );
  const safeLifetime = boundedInteger(
    expiresInSeconds,
    'device-code lifetime',
    1,
    MAX_DEVICE_CODE_LIFETIME_SECONDS,
  );
  const deadline = now() + safeLifetime * 1000;
  let interval = safeInterval;

  while (now() < deadline) {
    const remainingMs = deadline - now();
    if (remainingMs <= 0) break;
    await sleep(Math.min(interval * 1000, remainingMs));
    if (now() >= deadline) break;
    try {
      const data = asRecord(
        await client.request('/auth/device/token', {
          method: 'POST',
          body: { grant_type: DEVICE_GRANT_TYPE, device_code: deviceCode, client_id: clientId },
        }),
      );
      if (now() >= deadline) break;
      const token = asString(data.access_token);
      if (!token) throw new Error('The server did not return an access token.');
      return token;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'authorization_pending') {
        onPoll?.();
        continue;
      }
      if (error instanceof ApiError && error.code === 'slow_down') {
        if (interval + 5 > MAX_POLL_INTERVAL_SECONDS) {
          throw new Error(
            'The authorization server is asking the CLI to poll too slowly. Run `ciphrix login` again later.',
            { cause: error },
          );
        }
        interval += 5;
        onPoll?.();
        continue;
      }
      throw error;
    }
  }

  throw new Error('The device code expired before it was approved. Run `ciphrix login` again.');
};
