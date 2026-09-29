import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const keychain = vi.hoisted(() => ({ token: 'keychain-token' }));

vi.mock('@napi-rs/keyring', () => ({
  Entry: class {
    getPassword(): string | null {
      return keychain.token || null;
    }
    setPassword(token: string): void {
      keychain.token = token;
    }
    deletePassword(): boolean {
      keychain.token = '';
      return true;
    }
  },
}));

import { logoutCommand } from '../src/commands/logout.js';
import { createCredentialStore, type CredentialStore } from '../src/credentials.js';
import { createTheme } from '../src/theme.js';
import type { CliIO } from '../src/io.js';

class Capture {
  chunks: string[] = [];
  isTTY = false;
  write(chunk: string | Uint8Array): boolean {
    this.chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  }
  text(): string {
    return this.chunks.join('');
  }
}

const makeIO = (): { io: CliIO; out: Capture; err: Capture } => {
  const out = new Capture();
  const err = new Capture();
  return {
    io: {
      stdout: out as unknown as NodeJS.WriteStream,
      stderr: err as unknown as NodeJS.WriteStream,
      theme: createTheme(false),
    },
    out,
    err,
  };
};

const makeStore = (token: string | null = 'secret-token') => {
  let current = token;
  let clearCount = 0;
  const store: CredentialStore = {
    get: (apiUrl) => Promise.resolve(current ? { apiUrl, token: current } : null),
    set: () => Promise.resolve(),
    clear: () => {
      clearCount += 1;
      current = null;
      return Promise.resolve();
    },
  };
  return { store, hasCredential: () => current !== null, clearCount: () => clearCount };
};

const response = (status: number, body = '{}'): Response =>
  new Response(status === 204 || status === 205 || status === 304 ? null : body, {
    status,
    headers: { 'content-type': 'application/json' },
  });

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CIPHRIX_ALLOW_INSECURE_HTTP;
});

describe('logout', () => {
  it('revokes the remote session before clearing the local credential', async () => {
    const { io, out } = makeIO();
    const { store, hasCredential, clearCount } = makeStore();
    const fetchMock = vi.fn(() => Promise.resolve(response(204)));
    vi.stubGlobal('fetch', fetchMock);

    await logoutCommand({ io, apiUrl: 'https://api.example.com/api', store });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toEqual({
      authorization: 'Bearer secret-token',
    });
    expect(clearCount()).toBe(1);
    expect(hasCredential()).toBe(false);
    expect(out.text()).toContain('Revoked the remote session');
    expect(out.text()).not.toContain('secret-token');
  });

  it('reports no credential without making a request or clearing storage', async () => {
    const { io, out } = makeIO();
    const { store, clearCount } = makeStore(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await logoutCommand({ io, apiUrl: 'https://api.example.com/api', store });

    expect(out.text()).toContain('Not signed in.');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(clearCount()).toBe(0);
  });

  it.each([
    [401, '{"code":"unauthorized"}'],
    [404, '{"code":"session_not_found"}'],
  ])(
    'clears the local credential when the remote credential is already invalid (%i)',
    async (status, body) => {
      const { io, out } = makeIO();
      const { store, hasCredential } = makeStore();
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve(response(status, body))),
      );

      await logoutCommand({ io, apiUrl: 'https://api.example.com/api', store });

      expect(hasCredential()).toBe(false);
      expect(out.text()).toContain('already invalid');
    },
  );

  it.each([502, 503])('retains the credential after a server failure (%i)', async (status) => {
    const { io } = makeIO();
    const { store, hasCredential, clearCount } = makeStore();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(response(status, '{"message":"private detail"}'))),
    );

    await expect(
      logoutCommand({ io, apiUrl: 'https://api.example.com/api', store }),
    ).rejects.toThrow('credential was kept so you can retry');
    expect(hasCredential()).toBe(true);
    expect(clearCount()).toBe(0);
  });

  it('retains the credential after a network failure without exposing its details', async () => {
    const { io } = makeIO();
    const { store, hasCredential, clearCount } = makeStore();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('private network detail'))),
    );

    const error = await logoutCommand({
      io,
      apiUrl: 'https://api.example.com/api',
      store,
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('credential was kept so you can retry');
    expect((error as Error).message).not.toContain('private network detail');
    expect(hasCredential()).toBe(true);
    expect(clearCount()).toBe(0);
  });

  it('supports local-only removal for a custom HTTP API URL and leaves the remote session alone', async () => {
    process.env.CIPHRIX_ALLOW_INSECURE_HTTP = 'true';
    const { io, out } = makeIO();
    const { store, hasCredential, clearCount } = makeStore();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await logoutCommand({
      io,
      apiUrl: 'http://localhost:4443/api',
      localOnly: true,
      store,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(clearCount()).toBe(1);
    expect(hasCredential()).toBe(false);
    expect(out.text()).toContain('remote session is still active');
  });

  it('reports a local credential-store failure without claiming local removal', async () => {
    const { io } = makeIO();
    const { store } = makeStore();
    store.clear = () => Promise.reject(new Error('private keychain detail'));
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(response(204))),
    );

    const error = await logoutCommand({
      io,
      apiUrl: 'https://api.example.com/api',
      store,
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('remote session was revoked');
    expect((error as Error).message).not.toContain('private keychain detail');
  });

  it('uses the same local-only behavior with the explicit file credential store', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ciphrix-logout-'));
    try {
      const store = await createCredentialStore({ directory, forceFile: true });
      await store.set({ apiUrl: 'https://api.example.com/api', token: 'file-token' });
      const { io, out } = makeIO();
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      await logoutCommand({ io, apiUrl: 'https://api.example.com/api', localOnly: true, store });

      expect(await store.get('https://api.example.com/api')).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(out.text()).toContain('remote session is still active');
      expect(out.text()).not.toContain('file-token');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('supports local-only removal from the default keychain store', async () => {
    keychain.token = 'keychain-token';
    const store = await createCredentialStore({ env: {} });
    const { io, out } = makeIO();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await logoutCommand({ io, apiUrl: 'https://api.example.com/api', localOnly: true, store });

    expect(await store.get('https://api.example.com/api')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(out.text()).toContain('remote session is still active');
  });
});
