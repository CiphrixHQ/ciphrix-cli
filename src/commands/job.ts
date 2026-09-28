import type { CredentialStore } from '../credentials.js';
import { writeLine, type CliIO } from '../io.js';
import { asRecord, asText, callTool, errorMessage, resolveToolContext } from '../toolSurface.js';

export interface JobStatusOptions {
  io: CliIO;
  jobId: string;
  apiUrl?: string | undefined;
  json?: boolean | undefined;
  credentialStore?: CredentialStore | undefined;
}

/**
 * Check a background job started by another command (an evidence attachment, a generation job).
 *
 * Deliberately named "job": the product's "tasks" are user work items, and the interface never uses that
 * word for background machinery.
 */
export const jobStatusCommand = async ({
  io,
  jobId,
  apiUrl,
  json = false,
  credentialStore,
}: JobStatusOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'get_job_status', { jobId });
  if (envelope.status !== 'ok') throw new Error(errorMessage(envelope, 'Job not found.'));

  const data = asRecord(envelope.data);
  if (json) {
    writeLine(io.stdout, JSON.stringify(data, null, 2));
    return;
  }

  const status = asText(data.status, 'unknown');
  const marker =
    status === 'completed'
      ? io.theme.green('✓')
      : status === 'failed'
        ? io.theme.red('✗')
        : io.theme.dim('…');
  writeLine(io.stdout, `${marker} ${asText(data.type, 'job')} · ${status}`);

  const result = data.result;
  if (result !== null && result !== undefined) {
    writeLine(io.stdout, JSON.stringify(result, null, 2));
  }
};
