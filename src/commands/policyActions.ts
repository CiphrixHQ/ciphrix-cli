import { readFile } from 'node:fs/promises';

import { applyTool } from '../actions.js';
import type { CredentialStore } from '../credentials.js';
import { writeLine, writeTable, type CliIO } from '../io.js';
import { asRecord, asText, callTool, errorMessage, resolveToolContext } from '../toolSurface.js';

export interface PolicyActionOptions {
  io: CliIO;
  apiUrl?: string | undefined;
  json?: boolean | undefined;
  yes?: boolean | undefined;
  store?: CredentialStore | undefined;
  confirm?: ((question: string) => Promise<boolean>) | undefined;
}

export interface PolicyTargetOptions extends PolicyActionOptions {
  policy: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

const num = (value: unknown, fallback: string): string =>
  typeof value === 'number' ? String(value) : asText(value, fallback);

const target = (policy: string): Record<string, unknown> =>
  UUID.test(policy) ? { policyId: policy } : { name: policy };

const renderResult = (io: CliIO, json: boolean, result: Record<string, unknown>): void => {
  if (json) {
    writeLine(io.stdout, JSON.stringify(result, null, 2));
    return;
  }
  const data = asRecord(result.data);
  const name = asText(data.name, asText(data.policyId, 'document'));
  const status = asText(data.status, 'done');
  writeLine(io.stdout, `${io.theme.green('✓')} ${name}: ${status}`);
};

export interface PolicyCreateOptions extends PolicyActionOptions {
  name: string;
  type?: string | undefined;
  description?: string | undefined;
}

export const policyCreateCommand = async ({
  io,
  apiUrl,
  json = false,
  yes = false,
  store,
  confirm,
  name,
  type,
  description,
}: PolicyCreateOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, store);
  const input: Record<string, unknown> = { name };
  if (type) input.type = type;
  if (description) input.description = description;

  const result = await applyTool({
    ctx,
    io,
    toolName: 'create_document',
    input,
    fallback: 'Could not create the document.',
    yes,
    confirm,
  });
  if (result) renderResult(io, json, result);
};

export interface PolicyEditOptions extends PolicyTargetOptions {
  content?: string | undefined;
  file?: string | undefined;
}

export const policyEditCommand = async ({
  io,
  apiUrl,
  json = false,
  yes = false,
  store,
  confirm,
  policy,
  content,
  file,
}: PolicyEditOptions): Promise<void> => {
  const markdown = file ? await readFile(file, 'utf8') : content;
  if (!markdown) {
    throw new Error('Provide the new content with --file <path> or --content <markdown>.');
  }

  const ctx = await resolveToolContext(apiUrl, store);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'edit_document_content',
    input: { ...target(policy), contentMarkdown: markdown },
    fallback: 'Could not edit the document.',
    yes,
    confirm,
  });
  if (result) renderResult(io, json, result);
};

export interface PolicyVersionOptions extends PolicyTargetOptions {
  changeType?: string | undefined;
  summary?: string | undefined;
}

export const policyVersionCommand = async ({
  io,
  apiUrl,
  json = false,
  yes = false,
  store,
  confirm,
  policy,
  changeType,
  summary,
}: PolicyVersionOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, store);
  const input: Record<string, unknown> = { ...target(policy) };
  if (changeType) input.changeType = changeType;
  if (summary) input.changeSummary = summary;

  const result = await applyTool({
    ctx,
    io,
    toolName: 'create_document_version',
    input,
    fallback: 'Could not create a new version.',
    yes,
    confirm,
  });
  if (result) renderResult(io, json, result);
};

export const policySubmitCommand = async (options: PolicyTargetOptions): Promise<void> => {
  const { io, apiUrl, json = false, yes = false, store, confirm, policy } = options;
  const ctx = await resolveToolContext(apiUrl, store);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'submit_document',
    input: target(policy),
    fallback: 'Could not submit the document for review.',
    yes,
    confirm,
  });
  if (result) renderResult(io, json, result);
};

export const policyApproveCommand = async (options: PolicyTargetOptions): Promise<void> => {
  const { io, apiUrl, json = false, yes = false, store, confirm, policy } = options;
  const ctx = await resolveToolContext(apiUrl, store);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'approve_document',
    input: target(policy),
    fallback: 'Could not approve the document.',
    yes,
    confirm,
  });
  if (result) renderResult(io, json, result);
};

export const policyDeleteCommand = async ({
  io,
  apiUrl,
  json = false,
  yes = false,
  store,
  confirm,
  policy,
}: PolicyTargetOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, store);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'delete_document',
    input: target(policy),
    fallback: 'Could not delete the document.',
    yes,
    confirm,
  });
  if (result) renderResult(io, json, result);
};

export interface PolicyMetadataUpdateOptions extends PolicyTargetOptions {
  changes: Record<string, unknown>;
}

export const policyUpdateMetaCommand = async ({
  io,
  apiUrl,
  json = false,
  store,
  policy,
  changes,
}: PolicyMetadataUpdateOptions): Promise<void> => {
  if (Object.keys(changes).length === 0) {
    throw new Error('Provide at least one field, for example --type manual or --publish on');
  }
  const ctx = await resolveToolContext(apiUrl, store);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'update_document',
    input: { ...target(policy), changes },
    fallback: 'Could not update the document.',
  });
  if (!result) return;
  if (json) {
    writeLine(io.stdout, JSON.stringify(result.data, null, 2));
    return;
  }
  const applied = asRecord(result.data).applied;
  const failed = asRecord(result.data).failed;
  const appliedList = Array.isArray(applied)
    ? applied.map((value) => asText(value)).join(', ')
    : '';
  writeLine(io.stdout, `${io.theme.green('✓')} updated ${policy}: ${appliedList}`);
  if (Array.isArray(failed) && failed.length > 0) {
    for (const item of failed) {
      const record = asRecord(item);
      writeLine(
        io.stdout,
        `${io.theme.yellow('!')} ${asText(record.field)}: ${asText(record.error)}`,
      );
    }
  }
};

export const policyVersionsCommand = async ({
  io,
  apiUrl,
  json = false,
  store,
  policy,
}: PolicyTargetOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, store);
  const envelope = await callTool(ctx, 'list_document_versions', target(policy));
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not list document versions.'));

  const data = asRecord(envelope.data);
  const versions = Array.isArray(data.versions) ? data.versions : [];
  if (json) {
    writeLine(io.stdout, JSON.stringify(data, null, 2));
    return;
  }
  writeLine(
    io.stdout,
    `${io.theme.bold(policy)} ${io.theme.dim(`· ${versions.length} version(s)`)}`,
  );
  if (versions.length === 0) {
    writeLine(io.stdout, 'No versions found.');
    return;
  }
  writeTable(
    io,
    ['VERSION', 'STATUS', 'REVIEWED BY', 'APPROVED BY', 'APPROVED'],
    versions.map((version) => {
      const record = asRecord(version);
      const major = num(record.versionNumber, '?');
      const minor = num(record.minorVersionNumber, '0');
      return [
        `${major}.${minor}`,
        asText(record.status, '-'),
        asText(record.reviewedBy, '-'),
        asText(record.approvedBy, '-'),
        asText(record.approvedAt, '-').slice(0, 10),
      ];
    }),
  );
};
