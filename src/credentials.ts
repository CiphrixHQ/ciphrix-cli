import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { configDir } from './config.js';

export interface Credential {
  apiUrl: string;
  token: string;
}

export interface CredentialStore {
  get(apiUrl: string): Promise<Credential | null>;
  set(credential: Credential): Promise<void>;
  clear(apiUrl: string): Promise<void>;
}

const KEYRING_SERVICE = 'ciphrix-cli';

interface KeyringEntry {
  getPassword(): string | null;
  setPassword(password: string): void;
  deletePassword(): boolean;
}

type EntryFactory = (service: string, account: string) => KeyringEntry;

const loadEntryFactory = async (): Promise<EntryFactory | null> => {
  try {
    const keyring = await import('@napi-rs/keyring');
    return (service, account) => new keyring.Entry(service, account);
  } catch {
    return null;
  }
};

const createKeyringStore = (entryFactory: EntryFactory): CredentialStore => ({
  get: (apiUrl) => {
    const token = entryFactory(KEYRING_SERVICE, apiUrl).getPassword();
    return Promise.resolve(token ? { apiUrl, token } : null);
  },
  set: (credential) => {
    entryFactory(KEYRING_SERVICE, credential.apiUrl).setPassword(credential.token);
    return Promise.resolve();
  },
  clear: (apiUrl) => {
    entryFactory(KEYRING_SERVICE, apiUrl).deletePassword();
    return Promise.resolve();
  },
});

interface CredentialsFile {
  [apiUrl: string]: { token: string };
}

/**
 * 0600 file fallback used when no OS keychain is available (for example a headless
 * Linux box or CI). It is never preferred over the keychain.
 */
const createFileStore = (directory: string): CredentialStore => {
  const path = join(directory, 'credentials.json');

  const read = async (): Promise<CredentialsFile> => {
    try {
      return JSON.parse(await readFile(path, 'utf8')) as CredentialsFile;
    } catch {
      return {};
    }
  };

  const write = async (data: CredentialsFile): Promise<void> => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  };

  return {
    get: async (apiUrl) => {
      const entry = (await read())[apiUrl];
      return entry ? { apiUrl, token: entry.token } : null;
    },
    set: async (credential) => {
      const data = await read();
      data[credential.apiUrl] = { token: credential.token };
      await write(data);
    },
    clear: async (apiUrl) => {
      const data = await read();
      if (!(apiUrl in data)) return;
      delete data[apiUrl];
      await write(data);
    },
  };
};

export interface CredentialStoreOptions {
  directory?: string;
  forceFile?: boolean;
  env?: NodeJS.ProcessEnv;
}

/**
 * Prefers the OS keychain and falls back to the 0600 file store when the keychain
 * is unavailable. `CIPHRIX_CREDENTIAL_STORE=file` forces the file store.
 */
export const createCredentialStore = async (
  options: CredentialStoreOptions = {},
): Promise<CredentialStore> => {
  const { directory = configDir(options.env), forceFile = false, env = process.env } = options;
  const file = createFileStore(directory);
  if (forceFile || env.CIPHRIX_CREDENTIAL_STORE === 'file') return file;

  const entryFactory = await loadEntryFactory();
  if (!entryFactory) return file;
  const keyring = createKeyringStore(entryFactory);

  return {
    get: async (apiUrl) => {
      try {
        const credential = await keyring.get(apiUrl);
        if (credential) return credential;
      } catch {
        // fall through to the file store
      }
      return file.get(apiUrl);
    },
    set: async (credential) => {
      try {
        await keyring.set(credential);
        return;
      } catch {
        // fall through to the file store
      }
      await file.set(credential);
    },
    clear: async (apiUrl) => {
      try {
        await keyring.clear(apiUrl);
      } catch {
        // ignore keychain errors and still clear the file store
      }
      await file.clear(apiUrl);
    },
  };
};
