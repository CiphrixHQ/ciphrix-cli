import { applyTool } from '../actions.js';
import type { CredentialStore } from '../credentials.js';
import { writeLine, writeNextHint, writePageFooter, writeTable, type CliIO } from '../io.js';
import { asRecord, asText, callTool, errorMessage, resolveToolContext } from '../toolSurface.js';

export interface CheckCommonOptions {
  io: CliIO;
  apiUrl?: string | undefined;
  json?: boolean | undefined;
  credentialStore?: CredentialStore | undefined;
}

export interface CheckTargetOptions extends CheckCommonOptions {
  check: string;
}

const text = (value: unknown, fallback = '-'): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;

export const checkListCommand = async ({
  io,
  apiUrl,
  json = false,
  credentialStore,
  integrationType,
  status,
  page,
  limit,
}: CheckCommonOptions & {
  integrationType?: string | undefined;
  status?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = {};
  if (integrationType)
    input.integrationType = integrationType
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  if (status)
    input.status = status
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  if (page) input.page = page;
  if (limit) input.limit = limit;

  const envelope = await callTool(ctx, 'list_checks', input);
  if (envelope.status !== 'ok') throw new Error(errorMessage(envelope, 'Could not list checks.'));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }

  const data = asRecord(envelope.data);
  const checks = Array.isArray(data.checks) ? data.checks : [];
  writeLine(
    io.stdout,
    `${io.theme.bold('Checks')} ${io.theme.dim(`(${text(data.total, String(checks.length))} total)`)}`,
  );
  if (checks.length === 0) {
    writeLine(io.stdout, 'No checks found.');
    return;
  }
  writeTable(
    io,
    ['CODE', 'NAME', 'INTEGRATION', 'SEVERITY', 'STATUS', 'COMPLIANCE'],
    checks.map((check) => {
      const record = asRecord(check);
      return [
        text(record.code, '-'),
        text(record.name),
        text(record.integration),
        text(record.severity),
        text(record.status),
        record.complianceRate === null || record.complianceRate === undefined
          ? '-'
          : `${text(record.complianceRate)}%`,
      ];
    }),
  );
  writePageFooter(io, {
    shown: checks.length,
    total: typeof data.total === 'number' ? data.total : checks.length,
    page: typeof data.page === 'number' ? data.page : 1,
    limit: typeof data.limit === 'number' ? data.limit : 25,
    hasMore: data.hasMore === true,
  });
  const next = asText(asRecord(checks[0]).code);
  if (next) writeNextHint(io, `ciphrix check resources ${next}`);
};

export const checkResourcesCommand = async ({
  io,
  check,
  apiUrl,
  json = false,
  credentialStore,
}: CheckTargetOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'list_check_resources', { name: check });
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not list check resources.'));

  const data = asRecord(envelope.data);
  const resources = Array.isArray(data.resources) ? data.resources : [];
  if (json) {
    writeLine(io.stdout, JSON.stringify(data, null, 2));
    return;
  }

  writeLine(
    io.stdout,
    `${io.theme.bold(check)} ${io.theme.dim(`· ${resources.length} resource(s)`)}`,
  );
  for (const resource of resources) {
    const record = asRecord(resource);
    writeLine(
      io.stdout,
      `  ${text(record.resource_name ?? record.name ?? record.resource_id ?? record.id)}`,
    );
  }
};

export const checkRunCommand = async ({
  io,
  check,
  apiUrl,
  json = false,
  credentialStore,
}: CheckTargetOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'get_check_run', { name: check });
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not read the check run.'));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }
  const run = asRecord(asRecord(envelope.data).run);
  writeLine(io.stdout, `${io.theme.bold(check)} ${io.theme.dim('· latest run')}`);
  for (const [key, value] of Object.entries(run)) {
    if (value === undefined || value === null || typeof value === 'object') continue;
    writeLine(io.stdout, `  ${io.theme.dim(`${key}:`)} ${text(value)}`);
  }
};

export const checkIntegrationsCommand = async ({
  io,
  apiUrl,
  json = false,
  credentialStore,
}: CheckCommonOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'list_integrations', {});
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not list integrations.'));

  const integrations = Array.isArray(asRecord(envelope.data).integrations)
    ? (asRecord(envelope.data).integrations as unknown[])
    : [];
  if (json) {
    writeLine(io.stdout, JSON.stringify(integrations, null, 2));
    return;
  }
  writeLine(
    io.stdout,
    `${io.theme.bold('Integrations')} ${io.theme.dim(`(${integrations.length})`)}`,
  );
  for (const integration of integrations) {
    writeLine(io.stdout, `  ${asText(integration, text(integration))}`);
  }
};

export const checkRunsCommand = async ({
  io,
  check,
  apiUrl,
  json = false,
  credentialStore,
  page,
  limit,
}: CheckTargetOptions & {
  page?: number | undefined;
  limit?: number | undefined;
}): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = { name: check };
  if (page) input.page = page;
  if (limit) input.limit = limit;
  const envelope = await callTool(ctx, 'list_check_runs', input);
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not read the run history.'));

  const data = asRecord(envelope.data);
  const runs = Array.isArray(data.runs) ? data.runs : [];
  if (json) {
    writeLine(io.stdout, JSON.stringify(data, null, 2));
    return;
  }
  writeLine(io.stdout, `${io.theme.bold('Check runs')} ${io.theme.dim(`(${runs.length})`)}`);
  if (runs.length === 0) {
    writeLine(io.stdout, 'No runs recorded.');
    return;
  }
  writeTable(
    io,
    ['WHEN', 'STATUS', 'COMPLIANCE'],
    runs.map((run) => {
      const record = asRecord(run);
      const rate = record.complianceRate;
      return [
        asText(record.runDate).slice(0, 10) || '-',
        asText(record.status, '-'),
        typeof rate === 'number' ? `${rate}%` : '-',
      ];
    }),
  );
};

export const checkFindingsCommand = async ({
  io,
  check,
  apiUrl,
  json = false,
  credentialStore,
}: CheckTargetOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'list_check_findings', { name: check });
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not read the findings.'));

  const data = asRecord(envelope.data);
  const findings = Array.isArray(data.findings) ? data.findings : [];
  if (json) {
    writeLine(io.stdout, JSON.stringify(data, null, 2));
    return;
  }
  writeLine(io.stdout, `${io.theme.bold('Findings')} ${io.theme.dim(`(${findings.length})`)}`);
  if (findings.length === 0) {
    writeLine(io.stdout, 'No findings raised from this check.');
    return;
  }
  writeTable(
    io,
    ['FINDING', 'STATUS'],
    findings.map((finding) => {
      const record = asRecord(finding);
      return [asText(record.title ?? record.name, asText(record.id)), asText(record.status, '-')];
    }),
  );
};

export const checkSetEnabledCommand = async ({
  io,
  check,
  enabled,
  notes,
  apiUrl,
  json = false,
  yes = false,
  credentialStore,
}: CheckTargetOptions & {
  enabled: boolean;
  notes?: string | undefined;
  yes?: boolean | undefined;
}): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = { name: check, enabled };
  if (notes) input.notes = notes;
  const result = await applyTool({
    ctx,
    io,
    toolName: 'set_check_enabled',
    input,
    fallback: 'Could not change the check.',
    yes,
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else
    writeLine(
      io.stdout,
      `${io.theme.green('\u2713')} ${enabled ? 'enabled' : 'disabled'} ${check}`,
    );
};
