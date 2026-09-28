import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ToolContext } from '../src/toolSurface.js';
import { uploadLocalFile } from '../src/upload.js';

const ctx = {
  baseUrl: 'https://api.example.com/api',
  token: 'token',
  client: {},
} as unknown as ToolContext;

const withTempFile = async (name: string, contents: string) => {
  const dir = await mkdtemp(join(tmpdir(), 'ciphrix-upload-'));
  const path = join(dir, name);
  await writeFile(path, contents);
  return { path, cleanup: () => rm(dir, { recursive: true, force: true }) };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('uploadLocalFile', () => {
  it('posts the file to the upload_file tool with the bearer credential', async () => {
    const { path, cleanup } = await withTempFile('evidence.txt', 'hello');
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            status: 'ok',
            data: { uploadId: 'upload-1', filename: 'evidence.txt', size: 5 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    try {
      const result = await uploadLocalFile(ctx, path, 'test');

      expect(result).toEqual({ id: 'upload-1', filename: 'evidence.txt', size: 5 });
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe('https://api.example.com/api/tools/v1/upload_file');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>).authorization).toBe('Bearer token');
      expect(init.headers as Record<string, string>).toHaveProperty('idempotency-key');
      expect(init.body).toBeInstanceOf(FormData);
    } finally {
      await cleanup();
    }
  });

  it('surfaces the tool error message when staging fails', async () => {
    const { path, cleanup } = await withTempFile('evidence.txt', 'hello');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ status: 'error', error: { message: 'Invalid upload purpose' } }),
            {
              status: 400,
              headers: { 'content-type': 'application/json' },
            },
          ),
        ),
      ),
    );

    try {
      await expect(uploadLocalFile(ctx, path, 'test')).rejects.toThrow('Invalid upload purpose');
    } finally {
      await cleanup();
    }
  });

  it('blocks upload redirects so evidence and bearer credentials stay on the configured origin', async () => {
    const { path, cleanup } = await withTempFile('evidence.txt', 'hello');
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(null, { status: 307, headers: { location: 'https://other.example/upload' } }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    try {
      await expect(uploadLocalFile(ctx, path, 'test')).rejects.toThrow(
        /Redirects are blocked to protect credentials and data/,
      );
      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(init.redirect).toBe('manual');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      await cleanup();
    }
  });
});
