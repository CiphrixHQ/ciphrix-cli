import { applyTool } from '../actions.js';
import type { CredentialStore } from '../credentials.js';
import { writeLine, type CliIO } from '../io.js';
import { asRecord, asText, callTool, errorMessage, resolveToolContext } from '../toolSurface.js';

export interface ContextCommonOptions {
  io: CliIO;
  apiUrl?: string | undefined;
  json?: boolean | undefined;
  credentialStore?: CredentialStore | undefined;
}

export interface ContextReadOptions extends ContextCommonOptions {
  store: string;
}

export interface ContextActionOptions extends ContextCommonOptions {
  yes?: boolean | undefined;
  confirm?: ((question: string) => Promise<boolean>) | undefined;
}

const assertStore = (store: string): void => {
  if (store !== 'business' && store !== 'operating') {
    throw new Error(`Unknown context store "${store}". Use "business" or "operating".`);
  }
};

const count = (value: unknown): string =>
  typeof value === 'number' ? String(value) : asText(value, '0');

export const contextGetCommand = async ({
  io,
  store,
  apiUrl,
  json = false,
  credentialStore,
}: ContextReadOptions): Promise<void> => {
  assertStore(store);
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'get_context', { store });
  if (envelope.status !== 'ok') throw new Error(errorMessage(envelope, 'Could not read context.'));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }

  const data = asRecord(envelope.data);
  writeLine(
    io.stdout,
    `${io.theme.bold('Context')} ${io.theme.dim(
      `· ${store} · ${count(data.answeredCount)}/${count(data.questionCount)} answered`,
    )}`,
  );
  writeLine(io.stdout);

  const digest = asText(data.digestMarkdown);
  if (digest.trim() === '') {
    writeLine(io.stdout, io.theme.dim('(no digest yet — answer some questions)'));
    return;
  }
  writeLine(io.stdout, digest.trimEnd());
};

export const contextStatusCommand = async ({
  io,
  store,
  apiUrl,
  json = false,
  credentialStore,
}: ContextReadOptions): Promise<void> => {
  assertStore(store);
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'get_context_status', { store });
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not read context status.'));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }

  const data = asRecord(envelope.data);
  writeLine(
    io.stdout,
    `${io.theme.bold('Context status')} ${io.theme.dim(
      `· ${store} · ${count(data.answeredCount)}/${count(data.questionCount)} answered · ${count(
        data.unansweredCount,
      )} open`,
    )}`,
  );

  const unanswered = Array.isArray(data.unanswered) ? data.unanswered : [];
  if (unanswered.length === 0) {
    writeLine(io.stdout, `${io.theme.green('✓')} Nothing outstanding.`);
    return;
  }
  for (const item of unanswered) {
    const record = asRecord(item);
    writeLine(io.stdout, `  ${io.theme.cyan(asText(record.id))} — ${asText(record.label)}`);
  }
};

export interface ContextSetOptions extends ContextCommonOptions {
  target: string;
  value: string;
}

const parseValue = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

export const contextSetCommand = async ({
  io,
  apiUrl,
  json = false,
  target,
  value,
  credentialStore,
}: ContextSetOptions): Promise<void> => {
  const separator = target.indexOf('.');
  if (separator === -1) {
    throw new Error('Use <store>.<questionId>, for example business.company_size');
  }
  const store = target.slice(0, separator);
  const questionId = target.slice(separator + 1);
  assertStore(store);
  if (!questionId) throw new Error('A question id is required, for example business.company_size');

  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'set_context_answer',
    input: { store, questionId, value: parseValue(value) },
    fallback: 'Could not save the answer.',
  });
  if (!result) return;

  if (json) {
    writeLine(io.stdout, JSON.stringify(result.data, null, 2));
    return;
  }
  writeLine(io.stdout, `${io.theme.green('✓')} ${store}.${questionId} saved`);
};

export const contextResetCommand = async ({
  io,
  apiUrl,
  json = false,
  yes = false,
  confirm,
  credentialStore,
}: ContextActionOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'reset_context',
    input: { store: 'business' },
    fallback: 'Could not reset the context.',
    yes,
    confirm,
  });
  if (!result) return;
  if (json) {
    writeLine(io.stdout, JSON.stringify(result, null, 2));
    return;
  }
  writeLine(io.stdout, `${io.theme.green('✓')} Business Context reset`);
};
