import { homedir } from 'node:os';
import { join } from 'node:path';

/** Public client identifier registered with the Ciphrix device-authorization endpoint. */
export const CLI_CLIENT_ID = 'ciphrix-cli';

/** Production API base. Override with `--api-url` or `CIPHRIX_API_URL`. */
export const DEFAULT_API_BASE_URL = 'https://global.api.ciphrix.app/api';

export const normalizeBaseUrl = (value: string): string => value.trim().replace(/\/+$/, '');

export const resolveApiBaseUrl = ({
  flag,
  env = process.env,
}: { flag?: string | undefined; env?: NodeJS.ProcessEnv | undefined } = {}): string => {
  const candidate = flag || env.CIPHRIX_API_URL || DEFAULT_API_BASE_URL;
  const normalized = normalizeBaseUrl(candidate);
  try {
    new URL(normalized);
  } catch {
    throw new Error(`Invalid API URL: ${candidate}`);
  }
  return normalized;
};

export const configDir = (env: NodeJS.ProcessEnv = process.env): string => {
  const xdg = env.XDG_CONFIG_HOME;
  const base = xdg && xdg.trim() !== '' ? xdg : join(homedir(), '.config');
  return join(base, 'ciphrix');
};
