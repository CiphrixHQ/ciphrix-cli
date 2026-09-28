import { writeLine, writeNextHint, writeTable, type CliIO } from '../io.js';
import { asRecord, callTool, errorMessage, resolveToolContext, asText } from '../toolSurface.js';
import type { CredentialStore } from '../credentials.js';

export interface FrameworkListOptions {
  io: CliIO;
  apiUrl?: string | undefined;
  json?: boolean | undefined;
  credentialStore?: CredentialStore | undefined;
}

const text = (value: unknown, fallback = '-'): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;

export const frameworkListCommand = async ({
  io,
  apiUrl,
  json = false,
  credentialStore,
}: FrameworkListOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'list_frameworks', {});
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not list frameworks.'));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }

  const data = asRecord(envelope.data);
  const active = Array.isArray(data.active) ? data.active : [];
  const available = Array.isArray(data.available) ? data.available : [];

  writeLine(
    io.stdout,
    `${io.theme.bold('Frameworks')} ${io.theme.dim(`(${active.length} applied)`)}`,
  );
  if (active.length > 0) {
    writeTable(
      io,
      ['CODE', 'NAME', 'STATUS', 'READINESS'],
      active.map((framework) => {
        const record = asRecord(framework);
        const readiness = record.readinessScore ?? record.complianceScore;
        return [
          text(record.frameworkCode, '-'),
          text(record.frameworkName ?? record.name),
          text(record.status),
          readiness === undefined || readiness === null ? '-' : `${text(readiness)}%`,
        ];
      }),
    );
  }

  const firstFramework = asText(asRecord(active[0]).frameworkCode);
  if (firstFramework) writeNextHint(io, `ciphrix framework clauses ${firstFramework}`);

  if (available.length > 0) {
    writeLine(io.stdout);
    writeLine(io.stdout, `${io.theme.dim(`Available to add (${available.length}):`)}`);
    for (const framework of available) {
      const record = asRecord(framework);
      writeLine(io.stdout, `  ${text(record.frameworkName ?? record.name)}`);
    }
  }
};

export interface ClauseTargetOptions {
  io: CliIO;
  framework: string;
  clause: string;
  apiUrl?: string | undefined;
  json?: boolean | undefined;
  credentialStore?: CredentialStore | undefined;
}

export const frameworkClausesCommand = async ({
  io,
  framework,
  apiUrl,
  json = false,
  credentialStore,
  search,
  applicability,
  page,
  limit,
}: FrameworkListOptions & {
  framework: string;
  search?: string | undefined;
  applicability?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = { framework };
  if (search) input.search = search;
  if (applicability) input.applicability = [applicability];
  if (page) input.page = page;
  if (limit) input.limit = limit;
  const envelope = await callTool(ctx, 'list_framework_clauses', input);
  if (envelope.status !== 'ok') throw new Error(errorMessage(envelope, 'Could not list clauses.'));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }
  const data = asRecord(envelope.data);
  const clauses = Array.isArray(data.clauses) ? data.clauses : [];
  writeLine(
    io.stdout,
    `${io.theme.bold('Clauses')} ${io.theme.dim(`(${text(data.total, String(clauses.length))})`)}`,
  );
  if (clauses.length === 0) {
    writeLine(io.stdout, 'No clauses found.');
    return;
  }
  const firstClause = asText(asRecord(clauses[0]).code);
  if (firstClause) writeNextHint(io, `ciphrix framework clause ${framework} ${firstClause}`);

  writeTable(
    io,
    ['CODE', 'NAME', 'APPLICABILITY', 'DESIGN REQ'],
    clauses.map((clause) => {
      const record = asRecord(clause);
      return [
        text(record.code),
        text(record.name),
        text(record.applicability),
        text(record.designRequirements),
      ];
    }),
  );
};

