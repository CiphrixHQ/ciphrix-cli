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

describe('API request limits', () => {
  it('aborts a request after its configured timeout and reports a safe message', async () => {
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createApiClient('https://api.example.com/api', { timeoutMs: 5 }).request('/tools/v1/list'),
    ).rejects.toThrow('Request timed out after 1 seconds.');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).signal?.aborted).toBe(true);
  });

  it('rejects an oversized declared response before reading its body', async () => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode('x'));
      },
      cancel() {},
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(body, { headers: { 'content-length': '11' } }))),
    );

    await expect(
      createApiClient('https://api.example.com/api', { maxResponseBytes: 10 }).request(
        '/tools/v1/list',
      ),
    ).rejects.toThrow('response exceeds the 10-byte size limit');
  });

  it('enforces a streaming response limit even when the declared size is absent or false', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('123456'));
        controller.enqueue(new TextEncoder().encode('78901'));
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(body))),
    );

    await expect(
      createApiClient('https://api.example.com/api', { maxResponseBytes: 10 }).request(
        '/tools/v1/list',
      ),
    ).rejects.toThrow('response exceeds the 10-byte size limit');
  });

  it('accepts a response exactly at the configured byte limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{"ok":true}', { status: 200 }))),
    );

    await expect(
      createApiClient('https://api.example.com/api', { maxResponseBytes: 11 }).request(
        '/tools/v1/list',
      ),
    ).resolves.toEqual({ ok: true });
  });
});
