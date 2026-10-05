import { applyTool } from '../actions.js';
import type { CredentialStore } from '../credentials.js';
import { writeLine, writeNextHint, writePageFooter, writeTable, clip, type CliIO } from '../io.js';
import { asRecord, asText, callTool, errorMessage, resolveToolContext } from '../toolSurface.js';

export interface AssetCommonOptions {
  io: CliIO;
  apiUrl?: string | undefined;
  json?: boolean | undefined;
  credentialStore?: CredentialStore | undefined;
}

const text = (value: unknown, fallback = '-'): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;

export const assetListCommand = async ({
  io,
  apiUrl,
  json = false,
  credentialStore,
  name,
  category,
  subCategory,
  status,
  businessImpact,
  dataClassification,
  source,
  technicalOwnerEmail,
  page,
  limit,
}: AssetCommonOptions & {
  name?: string | undefined;
  category?: string | undefined;
  subCategory?: string | undefined;
  status?: string | undefined;
  businessImpact?: string | undefined;
  dataClassification?: string | undefined;
  source?: string | undefined;
  technicalOwnerEmail?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const csv = (value: string): string[] =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  const input: Record<string, unknown> = {};
  if (name) input.name = name;
  if (category) input.category = csv(category);
  if (subCategory) input.subCategory = csv(subCategory);
  if (status) input.status = csv(status);
  if (businessImpact) input.businessImpact = csv(businessImpact);
  if (dataClassification) input.dataClassification = csv(dataClassification);
  if (source) input.source = csv(source);
  if (technicalOwnerEmail) input.technicalOwnerEmail = technicalOwnerEmail;
  if (page) input.page = page;
  if (limit) input.limit = limit;

  const envelope = await callTool(ctx, 'list_assets', input);
  if (envelope.status !== 'ok') throw new Error(errorMessage(envelope, 'Could not list assets.'));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }

  const data = asRecord(envelope.data);
  const assets = Array.isArray(data.assets) ? data.assets : [];
  writeLine(
    io.stdout,
    `${io.theme.bold('Assets')} ${io.theme.dim(`(${text(data.total, String(assets.length))} total)`)}`,
  );
  if (assets.length === 0) {
    writeLine(io.stdout, 'No assets found.');
    return;
  }
  writeTable(
    io,
    ['CODE', 'NAME', 'CATEGORY', 'STATUS', 'IMPACT', 'CLASSIFICATION'],
    assets.map((asset) => {
      const record = asRecord(asset);
      return [
        text(record.code, '-'),
        clip(text(record.name), 60),
        text(record.category),
        text(record.status),
        text(record.businessImpact),
        text(record.dataClassification),
      ];
    }),
  );
  writePageFooter(io, {
    shown: assets.length,
    total: typeof data.total === 'number' ? data.total : assets.length,
    page: typeof data.page === 'number' ? data.page : 1,
    limit: typeof data.limit === 'number' ? data.limit : 25,
    hasMore: data.hasMore === true,
  });
  const next = asText(asRecord(assets[0]).code);
  if (next) writeNextHint(io, `ciphrix asset get ${next}`);
};

export const assetGetCommand = async ({
  io,
  name,
  apiUrl,
  json = false,
  credentialStore,
}: AssetCommonOptions & { name: string }): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'get_asset', { name });
  if (envelope.status !== 'ok') throw new Error(errorMessage(envelope, 'Asset not found.'));

  const asset = asRecord(asRecord(envelope.data).asset);
  if (json) {
    writeLine(io.stdout, JSON.stringify(asset, null, 2));
    return;
  }
  writeLine(
    io.stdout,
    `${io.theme.bold(asText(asset.name, 'Asset'))} ${io.theme.dim(`· ${asText(asset.code)}`)}`,
  );
  const fields: [string, unknown][] = [
    ['Customer key', asset.customerAssetKey],
    ['Category', asset.category],
    ['Sub-category', asset.subCategory],
    ['Status', asset.status],
    ['Business impact', asset.businessImpact],
    ['Data classification', asset.dataClassification],
    ['Technical owner', asset.technicalOwner],
    ['Business owner', asset.businessOwner],
    ['External ref', asset.externalRefId],
    ['Location', asset.location],
  ];
  for (const [label, value] of fields) {
    if (value === undefined || value === null || value === '') continue;
    writeLine(io.stdout, `  ${io.theme.dim(`${label}:`)} ${text(value)}`);
  }
  if (typeof asset.description === 'string' && asset.description.trim() !== '') {
    writeLine(io.stdout);
    writeLine(io.stdout, asset.description);
  }
};

export const assetLinksCommand = async ({
  io,
  name,
  type,
  apiUrl,
  json = false,
  credentialStore,
  page,
  limit,
}: AssetCommonOptions & {
  name: string;
  type: string;
  page?: number | undefined;
  limit?: number | undefined;
}): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = { name, type };
  if (page) input.page = page;
  if (limit) input.limit = limit;
  const envelope = await callTool(ctx, 'list_asset_links', input);
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, `Could not read asset ${type}.`));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }
  const data = asRecord(envelope.data);
  const items = Array.isArray(data.items) ? data.items : [];
  writeLine(
    io.stdout,
    `${io.theme.bold(`Asset ${type}`)} ${io.theme.dim(`(${text(data.total, String(items.length))})`)}`,
  );
  if (items.length === 0) {
    writeLine(io.stdout, `No ${type} mapped.`);
    return;
  }
  writeTable(
    io,
    ['ITEM', 'STATUS'],
    items.map((item) => {
      const record = asRecord(item);
      return [
        text(
          record.name ?? record.asset_name ?? record.control_name ?? record.risk_title ?? record.id,
        ),
        text(record.status),
      ];
    }),
  );
};

