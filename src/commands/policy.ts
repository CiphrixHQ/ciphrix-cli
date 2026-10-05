import type { CredentialStore } from '../credentials.js';
import { writeLine, writeNextHint, writePageFooter, writeTable, type CliIO } from '../io.js';
import { asRecord, asText, callTool, errorMessage, resolveToolContext } from '../toolSurface.js';

export interface PolicyListOptions {
  io: CliIO;
  apiUrl?: string | undefined;
  json?: boolean | undefined;
  name?: string | undefined;
  status?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  store?: CredentialStore | undefined;
}

export interface PolicyGetOptions {
  io: CliIO;
  apiUrl?: string | undefined;
  json?: boolean | undefined;
  policy: string;
  version?: number | undefined;
  minor?: number | undefined;
  store?: CredentialStore | undefined;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

const num = (value: unknown, fallback: string): string =>
  typeof value === 'number' ? String(value) : asText(value, fallback);

export const policyListCommand = async ({
  io,
  apiUrl,
  json = false,
  name,
  status,
  page,
  limit,
  store,
}: PolicyListOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, store);

  const input: Record<string, unknown> = {};
  if (name) input.name = name;
  if (status)
    input.status = status
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  if (page) input.page = page;
  if (limit) input.limit = limit;

  const envelope = await callTool(ctx, 'list_documents', input);
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not list documents.'));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }

  const data = asRecord(envelope.data);
  const policies = Array.isArray(data.policies) ? data.policies : [];
  const counts = asRecord(data.counts);
  const count = (value: unknown): string =>
    typeof value === 'number' ? String(value) : asText(value, '0');
  writeLine(
    io.stdout,
    `${io.theme.bold('Documents')} ${io.theme.dim(
      `(${count(data.total)} total · ${count(counts.draft)} draft · ${count(counts.pending)} pending · ${count(
        counts.published,
      )} published)`,
    )}`,
  );

  if (policies.length === 0) {
    writeLine(io.stdout, 'No documents found.');
    return;
  }

  const rows = policies.map((policy) => {
    const record = asRecord(policy);
    return [
      asText(record.code, '-'),
      asText(record.name),
      asText(record.status, '-'),
      record.isPublished === true ? 'published' : '-',
    ];
  });
  writeTable(io, ['CODE', 'NAME', 'STATUS', 'PUBLISHED'], rows);
  writePageFooter(io, {
    shown: policies.length,
    total: typeof data.total === 'number' ? data.total : policies.length,
    page: typeof data.page === 'number' ? data.page : 1,
    limit: typeof data.limit === 'number' ? data.limit : 25,
    hasMore: data.hasMore === true,
  });
  const next = asText(asRecord(policies[0]).code);
  if (next) writeNextHint(io, `ciphrix document get ${next}`);
};

export const policyGetCommand = async ({
  io,
  apiUrl,
  json = false,
  policy,
  version,
  minor,
  store,
}: PolicyGetOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, store);

  if (version) {
    const versionEnvelope = await callTool(ctx, 'get_document_version', {
      ...(UUID.test(policy) ? { policyId: policy } : { name: policy }),
      versionNumber: version,
      ...(minor !== undefined ? { minorVersionNumber: minor } : {}),
    });
    if (versionEnvelope.status !== 'ok')
      throw new Error(errorMessage(versionEnvelope, 'Document version not found.'));
    const recordV = asRecord(versionEnvelope.data);
    if (json) {
      writeLine(io.stdout, JSON.stringify(recordV, null, 2));
      return;
    }
    writeLine(
      io.stdout,
      `${io.theme.bold(policy)} ${io.theme.dim(
        `· version ${num(recordV.versionNumber, String(version))}.${num(recordV.minorVersionNumber, '0')} · ${asText(
          recordV.status,
          'unknown',
        )}`,
      )}`,
    );
    const versionMeta: [string, unknown][] = [
      ['Reviewer', recordV.reviewedBy],
      ['Approver', recordV.approvedBy],
      ['Approved', recordV.approvedAt],
    ];
    for (const [label, value] of versionMeta) {
      if (value === undefined || value === null || value === '') continue;
      writeLine(io.stdout, `  ${io.theme.dim(`${label}:`)} ${asText(value)}`);
    }
    writeLine(io.stdout);
    const body = asText(recordV.contentMarkdown);
    writeLine(io.stdout, body.trim() === '' ? io.theme.dim('(no content)') : body.trimEnd());
    return;
  }
  const envelope = await callTool(
    ctx,
    'get_document',
    UUID.test(policy) ? { policyId: policy } : { name: policy },
  );
  if (envelope.status !== 'ok') throw new Error(errorMessage(envelope, 'Document not found.'));

  const record = asRecord(asRecord(envelope.data).policy);

  if (json) {
    writeLine(io.stdout, JSON.stringify(record, null, 2));
    return;
  }

  const currentVersion = asRecord(record.currentVersion);
  const meta: [string, unknown][] = [
    ['Reviewer', currentVersion.reviewer ?? currentVersion.reviewedBy],
    ['Approver', currentVersion.approver ?? currentVersion.approvedBy],
    ['Approved', currentVersion.approvedAt],
  ];
  for (const [label, value] of meta) {
    if (value === undefined || value === null || value === '') continue;
    writeLine(io.stdout, `  ${io.theme.dim(`${label}:`)} ${asText(value)}`);
  }
  if (meta.some(([, value]) => value !== undefined && value !== null && value !== ''))
    writeLine(io.stdout);
  const markdown = asText(currentVersion.contentMarkdown);
  writeLine(
    io.stdout,
    `${io.theme.bold(asText(record.name, 'Document'))} ${io.theme.dim(
      `· ${asText(record.status, 'unknown')}${record.isPublished === true ? ' · published' : ''}`,
    )}`,
  );
  writeLine(io.stdout);
  writeLine(io.stdout, markdown.trim() === '' ? io.theme.dim('(no content)') : markdown.trimEnd());
};
