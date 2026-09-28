import { ApiError, createApiClient } from '../api.js';
import { resolveApiBaseUrl } from '../config.js';
import { createCredentialStore, type CredentialStore } from '../credentials.js';
import { writeLine, type CliIO } from '../io.js';

export interface LogoutOptions {
  io: CliIO;
  apiUrl?: string | undefined;
  store?: CredentialStore | undefined;
  localOnly?: boolean | undefined;
}

const isInvalidCredential = (error: unknown): boolean => {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 401) return true;
  if (error.status !== 404) return false;
  return ['invalid_token', 'session_not_found', 'token_not_found', 'not_found'].includes(
    error.code?.toLowerCase() ?? '',
  );
};

export const logoutCommand = async ({
  io,
  apiUrl,
  store: injectedStore,
  localOnly = false,
}: LogoutOptions): Promise<void> => {
  const baseUrl = resolveApiBaseUrl({ flag: apiUrl });
  const store = injectedStore ?? (await createCredentialStore());
  const credential = await store.get(baseUrl);

  if (!credential) {
    writeLine(io.stdout, 'Not signed in.');
    return;
  }

  if (localOnly) {
    await store.clear(baseUrl);
    writeLine(io.stdout, `${io.theme.yellow('!')} Removed the local credential for ${baseUrl}.`);
    writeLine(
      io.stdout,
      'The remote session is still active. Revoke it from the account session settings.',
    );
    return;
  }

  let alreadyInvalid = false;
  try {
    await createApiClient(baseUrl).request('/auth/sign-out', {
      method: 'POST',
      token: credential.token,
    });
  } catch (error) {
    if (!isInvalidCredential(error)) {
      throw new Error(
        `Could not confirm remote session revocation. The credential was kept so you can retry. ` +
          `Retry later, or use --local-only to remove it from this device without revoking the session.`,
        { cause: error },
      );
    }
    alreadyInvalid = true;
  }

  try {
    await store.clear(baseUrl);
  } catch {
    if (alreadyInvalid) {
      throw new Error(
        'The remote session is no longer valid, but the local credential could not be removed. ' +
          'Check the credential store and remove it manually if needed.',
      );
    }
    throw new Error(
      'The remote session was revoked, but the local credential could not be removed. ' +
        'Check the credential store and remove it manually if needed.',
    );
  }

  writeLine(
    io.stdout,
    alreadyInvalid
      ? `${io.theme.green('✓')} The remote session was already invalid; removed the local credential for ${baseUrl}.`
      : `${io.theme.green('✓')} Revoked the remote session and removed the local credential for ${baseUrl}.`,
  );
};
