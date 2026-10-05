import { applyTool } from '../actions.js';
import type { CredentialStore } from '../credentials.js';
import { randomUUID } from 'node:crypto';

import { uploadLocalFile } from '../upload.js';
import { writeLine, writeNextHint, writePageFooter, writeTable, type CliIO } from '../io.js';
import { asRecord, asText, callTool, errorMessage, resolveToolContext } from '../toolSurface.js';

export interface TestCommonOptions {
  io: CliIO;
  apiUrl?: string | undefined;
  json?: boolean | undefined;
  credentialStore?: CredentialStore | undefined;
}

export interface TestReadOptions extends TestCommonOptions {
  name: string;
  runId?: string | undefined;
}

export interface TestActionOptions extends TestCommonOptions {
  name: string;
  runId?: string | undefined;
  yes?: boolean | undefined;
  confirm?: ((question: string) => Promise<boolean>) | undefined;
}

const text = (value: unknown, fallback = '-'): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
};

const assessmentLabel = (assessment: unknown): string => {
  const record = asRecord(assessment);
  const state = asText(record.state, 'unknown');
  if (state !== 'ready') return state;
  return `${text(record.level, '-')} (${state})`;
};

export const testListCommand = async ({
  io,
  apiUrl,
  json = false,
  credentialStore,
  search,
  status,
  page,
  limit,
}: TestCommonOptions & {
  search?: string | undefined;
  status?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = {};
  if (search) input.search = search;
  if (status)
    input.latestRunStatus = status
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  if (page) input.page = page;
  if (limit) input.limit = limit;

  const envelope = await callTool(ctx, 'list_tests', input);
  if (envelope.status !== 'ok') throw new Error(errorMessage(envelope, 'Could not list tests.'));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }

  const data = asRecord(envelope.data);
  const tests = Array.isArray(data.tests) ? data.tests : [];
  writeLine(
    io.stdout,
    `${io.theme.bold('Tests')} ${io.theme.dim(`(${text(data.total, String(tests.length))})`)}`,
  );
  if (tests.length === 0) {
    writeLine(io.stdout, 'No tests found.');
    return;
  }
  writeTable(
    io,
    ['CODE', 'NAME', 'APPLICABILITY', 'LATEST RUN'],
    tests.map((test) => {
      const record = asRecord(test);
      return [
        text(record.code, '-'),
        text(record.name),
        text(record.applicability),
        text(record.latestRunStatus),
      ];
    }),
  );
  writePageFooter(io, {
    shown: tests.length,
    total: typeof data.total === 'number' ? data.total : tests.length,
    page: typeof data.page === 'number' ? data.page : 1,
    limit: typeof data.limit === 'number' ? data.limit : 25,
    hasMore: data.hasMore === true,
  });
  const next = asText(asRecord(tests[0]).code);
  if (next) writeNextHint(io, `ciphrix test get ${next}`);
};

export const testGetCommand = async ({
  io,
  name,
  apiUrl,
  json = false,
  credentialStore,
}: TestReadOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'get_test', { name });
  if (envelope.status !== 'ok') throw new Error(errorMessage(envelope, 'Test not found.'));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }

  const test = asRecord(asRecord(envelope.data).test);
  const runs = Array.isArray(test.runs) ? test.runs : [];
  const assurance = asRecord(asRecord(test.aiAssessments).runs);
  writeLine(
    io.stdout,
    `${io.theme.bold(text(test.testName, 'Test'))} ${io.theme.dim(
      `· ${text(test.applicability)} · ${runs.length} run(s)`,
    )}`,
  );
  writeLine(io.stdout);
  renderRuns(io, runs, assurance);
};

export const testRunsCommand = async ({
  io,
  name,
  apiUrl,
  json = false,
  credentialStore,
}: TestReadOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'list_test_runs', { name });
  if (envelope.status !== 'ok') throw new Error(errorMessage(envelope, 'Test not found.'));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }

  const data = asRecord(envelope.data);
  const runs = Array.isArray(data.runs) ? data.runs : [];
  writeLine(
    io.stdout,
    `${io.theme.bold(text(data.name, 'Test'))} ${io.theme.dim(`· ${runs.length} run(s)`)}`,
  );
  writeLine(io.stdout);
  renderRuns(io, runs, asRecord(data.assurance));
};

