import { Command, Option } from 'commander';

import { applyTool } from '../actions.js';
import { ApiError } from '../api.js';
import { promptConfirm, writeLine, type CliIO } from '../io.js';
import { ManifestError, resolveBinding, type ToolDescriptor } from '../manifest.js';
import { asRecord, callTool, resolveToolContext, type ToolContext } from '../toolSurface.js';
import { FileInputError, readUploadFile, stageLocalFile } from '../upload.js';
import {
  capabilities,
  onboardingOperations,
  type Capability,
  type Field,
} from './capabilityDefinitions.js';

export class RenderedCommandError extends Error {}
class InputError extends Error {}
const retryHelp =
  'Writes use one idempotency key per operation. Reuse that key/input for retries; never bypass an unknown outcome with a new key. Confirmed calls also require valid confirmation: a fresh invocation re-preflights and may be blocked by changed state or expiry. Inspect current state/jobs when uncertain. Replayed status packs and signed URLs are snapshots, not refreshed reads.';

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new InputError('Expected strict JSON. Quote string values as JSON strings.');
  }
};

const inputFor = async (
  spec: Capability,
  args: string[],
  options: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const input: Record<string, unknown> = {};
  for (const [index, name] of (spec.argument?.split(' ') ?? []).entries())
    input[name] = args[index];
  for (const field of spec.fields) {
    const value =
      options[field.flag.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())];
    if (value === undefined) continue;
    if (Object.hasOwn(input, field.field))
      throw new InputError(`Conflicting options for ${field.field}.`);
    let parsed: unknown = value;
    if (field.kind === 'clear') parsed = null;
    if (field.kind === 'integer') {
      if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
        throw new InputError(`--${field.flag} requires a nonnegative integer.`);
      parsed = Number(value);
    }
    if (field.kind === 'json') {
      if (typeof value !== 'string') throw new InputError('Expected a JSON argument.');
      parsed = parseJson(value);
    }
    if (field.kind === 'file') {
      if (typeof value !== 'string') throw new InputError('Expected a regular file path.');
      parsed = parseJson((await readUploadFile(value, 1024 * 1024)).toString('utf8'));
      if (!Array.isArray(parsed)) throw new InputError(`--${field.flag} requires a JSON array.`);
    }
    input[field.field] = parsed;
  }
  if (spec.path === 'access entry bulk-update') input.operation = 'update';
  return input;
};

const partialFailure = (value: unknown, depth = 0): boolean => {
  if (depth > 32 || !value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => partialFailure(item, depth + 1));
  const record = asRecord(value);
  if (
    ['failures', 'failed', 'unmerged'].some(
      (key) => Array.isArray(record[key]) && (record[key] as unknown[]).length > 0,
    )
  )
    return true;
  return Object.values(record).some((child) => partialFailure(child, depth + 1));
};

const execute = async (
  ctx: ToolContext,
  tool: ToolDescriptor,
  input: Record<string, unknown>,
  io: CliIO,
  options: Record<string, unknown>,
): Promise<Record<string, unknown> | null> => {
  if (tool.effect === 'read') {
    if (options.yes || options.idempotencyKey !== undefined)
      throw new InputError('Write controls do not apply to a read operation.');
    return callTool(ctx, tool.name, input);
  }
  if (tool.confirmation === 'none' && options.yes)
    throw new InputError('This write applies immediately and does not accept --yes.');
  if (tool.confirmation !== 'none' && !options.yes && (options.json || !io.stdout.isTTY))
    throw new InputError(
      'This confirmed write requires --yes in JSON or non-interactive mode. No change was applied.',
    );
  return applyTool({
    ctx,
    io,
    quiet: options.json === true,
    toolName: tool.name,
    input,
    fallback: 'The operation could not be completed.',
    yes: options.yes === true,
    ...(typeof options.idempotencyKey === 'string' && { idempotencyKey: options.idempotencyKey }),
    confirm: (question) => promptConfirm(io, question),
  });
};

const render = (
  io: CliIO,
  json: boolean,
  envelope: Record<string, unknown>,
  next: string,
): void => {
  if (json) io.stdout.write(`${JSON.stringify(envelope)}\n`);
  else {
    writeLine(io.stdout, JSON.stringify(envelope.data ?? envelope, null, 2));
    if (Array.isArray(envelope.warnings))
      for (const warning of envelope.warnings) writeLine(io.stdout, `warning: ${String(warning)}`);
    if (asRecord(envelope.meta).truncated)
      writeLine(io.stdout, 'Results are truncated; inspect continuation details.');
    if (next) writeLine(io.stdout, `next: ciphrix ${next} --help`);
  }
};

