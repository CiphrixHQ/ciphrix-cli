import { applyTool } from '../actions.js';
import type { CredentialStore } from '../credentials.js';
import { writeLine, writeNextHint, writePageFooter, writeTable, type CliIO } from '../io.js';
import { uploadLocalFile } from '../upload.js';
import { asRecord, callTool, errorMessage, resolveToolContext, asText } from '../toolSurface.js';

export interface RiskCommonOptions {
  io: CliIO;
  apiUrl?: string | undefined;
  json?: boolean | undefined;
  credentialStore?: CredentialStore | undefined;
}

export interface RiskTargetOptions extends RiskCommonOptions {
  risk: string;
}

export interface RiskActionOptions extends RiskTargetOptions {
  yes?: boolean | undefined;
  confirm?: ((question: string) => Promise<boolean>) | undefined;
}

const text = (value: unknown, fallback = '-'): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;

const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const target = (risk: string): Record<string, unknown> =>
  UUID.test(risk) ? { riskId: risk } : { title: risk };

export const riskListCommand = async ({
  io,
  apiUrl,
  json = false,
  credentialStore,
  status,
  businessUnit,
  page,
  limit,
}: RiskCommonOptions & {
  status?: string | undefined;
  businessUnit?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = {};
  if (status)
    input.status = status
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  if (businessUnit) input.businessUnit = businessUnit;
  if (page) input.page = page;
  if (limit) input.limit = limit;

  const envelope = await callTool(ctx, 'list_risks', input);
  if (envelope.status !== 'ok') throw new Error(errorMessage(envelope, 'Could not list risks.'));

  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }

  const data = asRecord(envelope.data);
  const risks = Array.isArray(data.risks) ? data.risks : [];
  writeLine(
    io.stdout,
    `${io.theme.bold('Risks')} ${io.theme.dim(`(${text(data.total, String(risks.length))} total)`)}`,
  );
  if (risks.length === 0) {
    writeLine(io.stdout, 'No risks found.');
    return;
  }
  writeTable(
    io,
    ['CODE', 'TITLE', 'STATUS', 'OWNER', 'BUSINESS UNIT', 'SCORE'],
    risks.map((risk) => {
      const record = asRecord(risk);
      return [
        text(record.code, '-'),
        text(record.title),
        text(record.status),
        text(record.owner),
        text(record.businessUnit),
        text(record.score),
      ];
    }),
  );
  writePageFooter(io, {
    shown: risks.length,
    total: typeof data.total === 'number' ? data.total : risks.length,
    page: typeof data.page === 'number' ? data.page : 1,
    limit: typeof data.limit === 'number' ? data.limit : 25,
    hasMore: data.hasMore === true,
  });
  const next = asText(asRecord(risks[0]).code);
  if (next) writeNextHint(io, `ciphrix risk get ${next}`);
};

export const riskGetCommand = async ({
  io,
  risk,
  apiUrl,
  json = false,
  credentialStore,
}: RiskTargetOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'get_risk', target(risk));
  if (envelope.status !== 'ok') throw new Error(errorMessage(envelope, 'Risk not found.'));

  const detail = asRecord(asRecord(envelope.data).risk);
  if (json) {
    writeLine(io.stdout, JSON.stringify(detail, null, 2));
    return;
  }

  writeLine(io.stdout, io.theme.bold(text(detail.risk_title ?? detail.title, 'Risk')));
  const fields: [string, unknown][] = [
    ['Status', detail.risk_status ?? detail.status],
    ['Category', detail.risk_category ?? detail.category],
    ['Business unit', detail.business_unit ?? detail.businessUnit],
    ['Owner', detail.risk_owner ?? detail.owner],
    ['Code', detail.risk_code],
    ['Description', detail.risk_description ?? detail.description],
    ['Context', detail.risk_context ?? detail.context],
  ];
  for (const [label, value] of fields) {
    if (value === undefined || value === null || value === '') continue;
    writeLine(io.stdout, `  ${io.theme.dim(`${label}:`)} ${text(value)}`);
  }
};

