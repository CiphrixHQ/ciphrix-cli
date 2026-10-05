import { applyTool } from '../actions.js';
import type { CredentialStore } from '../credentials.js';
import { writeLine, writeNextHint, writePageFooter, writeTable, type CliIO } from '../io.js';
import { asRecord, callTool, errorMessage, resolveToolContext, asText } from '../toolSurface.js';
import { uploadLocalFile } from '../upload.js';

export interface VendorCommonOptions {
  io: CliIO;
  apiUrl?: string | undefined;
  json?: boolean | undefined;
  credentialStore?: CredentialStore | undefined;
}

export interface VendorReadOptions extends VendorCommonOptions {
  name: string;
}

export interface VendorActionOptions extends VendorCommonOptions {
  name?: string | undefined;
  yes?: boolean | undefined;
  confirm?: ((question: string) => Promise<boolean>) | undefined;
}

const text = (value: unknown, fallback = '-'): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;

export const vendorListCommand = async ({
  io,
  apiUrl,
  json = false,
  credentialStore,
  name,
  criticality,
  relationshipStatus,
  page,
  limit,
}: VendorCommonOptions & {
  name?: string | undefined;
  criticality?: string | undefined;
  relationshipStatus?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = {};
  if (name) input.name = name;
  if (criticality) input.criticality = criticality;
  if (relationshipStatus) input.relationshipStatus = relationshipStatus;
  if (page) input.page = page;
  if (limit) input.limit = limit;

  const envelope = await callTool(ctx, 'list_vendors', input);
  if (envelope.status !== 'ok') throw new Error(errorMessage(envelope, 'Could not list vendors.'));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }

  const data = asRecord(envelope.data);
  const vendors = Array.isArray(data.vendors) ? data.vendors : [];
  writeLine(
    io.stdout,
    `${io.theme.bold('Vendors')} ${io.theme.dim(`(${text(data.total, String(vendors.length))} total)`)}`,
  );
  if (vendors.length === 0) {
    writeLine(io.stdout, 'No vendors found.');
    return;
  }
  writeTable(
    io,
    ['CODE', 'NAME', 'CATEGORY', 'CRITICALITY', 'RELATIONSHIP', 'REVIEW'],
    vendors.map((vendor) => {
      const record = asRecord(vendor);
      return [
        text(record.code, '-'),
        text(record.name),
        text(record.category),
        text(record.criticality),
        text(record.relationshipStatus),
        text(record.reviewStatus),
      ];
    }),
  );
  writePageFooter(io, {
    shown: vendors.length,
    total: typeof data.total === 'number' ? data.total : vendors.length,
    page: typeof data.page === 'number' ? data.page : 1,
    limit: typeof data.limit === 'number' ? data.limit : 25,
    hasMore: data.hasMore === true,
  });
  const next = asText(asRecord(vendors[0]).code);
  if (next) writeNextHint(io, `ciphrix vendor get ${next}`);
};

export const vendorGetCommand = async ({
  io,
  name,
  apiUrl,
  json = false,
  credentialStore,
}: VendorReadOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'get_vendor', { name });
  if (envelope.status !== 'ok') throw new Error(errorMessage(envelope, 'Vendor not found.'));

  const vendor = asRecord(asRecord(envelope.data).vendor);
  if (json) {
    writeLine(io.stdout, JSON.stringify(vendor, null, 2));
    return;
  }

  writeLine(io.stdout, io.theme.bold(text(vendor.vendor_name ?? vendor.name, 'Vendor')));
  const fields: [string, unknown][] = [
    ['Category', vendor.vendor_category ?? vendor.category],
    ['Criticality', vendor.business_criticality ?? vendor.criticality],
    ['Data sensitivity', vendor.data_sensitivity],
    ['Relationship', vendor.vendor_relationship_status],
    ['Review status', vendor.workflow_status ?? vendor.vendor_review_status],
    ['Website', vendor.vendor_website ?? vendor.website],
    ['Description', vendor.vendor_description ?? vendor.description],
  ];
  for (const [label, value] of fields) {
    if (value === undefined || value === null || value === '') continue;
    writeLine(io.stdout, `  ${io.theme.dim(`${label}:`)} ${text(value)}`);
  }
};