const run = async (
  io: CliIO,
  options: Record<string, unknown>,
  next: string,
  action: (write: () => void) => Promise<Record<string, unknown> | null>,
): Promise<void> => {
  let failed: boolean;
  let applying = false;
  try {
    const key = options.idempotencyKey;
    if (key !== undefined && (typeof key !== 'string' || !key.trim() || key.length > 256)) {
      throw new InputError('The idempotency key must contain 1 to 256 characters.');
    }
    const envelope = await action(() => {
      applying = true;
    });
    if (!envelope) {
      if (options.json) io.stdout.write(`${JSON.stringify({ status: 'cancelled' })}\n`);
      return;
    }
    render(io, options.json === true, envelope, next);
    failed = envelope.status !== 'ok' || (applying && partialFailure(envelope.data));
    if (failed && !options.json)
      writeLine(
        io.stderr,
        'The operation failed or partially applied. Inspect the returned outcomes before taking further action.',
      );
  } catch (error) {
    const envelope =
      error instanceof ApiError && asRecord(error.envelope).status === 'error'
        ? asRecord(error.envelope)
        : {
            status: 'error',
            error: {
              code:
                error instanceof InputError || error instanceof FileInputError
                  ? 'invalid_input'
                  : error instanceof ManifestError
                    ? 'unsupported_capability'
                    : error instanceof ApiError
                      ? (error.code ?? 'http_error')
                      : 'transport_error',
              message:
                error instanceof InputError ||
                error instanceof FileInputError ||
                error instanceof ApiError ||
                error instanceof ManifestError
                  ? error.message
                  : 'The request could not be completed. Check capabilities and inspect state before retrying a write.',
              ...(error instanceof ApiError && {
                httpStatus: error.status,
                ...(error.details !== undefined && { details: error.details }),
              }),
            },
          };
    render(options.json ? io : { ...io, stdout: io.stderr }, options.json === true, envelope, '');
    failed = true;
  }
  if (failed) throw new RenderedCommandError();
};

const groupDescriptions: Record<string, string> = {
  access: 'Access inventory, reviewed imports and assigned reviewer workflows',
  'access resource': 'Resources, owners and asset relationships',
  'access entry': 'Revisioned access inventory; inventory edits are not review decisions',
  'access import': 'Your import proposals, selected-row merges and explicit discard',
  'access review': 'Review campaigns, assigned decisions, completion and frozen outcomes',
  agent: 'Agent activity, complete proposals and explicit human decisions',
  'agent run': 'Grouped agent activity; findings are not completed assessments',
  'agent action': 'Findings, reviewed proposals and declared approve/reject/choose options',
  task: 'Your assigned stored work; discovery never completes tasks',
  file: 'Owned local-file staging and explicit processing; no automatic downloads',
};

const parent = (program: Command, path: string[]): Command => {
  let current = program;
  const traversed: string[] = [];
  for (const segment of path) {
    traversed.push(segment);
    current =
      current.commands.find((command) => command.name() === segment) ??
      current
        .command(segment)
        .description(groupDescriptions[traversed.join(' ')] ?? `${segment} capabilities`);
  }
  return current;
};

const common = (command: Command): void => {
  command
    .option('--api-url <url>', 'override the API base URL')
    .option('--json', 'emit one complete result/error envelope')
    .option(
      '--yes',
      'confirmed writes only: explicitly authorize without prompting; rejected on reads/immediate writes',
    )
    .option(
      '--idempotency-key <key>',
      'writes only: key for one logical operation; reuse identical input, at most 256 characters',
    )
    .addHelpText('after', `\n${retryHelp}\n`);
};

const addField = (command: Command, field: Field): void => {
  const flag = `--${field.flag}${['boolean', 'clear'].includes(field.kind) ? '' : ' <value>'}`;
  const option = new Option(flag, field.help);
  if (field.required) option.makeOptionMandatory();
  if (field.kind === 'repeat')
    option.argParser((value: string, previous: string[] = []) => [...previous, value]);
  command.addOption(option);
};