export interface RiskUpdateOptions extends RiskTargetOptions {
  changes: Record<string, string>;
}

export const riskUpdateCommand = async ({
  io,
  risk,
  changes,
  apiUrl,
  json = false,
  credentialStore,
}: RiskUpdateOptions): Promise<void> => {
  if (Object.keys(changes).length === 0) {
    throw new Error('Provide at least one field, for example --status closed');
  }
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'update_risk',
    input: { ...target(risk), changes },
    fallback: 'Could not update the risk.',
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else {
    const data = asRecord(result.data);
    const applied = Array.isArray(data.applied)
      ? data.applied.map((value) => text(value)).join(', ')
      : '';
    writeLine(io.stdout, `${io.theme.green('✓')} updated ${risk}: ${applied}`);
  }
};

export const riskCreateCommand = async ({
  io,
  apiUrl,
  json = false,
  credentialStore,
  title,
  category,
  description,
}: RiskCommonOptions & {
  title: string;
  category?: string | undefined;
  description?: string | undefined;
}): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = { title };
  if (category) input.category = category;
  if (description) input.description = description;
  const result = await applyTool({
    ctx,
    io,
    toolName: 'create_risk',
    input,
    fallback: 'Could not create the risk.',
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else writeLine(io.stdout, `${io.theme.green('✓')} risk created: ${title}`);
};

export const riskDeleteCommand = async ({
  io,
  risk,
  apiUrl,
  json = false,
  yes = false,
  confirm,
  credentialStore,
}: RiskActionOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'delete_risk',
    input: target(risk),
    fallback: 'Could not delete the risk.',
    yes,
    confirm,
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else writeLine(io.stdout, `${io.theme.green('✓')} risk ${risk} deleted`);
};

const riskTarget = (risk: string): { name?: string; code?: string } => {
  const looksLikeCode = /^[A-Z0-9]{2,10}-[A-Z]{2,5}-[A-Z0-9]{2,8}$/.test(risk);
  return looksLikeCode ? { code: risk } : { name: risk };
};

export const riskTreatmentCommand = async ({
  io,
  risk,
  apiUrl,
  json = false,
  credentialStore,
}: RiskTargetOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'get_risk_treatment', riskTarget(risk));
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not read the treatment.'));

  const data = asRecord(envelope.data);
  if (json) {
    writeLine(io.stdout, JSON.stringify(data, null, 2));
    return;
  }
  writeLine(io.stdout, `${io.theme.bold('Treatment')} ${io.theme.dim(`· ${risk}`)}`);
  writeLine(io.stdout, `  ${io.theme.dim('Strategy:')} ${asText(data.treatmentType, 'not_set')}`);
  if (typeof data.treatmentNotes === 'string' && data.treatmentNotes.trim() !== '') {
    writeLine(io.stdout);
    writeLine(io.stdout, data.treatmentNotes);
  }
};

export const riskScoresCommand = async ({
  io,
  risk,
  apiUrl,
  json = false,
  credentialStore,
}: RiskTargetOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'list_risk_scores', riskTarget(risk));
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not read the scores.'));
  if (json) {
    writeLine(io.stdout, JSON.stringify(envelope.data, null, 2));
    return;
  }
  const scores = asRecord(asRecord(envelope.data).scores);
  writeLine(io.stdout, `${io.theme.bold('Scores')} ${io.theme.dim(`· ${risk}`)}`);
  for (const [label, value] of Object.entries(scores)) {
    if (value === null || value === undefined || value === '') continue;
    writeLine(
      io.stdout,
      `  ${io.theme.dim(`${label}:`)} ${typeof value === 'string' ? value : JSON.stringify(value)}`,
    );
  }
};

