import { createApiClient } from '../api.js';
import { CLI_CLIENT_ID, resolveApiBaseUrl } from '../config.js';
import { createCredentialStore, type CredentialStore } from '../credentials.js';
import { resolveDeviceIdentity } from '../deviceInfo.js';
import { pollForToken, requestDeviceCode } from '../deviceFlow.js';
import { writeLine, type CliIO } from '../io.js';

export interface LoginOptions {
  io: CliIO;
  apiUrl?: string | undefined;
  clientId?: string | undefined;
  deviceName?: string | undefined;
  store?: CredentialStore | undefined;
}

export const loginCommand = async ({
  io,
  apiUrl,
  clientId = CLI_CLIENT_ID,
  deviceName,
  store: injectedStore,
}: LoginOptions): Promise<void> => {
  const baseUrl = resolveApiBaseUrl({ flag: apiUrl });
  const client = createApiClient(baseUrl);
  const store = injectedStore ?? (await createCredentialStore());

  const identity = resolveDeviceIdentity(deviceName);
  const code = await requestDeviceCode(client, clientId, identity);
  const link = code.verificationUriComplete ?? code.verificationUri;

  writeLine(io.stdout, io.theme.bold('Authorize the Ciphrix CLI'));
  writeLine(io.stdout);
  writeLine(io.stdout, `  ${io.theme.cyan(link)}`);
  writeLine(io.stdout);
  writeLine(io.stdout, io.theme.dim(`Device: ${identity.deviceName} (${identity.devicePlatform})`));
  if (code.verificationUriComplete) {
    writeLine(
      io.stdout,
      io.theme.dim(`Or enter the code ${code.userCode} at ${code.verificationUri}`),
    );
  } else {
    writeLine(io.stdout, io.theme.dim(`Enter the code ${code.userCode}`));
  }
  writeLine(io.stdout, io.theme.dim('Waiting for approval…'));

  const token = await pollForToken({
    client,
    deviceCode: code.deviceCode,
    intervalSeconds: code.intervalSeconds,
    expiresInSeconds: code.expiresInSeconds,
    clientId,
  });

  await store.set({ apiUrl: baseUrl, token });

  // Label this session so the user can recognise it in their device list. Best-effort: a failure here
  // must not fail the login.
  try {
    await client.request('/user/profile/sessions/label', {
      method: 'POST',
      token,
      body: { deviceName: identity.deviceName, devicePlatform: identity.devicePlatform },
    });
  } catch {
    // ignore
  }

  writeLine(io.stdout, `${io.theme.green('✓')} Signed in to ${baseUrl}`);
};