const renderRuns = (io: CliIO, runs: unknown[], assurance: Record<string, unknown>): void => {
  if (runs.length === 0) {
    writeLine(io.stdout, 'No runs yet.');
    return;
  }
  writeTable(
    io,
    ['RUN', 'STATUS', 'WHEN', 'ITEMS', 'ASSURANCE'],
    runs.map((run) => {
      const record = asRecord(run);
      const counts = asRecord(record.itemCounts);
      const items =
        Number(counts.upload ?? 0) + Number(counts.native_doc ?? 0) + Number(counts.check ?? 0);
      return [
        text(record.id),
        text(record.status),
        text(record.runAt).slice(0, 10),
        String(items),
        assuranceLabel(assurance[text(record.id)]),
      ];
    }),
  );
};

const assuranceLabel = (assessment: unknown): string => assessmentLabel(assessment);

export const testItemsCommand = async ({
  io,
  name,
  runId,
  apiUrl,
  json = false,
  credentialStore,
}: TestReadOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = { name };
  if (runId) input.runId = runId;
  const envelope = await callTool(ctx, 'list_run_items', input);
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not read run items.'));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }

  const data = asRecord(envelope.data);
  const items = Array.isArray(data.items) ? data.items : [];
  const relevance = asRecord(data.relevance);
  writeLine(
    io.stdout,
    `${io.theme.bold('Run items')} ${io.theme.dim(`· run ${text(data.runId)}`)}`,
  );
  if (items.length === 0) {
    writeLine(io.stdout, 'No evidence attached.');
    return;
  }
  writeTable(
    io,
    ['ITEM', 'TYPE', 'RELEVANCE'],
    items.map((item) => {
      const record = asRecord(item);
      return [
        text(record.name, text(record.id)),
        text(record.itemType ?? record.type),
        assessmentLabel(relevance[text(record.id)]),
      ];
    }),
  );
};

export const testRunCreateCommand = async ({
  io,
  name,
  apiUrl,
  json = false,
  credentialStore,
  runAt,
}: TestReadOptions & { runAt?: string | undefined }): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = { name };
  if (runAt) input.runAt = runAt;
  const result = await applyTool({
    ctx,
    io,
    toolName: 'create_test_run',
    input,
    fallback: 'Could not create a run.',
  });
  if (json && result) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else if (result)
    writeLine(
      io.stdout,
      `${io.theme.green('✓')} run created: ${text(asRecord(result.data).runId)}`,
    );
};

export const testRunResultCommand = async ({
  io,
  name,
  runId,
  apiUrl,
  json = false,
  credentialStore,
  status,
  note,
}: TestReadOptions & { status: string; note?: string | undefined }): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = { name, status };
  if (runId) input.runId = runId;
  if (note) input.note = note;
  const result = await applyTool({
    ctx,
    io,
    toolName: 'set_test_run_status',
    input,
    fallback: 'Could not record the result.',
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else writeLine(io.stdout, `${io.theme.green('✓')} run result: ${status}`);
};

export const testRunDeleteCommand = async ({
  io,
  name,
  runId,
  apiUrl,
  json = false,
  yes = false,
  confirm,
  credentialStore,
}: TestActionOptions): Promise<void> => {
  if (!runId) throw new Error('Provide --run <id> to delete a run.');
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'delete_test_run',
    input: { name, runId },
    fallback: 'Could not delete the run.',
    yes,
    confirm,
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else writeLine(io.stdout, `${io.theme.green('✓')} run ${runId} deleted`);
};

export interface TestAttachOptions extends TestReadOptions {
  itemType: string;
  itemId?: string | undefined;
  uploadIds?: string[] | undefined;
  file?: string | undefined;
  unlink?: boolean | undefined;
}

export const testAttachCommand = async ({
  io,
  name,
  runId,
  apiUrl,
  json = false,
  credentialStore,
  itemType,
  itemId,
  uploadIds,
  file,
  unlink = false,
}: TestAttachOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);

  let resolvedItemType = itemType;
  let resolvedItemId = itemId;
  let resolvedUploadIds = uploadIds;
  if (file) {
    const upload = await uploadLocalFile(ctx, file, 'test');
    resolvedItemType = 'upload';
    resolvedItemId = undefined;
    resolvedUploadIds = [upload.id];
  }

  const input: Record<string, unknown> = {
    name,
    action: unlink ? 'unlink' : 'link',
    itemType: resolvedItemType,
  };
  if (runId) input.runId = runId;
  if (resolvedItemId) input.itemId = resolvedItemId;
  if (resolvedUploadIds && resolvedUploadIds.length > 0) input.uploadIds = resolvedUploadIds;

  const envelope = await callTool(ctx, 'attach_run_item', input, { idempotencyKey: randomUUID() });
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not attach the item.'));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }
  const data = asRecord(envelope.data);
  const job = asText(data.aiTaskId);
  writeLine(
    io.stdout,
    `${io.theme.green('✓')} ${unlink ? 'unlinked' : 'linked'} ${resolvedItemType} on run ${text(data.runId)}${
      job ? io.theme.dim(` · job ${job}`) : ''
    }`,
  );
};