export const registerCapabilities = (
  program: Command,
  io: CliIO,
  context: (apiUrl?: string) => Promise<ToolContext> = resolveToolContext,
): void => {
  for (const spec of capabilities) {
    const segments = spec.path.split(' ');
    const operation = segments.pop()!;
    const command = parent(program, segments)
      .command(
        operation +
          (spec.argument
            ? ` ${spec.argument
                .split(' ')
                .map((name) => `<${name}>`)
                .join(' ')}`
            : ''),
      )
      .description(spec.description);
    for (const field of spec.fields) addField(command, field);
    if (spec.path === 'access entry bulk-update')
      command.addHelpText(
        'after',
        '\nRows: [{accessId, expectedRevision}]. Only update is exposed. field selects identity, personId, role or status; value is a JSON string, or null to clear personId. Each row can fail independently.\n',
      );
    if (spec.path === 'access import merge')
      command.addHelpText(
        'after',
        '\nRows require proposal_row_id. Optional reviewed corrections: resource_id, resource_name, website, identity, role, person_id, resource_owner_person_id, confirm_person_match, confirm_visual_evidence, expected_revision, access_id. Preserve snake_case. Never infer match/evidence confirmations or merge all rows implicitly. Read the proposal before selecting rows.\n',
      );
    if (spec.path === 'access review decide')
      command.addHelpText(
        'after',
        '\nItems: [{accessId, expectedRevision, decision, comment?}]. decision is keep or revoke; comment may be null. Revoke records a removal request, not provider revocation. Complete the assigned task separately after all decisions.\n',
      );
    common(command);
    command.action(async (...values: unknown[]) => {
      const options = asRecord(values[values.length - 2]);
      await run(io, options, spec.next, async (write) => {
        const input = await inputFor(spec, values.slice(0, -2) as string[], options);
        const ctx = await context(typeof options.apiUrl === 'string' ? options.apiUrl : undefined);
        const tool = await resolveBinding(ctx, segments, operation);
        if (tool.effect === 'write') write();
        if (spec.path === 'file stage') {
          if (tool.effect !== 'write' || tool.confirmation !== 'none' || options.yes)
            throw new InputError(
              'Staging requires an immediate write capability and does not accept --yes.',
            );
          const advertised = Number(tool.limits?.maxFileBytes);
          const staged = await stageLocalFile(
            ctx,
            String(input.path),
            String(input.purpose),
            {
              maxUploadBytes:
                Number.isSafeInteger(advertised) && advertised > 0
                  ? Math.min(advertised, 25 * 1024 * 1024)
                  : 25 * 1024 * 1024,
            },
            tool,
            typeof options.idempotencyKey === 'string' ? options.idempotencyKey : undefined,
          );
          return staged.envelope;
        }
        return execute(ctx, tool, input, io, options);
      });
    });
  }
  const onboarding = program
    .command('onboarding')
    .description(
      'Learn organizational context, inspect optional setup and explicitly complete the journey. Operating Context does not block completion.',
    );
  for (const [operation, description] of onboardingOperations)
    onboarding.option(
      `--${operation}${['get-context', 'set-context', 'init-framework'].includes(operation) ? ' <value>' : ''}`,
      description,
    );
  onboarding
    .option('--question <id>', 'questionId from the selected schema')
    .option('--value <json>', 'strict JSON answer, including quoted JSON strings')
    .option(
      '--additional-context <text>',
      'answer explanation; explanation-only answers are supported',
    );
  common(onboarding);
  onboarding.action(async (options: Record<string, unknown>) => {
    await run(io, options, 'onboarding --status', async (write) => {
      const selected = onboardingOperations.filter(
        ([operation]) =>
          options[
            operation.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
          ] !== undefined,
      );
      if (selected.length !== 1)
        throw new InputError('Select exactly one onboarding operation; use --help for syntax.');
      const operation = selected[0]![0];
      const input: Record<string, unknown> = {};
      if (operation === 'get-context' || operation === 'set-context')
        input.store = options[operation === 'get-context' ? 'getContext' : 'setContext'];
      if (operation === 'set-context') {
        if (
          typeof options.question !== 'string' ||
          (options.value === undefined && options.additionalContext === undefined)
        )
          throw new InputError(
            'Set context requires --question and --value and/or --additional-context.',
          );
        input.questionId = options.question;
        if (options.value !== undefined) {
          if (typeof options.value !== 'string') throw new InputError('Expected a JSON answer.');
          input.value = parseJson(options.value);
        }
        if (options.additionalContext !== undefined)
          input.additionalContext = options.additionalContext;
      } else if (
        options.question !== undefined ||
        options.value !== undefined ||
        options.additionalContext !== undefined
      )
        throw new InputError('Answer options require --set-context.');
      if (operation === 'init-framework') input.frameworkCode = options.initFramework;
      const ctx = await context(typeof options.apiUrl === 'string' ? options.apiUrl : undefined);
      const tool = await resolveBinding(
        ctx,
        ['onboarding'],
        operation === 'help-onboarding' ? 'help' : operation,
      );
      if (tool.effect === 'write') write();
      return execute(ctx, tool, input, io, options);
    });
  });
};
