import { describe, expect, it } from 'vitest';

import {
  DEFAULT_API_BASE_URL,
  normalizeBaseUrl,
  resolveApiBaseUrl,
  setCliInsecureHttpOptIn,
} from '../src/config.js';

describe('API URL resolution', () => {
  it('normalizes trailing slashes', () => {
    expect(normalizeBaseUrl('https://example.com/api///')).toBe('https://example.com/api');
  });

  it('prefers the flag, then the environment, then the default', () => {
    expect(
      resolveApiBaseUrl({ flag: 'https://flag/api', env: { CIPHRIX_API_URL: 'https://env/api' } }),
    ).toBe('https://flag/api');
    expect(resolveApiBaseUrl({ env: { CIPHRIX_API_URL: 'https://env/api' } })).toBe(
      'https://env/api',
    );
    expect(resolveApiBaseUrl({ env: {} })).toBe(DEFAULT_API_BASE_URL);
  });

  it('rejects an invalid URL', () => {
    expect(() => resolveApiBaseUrl({ flag: 'not-a-url', env: {} })).toThrow(/Invalid API URL/);
  });

  it('keeps arbitrary HTTPS URLs and canonicalizes IPv6 and paths', () => {
    expect(resolveApiBaseUrl({ flag: 'https://[::1]:8443/custom/api///', env: {} })).toBe(
      'https://[::1]:8443/custom/api',
    );
    expect(resolveApiBaseUrl({ flag: 'https://staging.example.com/api', env: {} })).toBe(
      'https://staging.example.com/api',
    );
  });

  it.each(['ftp://example.com/api', 'file:///tmp/api', 'javascript:alert(1)'])(
    'rejects non-HTTP schemes: %s',
    (url) => {
      expect(() => resolveApiBaseUrl({ flag: url, env: {} })).toThrow(/only HTTPS URLs/);
    },
  );

  it.each([
    'https://user:pass@example.com/api',
    'https://@example.com/api',
    'https://example.com/api?tenant=x',
    'https://example.com/api#fragment',
  ])('rejects unsafe URL components: %s', (url) => {
    expect(() => resolveApiBaseUrl({ flag: url, env: {} })).toThrow(
      /without credentials, query, or fragment/,
    );
  });

  it.each(['http://localhost/api', 'http://192.0.2.10/api'])(
    'rejects plaintext HTTP by default: %s',
    (url) => {
      expect(() => resolveApiBaseUrl({ flag: url, env: {} })).toThrow(
        /Refusing to send credentials or data over HTTP/,
      );
    },
  );

  it('allows HTTP only with the explicit environment opt-in or CLI opt-in', () => {
    expect(
      resolveApiBaseUrl({
        flag: 'http://localhost/api',
        env: { CIPHRIX_ALLOW_INSECURE_HTTP: 'true' },
      }),
    ).toBe('http://localhost/api');
    setCliInsecureHttpOptIn(true);
    try {
      expect(resolveApiBaseUrl({ flag: 'http://192.0.2.10/api', env: {} })).toBe(
        'http://192.0.2.10/api',
      );
    } finally {
      setCliInsecureHttpOptIn(false);
    }
  });
});
