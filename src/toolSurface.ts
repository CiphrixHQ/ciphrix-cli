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

/**
 * The tool surface requires an idempotency key on every write and rejects a write without one. Writes
 * must go through `applyTool`, which supplies the key and handles the preflight/confirmation contract.
 * This set is the CLI-side mirror of the tool surface's write effects, so a write cannot be issued as a
 * bare read-style call again. Keep it in step with the write tools the CLI exposes (ideally derived from
 * the manifest once the CLI consumes it).
 */
export const WRITE_TOOL_NAMES: ReadonlySet<string> = new Set([
  'set_context_answer',
  'reset_context',
  'create_document',
  'edit_document_content',
  'create_document_version',
  'update_document',
  'submit_document',
  'approve_document',
  'delete_document',
  'create_test_run',
  'set_test_run_status',
  'delete_test_run',
  'attach_run_item',
  'update_test',
  'delete_test',
  'update_clause',
  'link_clause_item',
  'update_control',
  'link_control_item',
  'create_vendor',
  'update_vendor',
  'delete_vendor',
  'link_vendor_file',
  'create_risk',
  'update_risk',
  'delete_risk',
  'link_risk_control',
  'link_risk_file',
  'set_check_enabled',
  'create_asset',
  'update_asset',
  'delete_asset',
  'set_asset_tag',
]);

export const callTool = async (
  ctx: ToolContext,
  toolName: string,
  input: unknown,
  options: CallToolOptions = {},
): Promise<Record<string, unknown>> => {
  if (WRITE_TOOL_NAMES.has(toolName) && !options.idempotencyKey) {
    throw new Error(
      `Refusing to call the write tool '${toolName}' without an idempotency key. Use applyTool.`,
    );
  }

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
