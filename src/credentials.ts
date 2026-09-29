import { constants } from 'node:fs';
import { chmod, lstat, mkdir, open, rename, rm, type FileHandle } from 'node:fs/promises';
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

const keychainError = (): Error =>
  new Error(
    'The OS keychain is unavailable or could not be accessed. No credential was read, saved, or removed. ' +
      'For local or headless testing only, explicitly set CIPHRIX_CREDENTIAL_STORE=file to use the ' +
      'permission-restricted file store.',
  );

const loadEntryFactory = async (): Promise<EntryFactory> => {
  try {
    const keyring = await import('@napi-rs/keyring');
    return (service, account) => new keyring.Entry(service, account);
  } catch {
    throw keychainError();
  }
};

const createKeyringStore = (entryFactory: EntryFactory): CredentialStore => ({
  get: (apiUrl) => {
    try {
      const token = entryFactory(KEYRING_SERVICE, apiUrl).getPassword();
      return Promise.resolve(token ? { apiUrl, token } : null);
    } catch {
      return Promise.reject(keychainError());
    }
  },
  set: (credential) => {
    try {
      entryFactory(KEYRING_SERVICE, credential.apiUrl).setPassword(credential.token);
      return Promise.resolve();
    } catch {
      return Promise.reject(keychainError());
    }
  },
  clear: (apiUrl) => {
    try {
      entryFactory(KEYRING_SERVICE, apiUrl).deletePassword();
      return Promise.resolve();
    } catch {
      return Promise.reject(keychainError());
    }
  },
});

interface CredentialsFile {
  [apiUrl: string]: { token: string };
}

const fileStoreError = (action: string): Error =>
  new Error(`Unable to ${action} the credential file. Check its permissions and integrity.`);

const ensurePrivateDirectory = async (directory: string): Promise<void> => {
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const info = await lstat(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) throw fileStoreError('access');
    await chmod(directory, 0o700);
  } catch {
    throw fileStoreError('secure');
  }
};

const isMissing = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

const parseCredentials = (contents: string): CredentialsFile => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw fileStoreError('read');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw fileStoreError('read');
  }

  const credentials: CredentialsFile = Object.create(null) as CredentialsFile;
  for (const [apiUrl, value] of Object.entries(parsed)) {
    if (
      apiUrl.length === 0 ||
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value) ||
      typeof (value as { token?: unknown }).token !== 'string' ||
      (value as { token: string }).token.length === 0
    ) {
      throw fileStoreError('read');
    }
    Object.defineProperty(credentials, apiUrl, {
      value: { token: (value as { token: string }).token },
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return credentials;
};

const createFileStore = (directory: string): CredentialStore => {
  const path = join(directory, 'credentials.json');
  let operationQueue: Promise<void> = Promise.resolve();

  const serialized = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = operationQueue.then(operation);
    operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const read = async (): Promise<CredentialsFile> => {
    await ensurePrivateDirectory(dirname(path));
    let file: FileHandle | undefined;
    try {
      try {
        const pathInfo = await lstat(path);
        if (pathInfo.isSymbolicLink() || !pathInfo.isFile()) throw fileStoreError('read');
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
      const noFollow = constants.O_NOFOLLOW ?? 0;
      file = await open(path, constants.O_RDONLY | noFollow);
      const info = await file.stat();
      if (!info.isFile()) throw fileStoreError('read');
      await file.chmod(0o600);
      return parseCredentials(await file.readFile('utf8'));
    } catch (error) {
      if (isMissing(error)) return Object.create(null) as CredentialsFile;
      throw fileStoreError('read');
    } finally {
      await file?.close().catch(() => undefined);
    }
  };

  const write = async (data: CredentialsFile): Promise<void> => {
    await ensurePrivateDirectory(dirname(path));
    const temporaryPath = join(
      dirname(path),
      `.credentials-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`,
    );
    let handle;
    try {
      handle = await open(temporaryPath, 'wx', 0o600);
      await handle.writeFile(`${JSON.stringify(data, null, 2)}\n`, 'utf8');
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(temporaryPath, path);
    } catch {
      await handle?.close().catch(() => undefined);
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw fileStoreError('write');
    }
  };

  return {
    get: (apiUrl) =>
      serialized(async () => {
        const entry = (await read())[apiUrl];
        return entry ? { apiUrl, token: entry.token } : null;
      }),
    set: (credential) =>
      serialized(async () => {
        if (!credential.apiUrl || !credential.token) throw fileStoreError('write');
        const data = await read();
        Object.defineProperty(data, credential.apiUrl, {
          value: { token: credential.token },
          enumerable: true,
          configurable: true,
          writable: true,
        });
        await write(data);
      }),
    clear: (apiUrl) =>
      serialized(async () => {
        const data = await read();
        if (!Object.hasOwn(data, apiUrl)) return;
        delete data[apiUrl];
        await write(data);
      }),
  };
};

export interface CredentialStoreOptions {
  directory?: string;
  forceFile?: boolean;
  env?: NodeJS.ProcessEnv;
}

/**
 * Uses the OS keychain by default. The less secure file store is only used when
 * explicitly selected with `CIPHRIX_CREDENTIAL_STORE=file` or `forceFile`.
 */
export const createCredentialStore = async (
  options: CredentialStoreOptions = {},
): Promise<CredentialStore> => {
  const { directory = configDir(options.env), forceFile = false, env = process.env } = options;
  if (forceFile || env.CIPHRIX_CREDENTIAL_STORE === 'file') return createFileStore(directory);
  return createKeyringStore(await loadEntryFactory());
};
