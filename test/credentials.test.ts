import { access, chmod, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const keychain = vi.hoisted(() => ({ fail: false, token: 'keychain-token' }));

vi.mock('@napi-rs/keyring', () => ({
  Entry: class {
    getPassword(): string | null {
      if (keychain.fail) throw new Error('platform error containing details');
      return keychain.token;
    }

    setPassword(token: string): void {
      if (keychain.fail) throw new Error('platform error containing details');
      keychain.token = token;
    }

    deletePassword(): boolean {
      if (keychain.fail) throw new Error('platform error containing details');
      keychain.token = '';
      return true;
    }
  },
}));

import { createCredentialStore } from '../src/credentials.js';

let directory = '';

beforeEach(async () => {
  keychain.fail = false;
  keychain.token = 'keychain-token';
  directory = await mkdtemp(join(tmpdir(), 'ciphrix-cli-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('file credential store', () => {
  it('round-trips a credential, restricts its directory and file, and leaves no temp file', async () => {
    const store = await createCredentialStore({ directory, forceFile: true });

    expect(await store.get('https://api.example.com/api')).toBeNull();

    await store.set({ apiUrl: 'https://api.example.com/api', token: 'secret-token' });
    expect(await store.get('https://api.example.com/api')).toEqual({
      apiUrl: 'https://api.example.com/api',
      token: 'secret-token',
    });

    expect((await stat(directory)).mode & 0o777).toBe(0o700);
    expect((await stat(join(directory, 'credentials.json'))).mode & 0o777).toBe(0o600);
    expect(await readdir(directory)).toEqual(['credentials.json']);

    await store.clear('https://api.example.com/api');
    expect(await store.get('https://api.example.com/api')).toBeNull();
  });

  it('repairs permissive existing directory and credential-file permissions', async () => {
    const path = join(directory, 'credentials.json');
    await writeFile(path, '{"https://api.example.com/api":{"token":"test-token"}}\n', {
      mode: 0o644,
    });
    await chmod(path, 0o644);
    await chmod(directory, 0o755);

    const store = await createCredentialStore({ directory, forceFile: true });
    expect(await store.get('https://api.example.com/api')).toEqual({
      apiUrl: 'https://api.example.com/api',
      token: 'test-token',
    });
    expect((await stat(directory)).mode & 0o777).toBe(0o700);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it('uses the file store only when explicitly selected by environment', async () => {
    const store = await createCredentialStore({
      directory,
      env: { CIPHRIX_CREDENTIAL_STORE: 'file' },
    });
    await store.set({ apiUrl: 'https://api.example.com/api', token: 't' });
    expect(await store.get('https://api.example.com/api')).toEqual({
      apiUrl: 'https://api.example.com/api',
      token: 't',
    });
  });

  it('does not overwrite a malformed credential file', async () => {
    const path = join(directory, 'credentials.json');
    await writeFile(path, '{ broken json');
    const store = await createCredentialStore({ directory, forceFile: true });

    await expect(store.get('https://api.example.com/api')).rejects.toThrow(
      'Unable to read the credential file',
    );
    await expect(
      store.set({ apiUrl: 'https://api.example.com/api', token: 'replacement' }),
    ).rejects.toThrow('Unable to read the credential file');
    expect(await readFile(path, 'utf8')).toBe('{ broken json');
  });

  it('rejects invalid credential shapes and safely handles prototype-like URL keys', async () => {
    const path = join(directory, 'credentials.json');
    await writeFile(path, '{"https://api.example.com/api":{"token":3}}');
    const store = await createCredentialStore({ directory, forceFile: true });

    await expect(store.get('https://api.example.com/api')).rejects.toThrow(
      'Unable to read the credential file',
    );
    await rm(path);
    await store.set({ apiUrl: '__proto__', token: 'safe-token' });
    expect(await store.get('__proto__')).toEqual({ apiUrl: '__proto__', token: 'safe-token' });
  });

  it('rejects a symlink in place of the credential file', async () => {
    const target = join(directory, 'target.json');
    const path = join(directory, 'credentials.json');
    await writeFile(target, '{}');
    await (await import('node:fs/promises')).symlink(target, path);
    const store = await createCredentialStore({ directory, forceFile: true });

    await expect(store.get('https://api.example.com/api')).rejects.toThrow(
      'Unable to read the credential file',
    );
    expect(await readFile(target, 'utf8')).toBe('{}');
  });
});

describe('OS keychain default', () => {
  it('uses the OS keychain without creating a file credential store', async () => {
    const store = await createCredentialStore({ directory });
    await store.set({ apiUrl: 'https://api.example.com/api', token: 'keychain-secret' });

    expect(await store.get('https://api.example.com/api')).toEqual({
      apiUrl: 'https://api.example.com/api',
      token: 'keychain-secret',
    });
    await expect(access(join(directory, 'credentials.json'))).rejects.toThrow();
  });

  it('does not silently fall back to the file store when a keychain operation fails', async () => {
    const store = await createCredentialStore({ directory });
    keychain.fail = true;

    await expect(
      store.set({ apiUrl: 'https://api.example.com/api', token: 'secret-token' }),
    ).rejects.toThrow('For local or headless testing only');
    await expect(access(join(directory, 'credentials.json'))).rejects.toThrow();
  });

  it('does not expose platform error details to the caller', async () => {
    const store = await createCredentialStore({ directory });
    keychain.fail = true;

    await expect(store.get('https://api.example.com/api')).rejects.not.toThrow(
      'platform error containing details',
    );
  });
});
