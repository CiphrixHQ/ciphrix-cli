import { homedir } from 'node:os';
import { join } from 'node:path';

/** Public client identifier registered with the Ciphrix device-authorization endpoint. */
export const CLI_CLIENT_ID = 'ciphrix-cli';

/** Production API base. Override with `--api-url` or `CIPHRIX_API_URL`. */
export const DEFAULT_API_BASE_URL = 'https://global.api.ciphrix.app/api';

let cliAllowsInsecureHttp = false;

/** Used by the CLI hooks to scope the command-line opt-in to one command invocation. */
export const setCliInsecureHttpOptIn = (allowed: boolean): void => {
  cliAllowsInsecureHttp = allowed;
};

export const normalizeBaseUrl = (value: string): string => {
  const trimmed = value.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`Invalid API URL: ${value}`);
  }
  const authority = trimmed.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i)?.[1] ?? '';

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(
      'Invalid API URL: only HTTPS URLs are supported (HTTP requires explicit opt-in)',
    );
  }
  if (
    !url.hostname ||
    authority.includes('@') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    trimmed.includes('?') ||
    trimmed.includes('#')
  ) {
    throw new Error(
      'Invalid API URL: provide a hostname and optional path without credentials, query, or fragment',
    );
  }

  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url
    .toString()
    .replace(/\/$/, url.pathname === '/' ? '' : '/')
    .replace(/\/$/, '');
};

export const resolveApiBaseUrl = ({
  flag,
  env = process.env,
}: { flag?: string | undefined; env?: NodeJS.ProcessEnv | undefined } = {}): string => {
  const candidate = flag || env.CIPHRIX_API_URL || DEFAULT_API_BASE_URL;
  const normalized = normalizeBaseUrl(candidate);
  const parsed = new URL(normalized);
  const envAllowsInsecureHttp =
    env.CIPHRIX_ALLOW_INSECURE_HTTP === '1' ||
    env.CIPHRIX_ALLOW_INSECURE_HTTP?.toLowerCase() === 'true';
  if (parsed.protocol === 'http:' && !envAllowsInsecureHttp && !cliAllowsInsecureHttp) {
    throw new Error(
      'Refusing to send credentials or data over HTTP. Use HTTPS, or explicitly opt in for local testing with --allow-insecure-http or CIPHRIX_ALLOW_INSECURE_HTTP=true.',
    );
  }
  return normalized;
};

export const configDir = (env: NodeJS.ProcessEnv = process.env): string => {
  const xdg = env.XDG_CONFIG_HOME;
  const base = xdg && xdg.trim() !== '' ? xdg : join(homedir(), '.config');
  return join(base, 'ciphrix');
};