export const riskControlsCommand = async ({
  io,
  risk,
  apiUrl,
  json = false,
  credentialStore,
}: RiskTargetOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'list_risk_controls', riskTarget(risk));
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not read the linked controls.'));

  const data = asRecord(envelope.data);
  const controls = Array.isArray(data.controls) ? data.controls : [];
  if (json) {
    writeLine(io.stdout, JSON.stringify(data, null, 2));
    return;
  }
  writeLine(
    io.stdout,
    `${io.theme.bold('Linked controls')} ${io.theme.dim(`(${controls.length})`)}`,
  );
  if (controls.length === 0) {
    writeLine(io.stdout, 'No controls linked.');
    return;
  }
  writeTable(
    io,
    ['CONTROL', 'CODE'],
    controls.map((control) => {
      const record = asRecord(control);
      return [asText(record.name, asText(record.id)), asText(record.code, '-')];
    }),
  );
};

export const riskLinkControlCommand = async ({
  io,
  risk,
  controlInstanceId,
  mappingId,
  action,
  apiUrl,
  json = false,
  yes = false,
  credentialStore,
}: RiskTargetOptions & {
  controlInstanceId?: string | undefined;
  mappingId?: string | undefined;
  action: string;
  yes?: boolean | undefined;
}): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const input: Record<string, unknown> = { ...riskTarget(risk), action };
  if (controlInstanceId) input.controlInstanceId = controlInstanceId;
  if (mappingId) input.mappingId = mappingId;
  const result = await applyTool({
    ctx,
    io,
    toolName: 'link_risk_control',
    input,
    fallback: 'Could not change the risk control.',
    yes,
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else
    writeLine(
      io.stdout,
      `${io.theme.green('✓')} control ${action === 'unlink' ? 'unlinked' : 'linked'} on ${risk}`,
    );
};

export const riskFilesCommand = async ({
  io,
  risk,
  apiUrl,
  json = false,
  credentialStore,
}: RiskTargetOptions): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const envelope = await callTool(ctx, 'list_risk_files', riskTarget(risk));
  if (envelope.status !== 'ok')
    throw new Error(errorMessage(envelope, 'Could not read risk files.'));

  const data = asRecord(envelope.data);
  const files = Array.isArray(data.files) ? data.files : [];
  if (json) {
    writeLine(io.stdout, JSON.stringify(data, null, 2));
    return;
  }
  writeLine(io.stdout, `${io.theme.bold('Risk files')} ${io.theme.dim(`(${files.length})`)}`);
  if (files.length === 0) {
    writeLine(io.stdout, 'No files attached.');
    return;
  }
  writeTable(
    io,
    ['MAPPING', 'FILE'],
    files.map((file) => {
      const record = asRecord(file);
      return [asText(record.mappingId, '-'), asText(record.name)];
    }),
  );
};

export const riskAttachCommand = async ({
  io,
  risk,
  file,
  uploadId,
  apiUrl,
  json = false,
  yes = false,
  credentialStore,
}: RiskTargetOptions & {
  file?: string | undefined;
  uploadId?: string | undefined;
  yes?: boolean | undefined;
}): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  let uploadIds: string[];
  if (uploadId) uploadIds = [uploadId];
  else if (file) uploadIds = [(await uploadLocalFile(ctx, file, 'risk')).id];
  else throw new Error('Provide --file <path> or --upload <uploadId>');

  const result = await applyTool({
    ctx,
    io,
    toolName: 'link_risk_file',
    input: { ...riskTarget(risk), action: 'link', uploadIds },
    fallback: 'Could not attach the file.',
    yes,
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else
    writeLine(io.stdout, `${io.theme.green('✓')} attached ${uploadIds.length} file(s) to ${risk}`);
};

export const riskDetachCommand = async ({
  io,
  risk,
  mappingId,
  apiUrl,
  json = false,
  yes = false,
  credentialStore,
}: RiskTargetOptions & { mappingId: string; yes?: boolean | undefined }): Promise<void> => {
  const ctx = await resolveToolContext(apiUrl, credentialStore);
  const result = await applyTool({
    ctx,
    io,
    toolName: 'link_risk_file',
    input: { ...riskTarget(risk), action: 'unlink', mappingId },
    fallback: 'Could not detach the file.',
    yes,
  });
  if (!result) return;
  if (json) writeLine(io.stdout, JSON.stringify(result.data, null, 2));
  else writeLine(io.stdout, `${io.theme.green('✓')} detached ${mappingId} from ${risk}`);
};
