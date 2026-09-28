import { describe, expect, it } from 'vitest';

import { DEFAULT_API_BASE_URL, normalizeBaseUrl, resolveApiBaseUrl } from '../src/config.js';

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
});
