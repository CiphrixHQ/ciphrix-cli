import { createApiClient, type ApiClient } from './api.js';
import { resolveApiBaseUrl } from './config.js';
import { createCredentialStore, type CredentialStore } from './credentials.js';

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

export const asText = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

/**
 * The message a caller should see. Ambiguous-name errors carry the candidates, so they are rendered here —
 * otherwise the user is told "use a code" without being shown which codes exist.
 */
export const errorMessage = (envelope: Record<string, unknown>, fallback: string): string => {
  const error = asRecord(envelope.error);
  const base = asText(error.message, fallback);
  if (error.code === 'ambiguous' && Array.isArray(error.details)) {
    const candidates = (error.details as unknown[])
      .map((item) => {
        const record = asRecord(item);
        const code = asText(record.code);
        const name = asText(record.name);
        if (code && name) return `${code}  ${name}`;
        return code || name || asText(record.id);
      })
      .filter((value) => value !== '');
    if (candidates.length > 0) return `${base}\n  ${candidates.join('\n  ')}`;
  }
  return base;
};

export interface ToolContext {
  baseUrl: string;
  client: ApiClient;
  token: string;
}

export const resolveToolContext = async (
  apiUrl?: string,
  store?: CredentialStore,
): Promise<ToolContext> => {
  const baseUrl = resolveApiBaseUrl({ flag: apiUrl });
  const credentialStore = store ?? (await createCredentialStore());
  const credential = await credentialStore.get(baseUrl);
  if (!credential) throw new Error('Not signed in. Run `ciphrix login` first.');
  return { baseUrl, client: createApiClient(baseUrl), token: credential.token };
};

export interface CallToolOptions {
  confirmationToken?: string | undefined;
  idempotencyKey?: string | undefined;
}

export const callTool = async (
  ctx: ToolContext,
  toolName: string,
  input: unknown,
  options: CallToolOptions = {},
): Promise<Record<string, unknown>> => {
  const body: Record<string, unknown> = { input };
  if (options.confirmationToken) body.confirmationToken = options.confirmationToken;
  if (options.idempotencyKey) body.idempotencyKey = options.idempotencyKey;

  const data = await ctx.client.request(`/tools/v1/${encodeURIComponent(toolName)}`, {
    method: 'POST',
    token: ctx.token,
    body,
  });
  return asRecord(data);
};
