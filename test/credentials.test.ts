import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createCredentialStore } from '../src/credentials.js';

let directory = '';

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ciphrix-cli-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('file credential store', () => {
  it('round-trips a credential and writes it as 0600', async () => {
    const store = await createCredentialStore({ directory, forceFile: true });

    expect(await store.get('https://api.example.com/api')).toBeNull();

    await store.set({ apiUrl: 'https://api.example.com/api', token: 'secret-token' });
    expect(await store.get('https://api.example.com/api')).toEqual({
      apiUrl: 'https://api.example.com/api',
      token: 'secret-token',
    });

    const mode = (await stat(join(directory, 'credentials.json'))).mode & 0o777;
    expect(mode).toBe(0o600);

    await store.clear('https://api.example.com/api');
    expect(await store.get('https://api.example.com/api')).toBeNull();
  });

  it('is forced to the file store by CIPHRIX_CREDENTIAL_STORE=file', async () => {
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
});