export const assetUpdateCommand = async ({
  io,
  name,
  apiUrl,
  json = false,
  yes = false,
  credentialStore,
  changes,
}: AssetCommonOptions & {
  name: string;
  yes?: boolean | undefined;
  changes: Record<string, unknown>;
}): Promise<void> => {
  if (Object.keys(changes).length === 0) {
    throw new Error('Provide at least one field, for example --status active');
  }
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'update_asset',
    input: { name, changes },
    fallback: 'Could not update the asset.',
    yes,
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else {
    const data = asRecord(result.data);
    const applied = Array.isArray(data.applied) ? data.applied.join(', ') : '';
    const failed = Array.isArray(data.failed) ? data.failed.length : 0;
    writeLine(
      io.stdout,
      `${io.theme.green('✓')} updated ${name}: ${applied}${failed > 0 ? io.theme.yellow(` · ${failed} refused`) : ''}`,
    );
  }
};

export const assetCreateCommand = async ({
  io,
  apiUrl,
  json = false,
  credentialStore,
  name,
  category,
  subCategory,
  customerAssetKey,
  externalRefId,
  description,
  status,
  businessImpact,
  dataClassification,
  technicalOwner,
  businessOwner,
  location,
}: AssetCommonOptions & {
  name: string;
  category: string;
  subCategory: string;
  customerAssetKey?: string | undefined;
  externalRefId?: string | undefined;
  description?: string | undefined;
  status?: string | undefined;
  businessImpact?: string | undefined;
  dataClassification?: string | undefined;
  technicalOwner?: string | undefined;
  businessOwner?: string | undefined;
  location?: string | undefined;
}): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = { name, category, subCategory };
  for (const [key, value] of [
    ['customerAssetKey', customerAssetKey],
    ['externalRefId', externalRefId],
    ['description', description],
    ['status', status],
    ['businessImpact', businessImpact],
    ['dataClassification', dataClassification],
    ['technicalOwner', technicalOwner],
    ['businessOwner', businessOwner],
    ['location', location],
  ] as const) {
    if (value !== undefined) input[key] = value;
  }

  const result = await applyTool({
    ctx,
    io,
    toolName: 'create_asset',
    input,
    fallback: 'Could not create the asset.',
  });
  if (!result) return;
  const data = asRecord(result.data);
  if (json) {
    writeLine(io.stdout, JSON.stringify(data, null, 2));
    return;
  }
  writeLine(
    io.stdout,
    `${io.theme.green('✓')} asset created: ${asText(data.code, '') || asText(data.id)}`,
  );
};

export const assetDeleteCommand = async ({
  io,
  name,
  apiUrl,
  json = false,
  yes = false,
  credentialStore,
}: AssetCommonOptions & { name: string; yes?: boolean | undefined }): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'delete_asset',
    input: { name },
    fallback: 'Could not delete the asset.',
    yes,
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else writeLine(io.stdout, `${io.theme.green('✓')} asset ${name} deleted`);
};

export const assetTagsCommand = async ({
  io,
  name,
  apiUrl,
  json = false,
  credentialStore,
}: AssetCommonOptions & { name: string }): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'list_asset_tags', { name });
  if (envelope.status !== 'ok') throw new Error(errorMessage(envelope, 'Could not read the tags.'));

  const data = asRecord(envelope.data);
  const tags = Array.isArray(data.tags) ? data.tags : [];
  if (json) {
    writeLine(io.stdout, JSON.stringify(data, null, 2));
    return;
  }
  writeLine(io.stdout, `${io.theme.bold('Asset tags')} ${io.theme.dim(`(${tags.length})`)}`);
  if (tags.length === 0) {
    writeLine(io.stdout, 'No tags assigned.');
    return;
  }
  writeTable(
    io,
    ['MAPPING', 'KEY', 'VALUE'],
    tags.map((tag) => {
      const record = asRecord(tag);
      return [asText(record.mappingId, '-'), asText(record.key), asText(record.value)];
    }),
  );
};

export const assetTagCommand = async ({
  io,
  name,
  key,
  value,
  mappingId,
  apiUrl,
  json = false,
  yes = false,
  credentialStore,
}: AssetCommonOptions & {
  name: string;
  key?: string | undefined;
  value?: string | undefined;
  mappingId?: string | undefined;
  yes?: boolean | undefined;
}): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = mappingId
    ? { name, action: 'remove', mappingId }
    : { name, action: 'assign', tags: [{ key: key as string, value: value as string }] };
  const result = await applyTool({
    ctx,
    io,
    toolName: 'set_asset_tag',
    input,
    fallback: 'Could not change the tag.',
    yes,
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else
    writeLine(
      io.stdout,
      `${io.theme.green('✓')} tag ${mappingId ? 'removed from' : 'assigned to'} ${name}`,
    );
};
