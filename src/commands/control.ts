import { applyTool } from '../actions.js';
import type { CredentialStore } from '../credentials.js';
import { writeLine, writeNextHint, writePageFooter, writeTable, type CliIO } from '../io.js';
import { asRecord, asText, callTool, errorMessage, resolveToolContext } from '../toolSurface.js';

export interface ControlCommonOptions {
  io: CliIO;
  apiUrl?: string | undefined;
  json?: boolean | undefined;
  credentialStore?: CredentialStore | undefined;
}

export interface ControlReadOptions extends ControlCommonOptions {
  name: string;
}

const text = (value: unknown, fallback = '-'): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;

export const controlListCommand = async ({
  io,
  apiUrl,
  json = false,
  credentialStore,
  search,
  domain,
  status,
  applicability,
  page,
  limit,
}: ControlCommonOptions & {
  search?: string | undefined;
  domain?: string | undefined;
  status?: string | undefined;
  applicability?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = {};
  if (search) input.search = search;
  if (domain) input.domain = [domain];
  if (status)
    input.status = status
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  if (applicability) input.applicability = [applicability];
  if (page) input.page = page;
  if (limit) input.limit = limit;

  const envelope = await callTool(ctx, 'list_controls', input);
  if (envelope.status !== 'ok') throw new Error(errorMessage(envelope, 'Could not list controls.'));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }

  const data = asRecord(envelope.data);
  const controls = Array.isArray(data.controls) ? data.controls : [];
  writeLine(
    io.stdout,
    `${io.theme.bold('Controls')} ${io.theme.dim(`(${text(data.total, String(controls.length))} total)`)}`,
  );
  if (controls.length === 0) {
    writeLine(io.stdout, 'No controls found.');
    return;
  }
  writeTable(
    io,
    ['CODE', 'NAME', 'DOMAIN', 'STATUS', 'APPLICABILITY', 'OWNER'],
    controls.map((control) => {
      const record = asRecord(control);
      const owner = asRecord(record.owner);
      return [
        text(record.code, '-'),
        text(record.name),
        text(record.domain),
        text(record.status),
        text(record.applicability),
        text(owner.email ?? record.owner, '-'),
      ];
    }),
  );
  writePageFooter(io, {
    shown: controls.length,
    total: typeof data.total === 'number' ? data.total : controls.length,
    page: typeof data.page === 'number' ? data.page : 1,
    limit: typeof data.limit === 'number' ? data.limit : 25,
    hasMore: data.hasMore === true,
  });
  const next = asText(asRecord(controls[0]).code);
  if (next) writeNextHint(io, `ciphrix control get ${next}`);
};

export const controlGetCommand = async ({
  io,
  name,
  apiUrl,
  json = false,
  credentialStore,
}: ControlReadOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'get_control', { name });
  if (envelope.status !== 'ok') throw new Error(errorMessage(envelope, 'Control not found.'));

  const control = asRecord(asRecord(envelope.data).control);
  if (json) {
    writeLine(io.stdout, JSON.stringify(control, null, 2));
    return;
  }

  writeLine(
    io.stdout,
    `${io.theme.bold(asText(control.name, 'Control'))} ${io.theme.dim(`· ${asText(control.code, '-')}`)}`,
  );
  const owner = asRecord(control.owner);
  const fields: [string, unknown][] = [
    ['Domain', control.domain],
    ['Status', control.status],
    ['Applicability', control.applicability],
    ['Owner', owner.email ?? control.owner],
    ['Design requirements', control.designRequirements],
  ];
  for (const [label, value] of fields) {
    if (value === undefined || value === null || value === '') continue;
    writeLine(io.stdout, `  ${io.theme.dim(`${label}:`)} ${text(value)}`);
  }
  if (typeof control.notes === 'string' && control.notes.trim() !== '') {
    writeLine(io.stdout);
    writeLine(io.stdout, control.notes);
  }
};

export const controlItemsCommand = async ({
  io,
  name,
  apiUrl,
  json = false,
  credentialStore,
  search,
  page,
  limit,
}: ControlReadOptions & {
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = { name };
  if (search) input.search = search;
  if (page) input.page = page;
  if (limit) input.limit = limit;
  const envelope = await callTool(ctx, 'list_control_items', input);
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not read control items.'));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }
  const data = asRecord(envelope.data);
  const items = Array.isArray(data.items) ? data.items : [];
  writeLine(io.stdout, `${io.theme.bold('Control items')} ${io.theme.dim(`(${items.length})`)}`);
  if (items.length === 0) {
    writeLine(io.stdout, 'No items linked.');
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
};

export const controlAvailableItemsCommand = async ({
  io,
  name,
  itemType,
  apiUrl,
  json = false,
  credentialStore,
  search,
  page,
  limit,
}: ControlReadOptions & {
  itemType: string;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = { name, itemType };
  if (search) input.search = search;
  if (page) input.page = page;
  if (limit) input.limit = limit;
  const envelope = await callTool(ctx, 'list_control_items_available', input);
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
    writeLine(io.stdout, 'Nothing available to link.');
    return;
  }
  writeTable(
    io,
    ['ITEM', 'STATUS'],
    items.map((item) => {
      const record = asRecord(item);
      return [text(record.name, text(record.id)), text(record.status)];
    }),
  );
};

export const controlUpdateCommand = async ({
  io,
  name,
  apiUrl,
  json = false,
  yes = false,
  confirm,
  credentialStore,
  changes,
}: ControlReadOptions & {
  yes?: boolean | undefined;
  confirm?: ((question: string) => Promise<boolean>) | undefined;
  changes: Record<string, unknown>;
}): Promise<void> => {
  if (Object.keys(changes).length === 0) {
    throw new Error('Provide at least one field, for example --applicability out_of_scope');
  }
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'update_control',
    input: { name, changes },
    fallback: 'Could not update the control.',
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

export const controlLinkCommand = async ({
  io,
  name,
  action,
  itemType,
  itemId,
  apiUrl,
  json = false,
  yes = false,
  confirm,
  credentialStore,
}: ControlCommonOptions & {
  name: string;
  action: string;
  itemType: string;
  itemId: string;
  yes?: boolean | undefined;
  confirm?: ((question: string) => Promise<boolean>) | undefined;
}): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'link_control_item',
    input: { name, action, itemType, itemId },
    fallback: 'Could not change the control item.',
    yes,
    confirm,
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else
    writeLine(
      io.stdout,
      `${io.theme.green('✓')} ${action === 'unlink' ? 'unlinked' : 'linked'} ${itemType} on ${name}`,
    );
};
