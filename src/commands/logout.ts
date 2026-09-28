import { createApiClient } from '../api.js';
import { resolveApiBaseUrl } from '../config.js';
import { createCredentialStore, type CredentialStore } from '../credentials.js';
import { writeLine, type CliIO } from '../io.js';

export interface LogoutOptions {
  io: CliIO;
  apiUrl?: string | undefined;
  store?: CredentialStore | undefined;
}

export const logoutCommand = async ({
  io,
  apiUrl,
  store: injectedStore,
}: LogoutOptions): Promise<void> => {
  const baseUrl = resolveApiBaseUrl({ flag: apiUrl });
  const store = injectedStore ?? (await createCredentialStore());
  const credential = await store.get(baseUrl);

  if (!credential) {
    writeLine(io.stdout, 'Not signed in.');
    return;
  }

  try {
    await createApiClient(baseUrl).request('/auth/sign-out', {
      method: 'POST',
      token: credential.token,
    });
  } catch {
    // Revoking is best-effort; always remove the local credential.
  }

  await store.clear(baseUrl);
  writeLine(io.stdout, `${io.theme.green('✓')} Signed out of ${baseUrl}`);
};