export const clauseGetCommand = async ({
  io,
  framework,
  clause,
  apiUrl,
  json = false,
  credentialStore,
}: ClauseTargetOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'get_clause', { framework, clause });
  if (envelope.status !== 'ok') throw new Error(errorMessage(envelope, 'Clause not found.'));

  const record = asRecord(asRecord(envelope.data).clause);
  if (json) {
    writeLine(io.stdout, JSON.stringify(record, null, 2));
    return;
  }
  writeLine(
    io.stdout,
    `${io.theme.bold(text(record.name, 'Clause'))} ${io.theme.dim(`· ${text(record.code)}`)}`,
  );
  const fields: [string, unknown][] = [
    ['Applicability', record.applicability],
    ['Design requirements', record.designRequirements],
  ];
  for (const [label, value] of fields) {
    if (value === undefined || value === null || value === '') continue;
    writeLine(io.stdout, `  ${io.theme.dim(`${label}:`)} ${text(value)}`);
  }
};

export const clauseItemsCommand = async ({
  io,
  framework,
  clause,
  apiUrl,
  json = false,
  credentialStore,
}: ClauseTargetOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'list_clause_items', { framework, clause });
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not read clause items.'));
  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }
  const items = asRecord(envelope.data).items;
  const list = Array.isArray(items) ? items : [];
  writeLine(io.stdout, `${io.theme.bold('Clause items')} ${io.theme.dim(`(${list.length})`)}`);
  if (list.length === 0) {
    writeLine(io.stdout, 'No items mapped.');
    return;
  }
  writeTable(
    io,
    ['ITEM', 'TYPE'],
    list.map((item) => {
      const record = asRecord(item);
      return [text(record.name, text(record.id)), text(record.itemType ?? record.type)];
    }),
  );
};

export const clauseAvailableItemsCommand = async ({
  io,
  framework,
  clause,
  itemType,
  apiUrl,
  json = false,
  credentialStore,
  search,
}: ClauseTargetOptions & { itemType: string; search?: string | undefined }): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = { framework, clause, itemType };
  if (search) input.search = search;
  const envelope = await callTool(ctx, 'list_clause_items_available', input);
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not read available items.'));
  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }
  const items = asRecord(envelope.data).items;
  const list = Array.isArray(items) ? items : [];
  writeLine(
    io.stdout,
    `${io.theme.bold(`Available ${itemType}s`)} ${io.theme.dim(`(${list.length})`)}`,
  );
  for (const item of list) {
    const record = asRecord(item);
    writeLine(io.stdout, `  ${text(record.name, text(record.id))}`);
  }
};

export const clauseUpdateCommand = async ({
  io,
  framework,
  clause,
  changes,
  apiUrl,
  json = false,
  yes = false,
  credentialStore,
}: ClauseTargetOptions & {
  changes: Record<string, unknown>;
  yes?: boolean | undefined;
}): Promise<void> => {
  const { applyTool } = await import('../actions.js');
  if (Object.keys(changes).length === 0) {
    throw new Error('Provide at least one field, for example --applicability out_of_scope');
  }
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'update_clause',
    input: { framework, clause, changes },
    fallback: 'Could not update the clause.',
    yes,
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else {
    const applied = asRecord(result.data).applied;
    writeLine(
      io.stdout,
      `${io.theme.green('✓')} updated ${clause}: ${Array.isArray(applied) ? applied.join(', ') : ''}`,
    );
  }
};

export const clauseLinkCommand = async ({
  io,
  framework,
  clause,
  action,
  itemType,
  itemId,
  apiUrl,
  json = false,
  yes = false,
  credentialStore,
}: ClauseTargetOptions & {
  action: string;
  itemType: string;
  itemId: string;
  yes?: boolean | undefined;
}): Promise<void> => {
  const { applyTool } = await import('../actions.js');
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'link_clause_item',
    input: { framework, clause, action, itemType, itemId },
    fallback: 'Could not change the clause item.',
    yes,
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else
    writeLine(
      io.stdout,
      `${io.theme.green('✓')} ${action === 'unlink' ? 'unlinked' : 'linked'} ${itemType} on ${clause}`,
    );
};