export const vendorCreateCommand = async ({
  io,
  apiUrl,
  json = false,
  credentialStore,
  name,
  category,
  subcategory,
  criticality,
  dataSensitivity,
  serviceAvailability,
  description,
}: VendorCommonOptions & {
  name: string;
  category?: string | undefined;
  subcategory?: string | undefined;
  criticality?: string | undefined;
  dataSensitivity?: string | undefined;
  serviceAvailability?: string | undefined;
  description?: string | undefined;
}): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = { name };
  if (category) input.category = category;
  if (subcategory) input.subcategory = subcategory;
  if (criticality) input.criticality = criticality;
  if (dataSensitivity) input.dataSensitivity = dataSensitivity;
  if (serviceAvailability) input.serviceAvailability = serviceAvailability;
  if (description) input.description = description;
  const result = await applyTool({
    ctx,
    io,
    toolName: 'create_vendor',
    input,
    fallback: 'Could not create the vendor.',
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else
    writeLine(
      io.stdout,
      `${io.theme.green('✓')} vendor created: ${text(asRecord(result.data).name)}`,
    );
};

export interface VendorUpdateOptions extends VendorReadOptions {
  changes: Record<string, string>;
}

export const vendorUpdateCommand = async ({
  io,
  name,
  apiUrl,
  json = false,
  credentialStore,
  changes,
}: VendorUpdateOptions): Promise<void> => {
  if (Object.keys(changes).length === 0) {
    throw new Error('Provide at least one field, for example --criticality high');
  }
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'update_vendor',
    input: { name, changes },
    fallback: 'Could not update the vendor.',
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else {
    const data = asRecord(result.data);
    const applied = Array.isArray(data.applied)
      ? data.applied.map((value) => text(value)).join(', ')
      : '';
    writeLine(io.stdout, `${io.theme.green('✓')} updated ${name}: ${applied}`);
  }
};

export const vendorDeleteCommand = async ({
  io,
  name,
  apiUrl,
  json = false,
  yes = false,
  confirm,
  credentialStore,
}: VendorActionOptions): Promise<void> => {
  if (!name) throw new Error('Provide the vendor name.');
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'delete_vendor',
    input: { name },
    fallback: 'Could not delete the vendor.',
    yes,
    confirm,
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else writeLine(io.stdout, `${io.theme.green('✓')} vendor ${name} deleted`);
};

export const vendorFilesCommand = async ({
  io,
  name,
  apiUrl,
  json = false,
  credentialStore,
}: VendorReadOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'list_vendor_files', { name });
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not read vendor files.'));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }
  const data = asRecord(envelope.data);
  const files = Array.isArray(data.files) ? data.files : [];
  writeLine(io.stdout, `${io.theme.bold('Vendor files')} ${io.theme.dim(`(${files.length})`)}`);
  if (files.length === 0) {
    writeLine(io.stdout, 'No files attached.');
    return;
  }
  writeTable(
    io,
    ['MAPPING', 'FILE', 'ATTACHED'],
    files.map((file) => {
      const record = asRecord(file);
      return [
        text(record.mappingId, '-'),
        text(record.name),
        asText(record.attachedAt).slice(0, 10) || '-',
      ];
    }),
  );
};

export const vendorAttachCommand = async ({
  io,
  name,
  file,
  uploadId,
  apiUrl,
  json = false,
  yes = false,
  credentialStore,
}: VendorReadOptions & {
  file?: string | undefined;
  uploadId?: string | undefined;
  yes?: boolean | undefined;
}): Promise<void> => {
  if (!file && !uploadId) throw new Error('Provide --file <path> or --upload <uploadId>');
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  let uploadIds: string[];
  if (uploadId) {
    uploadIds = [uploadId];
  } else if (file) {
    uploadIds = [(await uploadLocalFile(ctx, file, 'vendor')).id];
  } else {
    throw new Error('Provide --file <path> or --upload <uploadId>');
  }

  const result = await applyTool({
    ctx,
    io,
    toolName: 'link_vendor_file',
    input: { name, action: 'link', uploadIds },
    fallback: 'Could not attach the file.',
    yes,
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else
    writeLine(io.stdout, `${io.theme.green('✓')} attached ${uploadIds.length} file(s) to ${name}`);
};

export const vendorDetachCommand = async ({
  io,
  name,
  mappingId,
  apiUrl,
  json = false,
  yes = false,
  credentialStore,
}: VendorReadOptions & { mappingId: string; yes?: boolean | undefined }): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'link_vendor_file',
    input: { name, action: 'unlink', mappingId },
    fallback: 'Could not detach the file.',
    yes,
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else writeLine(io.stdout, `${io.theme.green('✓')} detached ${mappingId} from ${name}`);
};