export const testAvailableItemsCommand = async ({
  io,
  name,
  runId,
  itemType,
  apiUrl,
  json = false,
  credentialStore,
  search,
  page,
  limit,
}: TestReadOptions & {
  itemType: string;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = { name, itemType };
  if (runId) input.runId = runId;
  if (search) input.search = search;
  if (page) input.page = page;
  if (limit) input.limit = limit;
  const envelope = await callTool(ctx, 'list_test_items_available', input);
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not read available items.'));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }
  const data = asRecord(envelope.data);
  const items = Array.isArray(data.items) ? data.items : [];
  writeLine(
    io.stdout,
    `${io.theme.bold(`Available ${itemType}s`)} ${io.theme.dim(`(${items.length})`)}`,
  );
  if (items.length === 0) {
    writeLine(io.stdout, 'Nothing available to attach.');
    return;
  }
  writeTable(
    io,
    ['ITEM', 'TYPE', 'STATUS'],
    items.map((item) => {
      const record = asRecord(item);
      return [
        text(record.name, text(record.id)),
        text(record.itemType ?? record.type),
        text(record.status),
      ];
    }),
  );
  const total = typeof data.total === 'number' ? data.total : items.length;
  const currentPage = typeof data.page === 'number' ? data.page : 1;
  const pageSize = typeof data.limit === 'number' ? data.limit : 25;
  writePageFooter(io, {
    shown: items.length,
    total,
    page: currentPage,
    limit: pageSize,
    hasMore: data.hasMore === true || currentPage * pageSize < total,
  });
};

export const testLinksCommand = async ({
  io,
  name,
  apiUrl,
  json = false,
  credentialStore,
}: TestReadOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'list_test_links', { name });
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not read the test links.'));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }
  const data = asRecord(envelope.data);
  const controls = Array.isArray(data.controls) ? data.controls : [];
  const clauses = Array.isArray(data.clauses) ? data.clauses : [];
  writeLine(io.stdout, `${io.theme.bold('Controls')} ${io.theme.dim(`(${controls.length})`)}`);
  for (const control of controls) {
    const record = asRecord(control);
    writeLine(
      io.stdout,
      `  ${text(record.controlCode ?? record.code)}  ${text(record.controlName ?? record.name, text(record.id))}`,
    );
  }
  writeLine(io.stdout, `${io.theme.bold('Clauses')} ${io.theme.dim(`(${clauses.length})`)}`);
  for (const clause of clauses) {
    const record = asRecord(clause);
    writeLine(
      io.stdout,
      `  ${text(record.clauseCode ?? record.code)}  ${text(record.clauseName ?? record.name, text(record.id))}`,
    );
  }
};

export const testUpdateCommand = async ({
  io,
  name,
  apiUrl,
  json = false,
  yes = false,
  confirm,
  credentialStore,
  changes,
}: TestReadOptions & {
  yes?: boolean | undefined;
  confirm?: ((question: string) => Promise<boolean>) | undefined;
  changes: Record<string, unknown>;
}): Promise<void> => {
  if (Object.keys(changes).length === 0) {
    throw new Error('Provide at least one field, for example --applicability in_scope');
  }
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'update_test',
    input: { name, changes },
    fallback: 'Could not update the test.',
    yes,
    confirm,
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else {
    const applied = asRecord(result.data).applied;
    writeLine(
      io.stdout,
      `${io.theme.green('✓')} updated ${name}: ${Array.isArray(applied) ? applied.join(', ') : ''}`,
    );
  }
};

export const testDeleteCommand = async ({
  io,
  name,
  apiUrl,
  json = false,
  yes = false,
  confirm,
  credentialStore,
}: TestActionOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'delete_test',
    input: { name },
    fallback: 'Could not delete the test.',
    yes,
    confirm,
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else writeLine(io.stdout, `${io.theme.green('✓')} test ${name} deleted`);
};
