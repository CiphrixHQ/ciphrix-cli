import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../src/api.js';

afterEach(() => vi.unstubAllGlobals());

describe('API redirects', () => {
  it('does not follow redirects or forward authenticated request data', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(null, { status: 302, headers: { location: 'http://other.example/' } }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createApiClient('https://api.example.com/api').request('/tools/v1/list', {
        method: 'POST',
        token: 'secret-token',
        body: { sensitive: 'data' },
      }),
    ).rejects.toThrow(/Redirects are blocked to protect credentials and data/);

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.redirect).toBe('manual');
    expect(init.headers).toMatchObject({ authorization: 'Bearer secret-token' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
