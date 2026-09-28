import { Command, CommanderError } from 'commander';

import { formatBanner } from './banner.js';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import {
  clauseAvailableItemsCommand,
  clauseGetCommand,
  clauseItemsCommand,
  clauseLinkCommand,
  clauseUpdateCommand,
  frameworkClausesCommand,
  frameworkListCommand,
} from './commands/framework.js';
import {
  vendorAttachCommand,
  vendorCreateCommand,
  vendorDeleteCommand,
  vendorDetachCommand,
  vendorFilesCommand,
  vendorGetCommand,
  vendorListCommand,
  vendorUpdateCommand,
} from './commands/vendor.js';
import { jobStatusCommand } from './commands/job.js';
import {
  assetCreateCommand,
  assetDeleteCommand,
  assetGetCommand,
  assetLinksCommand,
  assetListCommand,
  assetTagCommand,
  assetTagsCommand,
  assetUpdateCommand,
} from './commands/asset.js';
import {
  controlAvailableItemsCommand,
  controlGetCommand,
  controlItemsCommand,
  controlLinkCommand,
  controlListCommand,
  controlUpdateCommand,
} from './commands/control.js';
import {
  testAttachCommand,
  testAvailableItemsCommand,
  testDeleteCommand,
  testGetCommand,
  testItemsCommand,
  testLinksCommand,
  testListCommand,
  testRunCreateCommand,
  testRunDeleteCommand,
  testRunResultCommand,
  testRunsCommand,
  testUpdateCommand,
} from './commands/test.js';
import {
  contextGetCommand,
  contextResetCommand,
  contextSetCommand,
  contextStatusCommand,
} from './commands/context.js';
import { policyGetCommand, policyListCommand } from './commands/policy.js';
import {
  policyApproveCommand,
  policyCreateCommand,
  policyDeleteCommand,
  policyEditCommand,
  policySubmitCommand,
  policyUpdateMetaCommand,
  policyVersionCommand,
  policyVersionsCommand,
} from './commands/policyActions.js';
import {
  riskAttachCommand,
  riskControlsCommand,
  riskCreateCommand,
  riskDeleteCommand,
  riskDetachCommand,
  riskFilesCommand,
  riskGetCommand,
  riskLinkControlCommand,
  riskListCommand,
  riskScoresCommand,
  riskTreatmentCommand,
  riskUpdateCommand,
} from './commands/risk.js';
import {
  checkFindingsCommand,
  checkIntegrationsCommand,
  checkListCommand,
  checkResourcesCommand,
  checkRunCommand,
  checkRunsCommand,
  checkSetEnabledCommand,
} from './commands/check.js';
import { CLI_NAME, CLI_TAGLINE, CLI_VERSION } from './constants.js';
import { setCliInsecureHttpOptIn } from './config.js';
import { createDefaultIO, writeBlock, writeLine, type CliIO } from './io.js';

export type { CliIO } from './io.js';

const readStringOption = (options: unknown, key: string): string | undefined => {
  if (!options || typeof options !== 'object') return undefined;
  const value = (options as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
};

const readBooleanOption = (options: unknown, key: string): boolean => {
  if (!options || typeof options !== 'object') return false;
  return (options as Record<string, unknown>)[key] === true;
};

const readNumberOption = (options: unknown, key: string): number | undefined => {
  if (!options || typeof options !== 'object') return undefined;
  const value = (options as Record<string, unknown>)[key];
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))
    return Number(value);
  return undefined;
};

const apiUrlOf = (url: string | undefined, options: unknown): string | undefined =>
  url ?? readStringOption(options, 'apiUrl');

/**
 * Builds the command tree. Kept separate from `main` so tests can construct a
 * program with captured output and no process exits.
 */
export const createProgram = (io: CliIO = createDefaultIO()): Command => {
  const program = new Command();

  program
    .name(CLI_NAME)
    .description(CLI_TAGLINE)
    .version(CLI_VERSION, '-v, --version', 'output the version number')
    .option(
      '--allow-insecure-http',
      'allow plaintext HTTP for intentional local or non-production testing only',
    )
    .showHelpAfterError()
    .showSuggestionAfterError();

  // This is a root option, so it works before or after the subcommand. Scope its
  // effect to the action; URL validation still happens before command side effects.
  program.hook('preAction', (_thisCommand, actionCommand) => {
    setCliInsecureHttpOptIn(actionCommand.optsWithGlobals().allowInsecureHttp === true);
  });
  program.hook('postAction', () => setCliInsecureHttpOptIn(false));

  program
    .command('login [url]')
    .description('Sign in to Ciphrix with device authorization')
    .option('--api-url <url>', 'API base URL')
    .option('--device-name <name>', 'a name for this device (defaults to the machine name)')
    .option('--no-open', 'do not open the verification link in a browser')
    .action(async (url: string | undefined, options: unknown) => {
      await loginCommand({
        io,
        apiUrl: apiUrlOf(url, options),
        deviceName: readStringOption(options, 'deviceName'),
        noOpen:
          readBooleanOption(options, 'noOpen') ||
          (options !== null &&
            typeof options === 'object' &&
            (options as Record<string, unknown>).open === false),
      });
    });

  program
    .command('logout')
    .description('Revoke the remote session and remove the stored credential')
    .option('--api-url <url>', 'API base URL')
    .option('--local-only', 'remove the local credential without revoking the remote session')
    .action(async (options: unknown) => {
      await logoutCommand({
        io,
        apiUrl: readStringOption(options, 'apiUrl'),
        localOnly: readBooleanOption(options, 'localOnly'),
      });
    });

  const context = program
    .command('context')
    .description('Read and update Business / Operating Context');

  context
    .command('get <store>')
    .description('Print a context digest (business | operating)')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (store: string, options: unknown) => {
      await contextGetCommand({
        io,
        store,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  context
    .command('status <store>')
    .description('Show context completion and unanswered questions')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (store: string, options: unknown) => {
      await contextStatusCommand({
        io,
        store,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  context
    .command('set <target> <value>')
    .description('Set one answer, for example business.company_size "50-200"')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (target: string, value: string, options: unknown) => {
      await contextSetCommand({
        io,
        target,
        value,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  context
    .command('reset')
    .description('Reset Business Context (asks to confirm)')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (options: unknown) => {
      await contextResetCommand({
        io,
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  const test = program.command('test').description('Tests, their runs, items and ownership');

  test
    .command('list')
    .description('List tests with their latest run status')
    .option('--search <text>', 'filter by name')
    .option('--status <csv>', 'filter by latest run status')
    .option('--page <n>', 'page number')
    .option('--limit <n>', 'page size')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (options: unknown) => {
      await testListCommand({
        io,
        search: readStringOption(options, 'search'),
        status: readStringOption(options, 'status'),
        page: readNumberOption(options, 'page'),
        limit: readNumberOption(options, 'limit'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  test
    .command('get <name>')
    .description('Show a test, its runs and AI assurance')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await testGetCommand({
        io,
        name,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  test
    .command('runs <name>')
    .description('List a test\u2019s runs with AI assurance')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await testRunsCommand({
        io,
        name,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  test
    .command('items <name>')
    .description('List a run\u2019s evidence with AI relevance (defaults to the current run)')
    .option('--run <id>', 'a specific run')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await testItemsCommand({
        io,
        name,
        runId: readStringOption(options, 'run'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  test
    .command('attach <name>')
    .description('Attach evidence to a run (defaults to the current run)')
    .option('--check <id>', 'link a check')
    .option('--native-doc <id>', 'link a native document')
    .option('--upload <id>', 'link a staged upload id')
    .option('--file <path>', 'upload a local file and attach it')
    .option('--run <id>', 'a specific run')
    .option('--unlink', 'unlink instead of link')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      const check = readStringOption(options, 'check');
      const nativeDoc = readStringOption(options, 'nativeDoc');
      const upload = readStringOption(options, 'upload');
      const itemId = check ?? nativeDoc ?? upload;
      const itemType = check ? 'check' : nativeDoc ? 'native_doc' : 'upload';
      await testAttachCommand({
        io,
        name,
        itemType,
        itemId: check || nativeDoc ? itemId : undefined,
        uploadIds: upload ? [upload] : undefined,
        file: readStringOption(options, 'file'),
        runId: readStringOption(options, 'run'),
        unlink: readBooleanOption(options, 'unlink'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  const testRun = test.command('run').description('Create, result and delete runs');

  testRun
    .command('create <name>')
    .description('Create a new pending run')
    .option('--run-at <date>', 'run date (ISO); defaults to now')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await testRunCreateCommand({
        io,
        name,
        runAt: readStringOption(options, 'runAt'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  testRun
    .command('result <name>')
    .description('Record a run result: passing | failing | skipped | pending (reopen)')
    .requiredOption('--status <status>', 'passing | failing | skipped | pending')
    .option('--note <text>', 'note for the run')
    .option('--run <id>', 'a specific run')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await testRunResultCommand({
        io,
        name,
        status: readStringOption(options, 'status') ?? '',
        note: readStringOption(options, 'note'),
        runId: readStringOption(options, 'run'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  testRun
    .command('delete <name>')
    .description('Delete a run')
    .requiredOption('--run <id>', 'the run to delete')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await testRunDeleteCommand({
        io,
        name,
        runId: readStringOption(options, 'run'),
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  test
    .command('available <name>')
    .description('List items available to attach to a run (defaults to the current run)')
    .requiredOption('--type <type>', 'item type: native_doc or check')
    .option('--run <id>', 'a specific run')
    .option('--search <text>', 'filter by item name')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await testAvailableItemsCommand({
        io,
        name,
        runId: readStringOption(options, 'run'),
        itemType: readStringOption(options, 'type') ?? 'native_doc',
        search: readStringOption(options, 'search'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  test
    .command('links <name>')
    .description('Show the controls and clauses a test covers')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await testLinksCommand({
        io,
        name,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  test
    .command('update <name>')
    .description('Change applicability, responsibility, assignee, frequency or auto-pass')
    .option('--applicability <value>', 'in_scope or out_of_scope')
    .option('--responsibility <value>', 'internal, third_party or shared')
    .option('--assigned-to <id>', 'owner user id')
    .option('--frequency <value>', 'none, monthly, quarterly, half-yearly or yearly')
    .option('--next-run-at <date>', 'ISO date for the next run')
    .option('--auto-pass <on|off>', 'auto-pass from checks')
    .option('--rename <text>', 'new name (custom tests only)')
    .option('--guidance <text>', 'new guidance (custom tests only)')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      const changes: Record<string, unknown> = {};
      for (const [flag, field] of [
        ['applicability', 'applicability'],
        ['responsibility', 'responsibility'],
        ['assignedTo', 'assignedTo'],
        ['frequency', 'frequency'],
        ['nextRunAt', 'nextRunAt'],
        ['rename', 'name'],
        ['guidance', 'guidance'],
      ] as const) {
        const value = readStringOption(options, flag);
        if (value !== undefined) changes[field] = value;
      }
      const autoPass = readStringOption(options, 'autoPass');
      if (autoPass !== undefined) changes.autoPassFromChecks = autoPass === 'on';
      await testUpdateCommand({
        io,
        name,
        changes,
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  test
    .command('delete <name>')
    .description('Delete a custom test')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await testDeleteCommand({
        io,
        name,
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  const framework = program.command('framework').description('Applied frameworks');

  framework
    .command('list')
    .description('List applied frameworks with status and available frameworks')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (options: unknown) => {
      await frameworkListCommand({
        io,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  framework
    .command('clauses <framework>')
    .description('List a framework’s clauses')
    .option('--search <text>', 'filter by clause code or name')
    .option('--applicability <value>', 'in_scope or out_of_scope')
    .option('--page <n>', 'page number')
    .option('--limit <n>', 'page size')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await frameworkClausesCommand({
        io,
        framework: name,
        search: readStringOption(options, 'search'),
        applicability: readStringOption(options, 'applicability'),
        page: readNumberOption(options, 'page'),
        limit: readNumberOption(options, 'limit'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  framework
    .command('clause <framework> <clause>')
    .description('Show one clause by code or name')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (frameworkName: string, clause: string, options: unknown) => {
      await clauseGetCommand({
        io,
        framework: frameworkName,
        clause,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  framework
    .command('items <framework> <clause>')
    .description('List the items mapped to a clause')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (frameworkName: string, clause: string, options: unknown) => {
      await clauseItemsCommand({
        io,
        framework: frameworkName,
        clause,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  framework
    .command('available <framework> <clause>')
    .description('List items that can be mapped to a clause')
    .requiredOption('--type <type>', 'item type: test or document')
    .option('--search <text>', 'filter by item name')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (frameworkName: string, clause: string, options: unknown) => {
      await clauseAvailableItemsCommand({
        io,
        framework: frameworkName,
        clause,
        itemType: readStringOption(options, 'type') ?? 'test',
        search: readStringOption(options, 'search'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  framework
    .command('update <framework> <clause>')
    .description('Change a clause’s applicability or design-requirement assessment')
    .option('--applicability <value>', 'in_scope or out_of_scope')
    .option('--justification <text>', 'why the applicability changed')
    .option('--design-requirements <state>', 'not_assessed | not_needed | not_met | partial | met')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (frameworkName: string, clause: string, options: unknown) => {
      const changes: Record<string, unknown> = {};
      for (const [flag, field] of [
        ['applicability', 'applicability'],
        ['justification', 'justification'],
        ['designRequirements', 'designRequirements'],
      ] as const) {
        const value = readStringOption(options, flag);
        if (value !== undefined) changes[field] = value;
      }
      await clauseUpdateCommand({
        io,
        framework: frameworkName,
        clause,
        changes,
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  framework
    .command('link <framework> <clause> <itemId>')
    .description('Map a test or document to a clause')
    .requiredOption('--type <type>', 'item type: test or document')
    .option('--unlink', 'unlink instead of link')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (frameworkName: string, clause: string, itemId: string, options: unknown) => {
      await clauseLinkCommand({
        io,
        framework: frameworkName,
        clause,
        itemId,
        itemType: readStringOption(options, 'type') ?? 'test',
        action: readBooleanOption(options, 'unlink') ? 'unlink' : 'link',
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  const asset = program.command('asset').description('The asset register');

  asset
    .command('list')
    .description('List assets with their code, status and classification')
    .option('--name <text>', 'filter by name')
    .option('--category <value>', 'filter by category')
    .option('--status <csv>', 'filter by status')
    .option('--business-impact <value>', 'filter by business impact')
    .option('--data-classification <value>', 'filter by data classification')
    .option('--page <n>', 'page number')
    .option('--limit <n>', 'page size')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (options: unknown) => {
      await assetListCommand({
        io,
        name: readStringOption(options, 'name'),
        category: readStringOption(options, 'category'),
        status: readStringOption(options, 'status'),
        businessImpact: readStringOption(options, 'businessImpact'),
        dataClassification: readStringOption(options, 'dataClassification'),
        page: readNumberOption(options, 'page'),
        limit: readNumberOption(options, 'limit'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  asset
    .command('get <asset>')
    .description('Show one asset by code, customer key or name')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await assetGetCommand({
        io,
        name,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  asset
    .command('links <asset>')
    .description('List the controls, risks, tests or checks mapped to an asset')
    .requiredOption('--type <type>', 'controls, risks, tests or checks')
    .option('--page <n>', 'page number')
    .option('--limit <n>', 'page size')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await assetLinksCommand({
        io,
        name,
        type: readStringOption(options, 'type') ?? 'controls',
        page: readNumberOption(options, 'page'),
        limit: readNumberOption(options, 'limit'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  asset
    .command('update <asset>')
    .description('Change asset fields')
    .option('--name <text>', 'rename')
    .option('--description <text>', 'description')
    .option('--category <value>', 'category')
    .option('--sub-category <value>', 'sub-category')
    .option('--status <value>', 'status')
    .option('--data-classification <value>', 'data classification')
    .option('--business-impact <value>', 'business impact')
    .option('--technical-owner <id>', 'technical owner user id')
    .option('--business-owner <value>', 'business owner')
    .option('--customer-asset-key <value>', 'the tenant\u2019s own key for this asset')
    .option('--external-ref <value>', 'external reference id')
    .option('--location <value>', 'location')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      const changes: Record<string, unknown> = {};
      for (const [flag, field] of [
        ['name', 'name'],
        ['description', 'description'],
        ['category', 'category'],
        ['subCategory', 'subCategory'],
        ['status', 'status'],
        ['dataClassification', 'dataClassification'],
        ['businessImpact', 'businessImpact'],
        ['technicalOwner', 'technicalOwner'],
        ['businessOwner', 'businessOwner'],
        ['customerAssetKey', 'customerAssetKey'],
        ['externalRef', 'externalRefId'],
        ['location', 'location'],
      ] as const) {
        const value = readStringOption(options, flag);
        if (value !== undefined) changes[field] = value;
      }
      await assetUpdateCommand({
        io,
        name,
        changes,
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  asset
    .command('create')
    .description('Create an asset')
    .requiredOption('--name <name>', 'asset name')
    .requiredOption('--category <value>', 'category')
    .requiredOption('--sub-category <value>', 'sub-category')
    .option('--customer-key <value>', 'the tenant\u2019s own key for this asset')
    .option('--external-ref <value>', 'external reference id')
    .option('--description <text>', 'description')
    .option('--status <value>', 'status')
    .option('--business-impact <value>', 'business impact')
    .option('--data-classification <value>', 'data classification')
    .option('--technical-owner <id>', 'technical owner user id')
    .option('--business-owner <value>', 'business owner')
    .option('--location <value>', 'location')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (options: unknown) => {
      await assetCreateCommand({
        io,
        name: readStringOption(options, 'name') ?? '',
        category: readStringOption(options, 'category') ?? '',
        subCategory: readStringOption(options, 'subCategory') ?? '',
        customerAssetKey: readStringOption(options, 'customerKey'),
        externalRefId: readStringOption(options, 'externalRef'),
        description: readStringOption(options, 'description'),
        status: readStringOption(options, 'status'),
        businessImpact: readStringOption(options, 'businessImpact'),
        dataClassification: readStringOption(options, 'dataClassification'),
        technicalOwner: readStringOption(options, 'technicalOwner'),
        businessOwner: readStringOption(options, 'businessOwner'),
        location: readStringOption(options, 'location'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  asset
    .command('delete <asset>')
    .description('Delete an asset')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await assetDeleteCommand({
        io,
        name,
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  asset
    .command('tags <asset>')
    .description('List an asset\u2019s tags')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await assetTagsCommand({
        io,
        name,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  asset
    .command('tag <asset>')
    .description('Assign a key/value tag to an asset, or remove one')
    .option('--key <key>', 'tag key')
    .option('--value <value>', 'tag value')
    .option('--unlink <mappingId>', 'tag mapping id to remove')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      const mappingId = readStringOption(options, 'unlink');
      const key = readStringOption(options, 'key');
      const value = readStringOption(options, 'value');
      if (!mappingId && (!key || !value)) {
        throw new Error('Provide --key and --value to assign, or --unlink <mappingId> to remove');
      }
      await assetTagCommand({
        io,
        name,
        key,
        value,
        mappingId,
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  const vendor = program.command('vendor').description('Manage vendors');

  vendor
    .command('list')
    .description('List vendors with a total count')
    .option('--name <text>', 'filter by name')
    .option('--criticality <value>', 'filter by criticality')
    .option('--relationship-status <value>', 'filter by relationship status')
    .option('--page <n>', 'page number')
    .option('--limit <n>', 'page size')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (options: unknown) => {
      await vendorListCommand({
        io,
        name: readStringOption(options, 'name'),
        criticality: readStringOption(options, 'criticality'),
        relationshipStatus: readStringOption(options, 'relationshipStatus'),
        page: readNumberOption(options, 'page'),
        limit: readNumberOption(options, 'limit'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  vendor
    .command('get <name>')
    .description('Show one vendor')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await vendorGetCommand({
        io,
        name,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  vendor
    .command('create')
    .description('Create a vendor')
    .requiredOption('--name <name>', 'vendor name')
    .option('--category <value>', 'category')
    .option('--criticality <value>', 'criticality')
    .option('--description <text>', 'description')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (options: unknown) => {
      await vendorCreateCommand({
        io,
        name: readStringOption(options, 'name') ?? '',
        category: readStringOption(options, 'category'),
        criticality: readStringOption(options, 'criticality'),
        description: readStringOption(options, 'description'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  vendor
    .command('update <name>')
    .description('Update vendor fields')
    .option('--name <value>', 'rename')
    .option('--website <value>', 'website')
    .option('--description <value>', 'description')
    .option('--category <value>', 'category')
    .option('--criticality <value>', 'business criticality')
    .option('--data-sensitivity <value>', 'public | internal | confidential | pii | phi')
    .option('--relationship-status <value>', 'active | inactive | onboarding | terminated')
    .option('--review-status <value>', 'pending | completed | expired')
    .option('--internal-owner <value>', 'internal owner (email)')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (vendorName: string, options: unknown) => {
      const changes: Record<string, string> = {};
      const fields = [
        'name',
        'website',
        'description',
        'category',
        'criticality',
        'dataSensitivity',
        'relationshipStatus',
        'reviewStatus',
        'internalOwner',
      ];
      for (const field of fields) {
        const value = readStringOption(options, field);
        if (value !== undefined) changes[field] = value;
      }
      await vendorUpdateCommand({
        io,
        name: vendorName,
        changes,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  vendor
    .command('delete <name>')
    .description('Delete a vendor')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await vendorDeleteCommand({
        io,
        name,
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  const control = program
    .command('control')
    .description('Controls: status, applicability, owner and design requirements');

  control
    .command('list')
    .description('List controls with their status, applicability and owner')
    .option('--search <text>', 'filter by name or code')
    .option('--domain <value>', 'filter by control domain')
    .option('--status <csv>', 'filter by status')
    .option('--applicability <value>', 'filter by applicability (in_scope|out_of_scope)')
    .option('--page <n>', 'page number')
    .option('--limit <n>', 'page size')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (options: unknown) => {
      await controlListCommand({
        io,
        search: readStringOption(options, 'search'),
        domain: readStringOption(options, 'domain'),
        status: readStringOption(options, 'status'),
        applicability: readStringOption(options, 'applicability'),
        page: readNumberOption(options, 'page'),
        limit: readNumberOption(options, 'limit'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  control
    .command('get <control>')
    .description('Show one control by name or code')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await controlGetCommand({
        io,
        name,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  control
    .command('items <control>')
    .description('List the items linked to a control')
    .option('--search <text>', 'filter by item name')
    .option('--page <n>', 'page number')
    .option('--limit <n>', 'page size')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await controlItemsCommand({
        io,
        name,
        search: readStringOption(options, 'search'),
        page: readNumberOption(options, 'page'),
        limit: readNumberOption(options, 'limit'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  control
    .command('available <control>')
    .description('List items that can be linked to a control')
    .requiredOption('--type <type>', 'item type: test or document')
    .option('--search <text>', 'filter by item name')
    .option('--page <n>', 'page number')
    .option('--limit <n>', 'page size')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await controlAvailableItemsCommand({
        io,
        name,
        itemType: readStringOption(options, 'type') ?? 'test',
        search: readStringOption(options, 'search'),
        page: readNumberOption(options, 'page'),
        limit: readNumberOption(options, 'limit'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  control
    .command('update <control>')
    .description('Change owner, applicability, design requirements or notes')
    .option('--owner <id|none>', 'owner user id, or none to clear')
    .option('--applicability <value>', 'in_scope or out_of_scope')
    .option('--justification <text>', 'why the applicability changed')
    .option('--design-requirements <state>', 'not_assessed | not_needed | not_met | partial | met')
    .option('--notes <text>', 'notes (Markdown)')
    .option('--rename <text>', 'new name (custom controls only)')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      const changes: Record<string, unknown> = {};
      const owner = readStringOption(options, 'owner');
      if (owner !== undefined) changes.ownerId = owner === 'none' ? null : owner;
      for (const [flag, field] of [
        ['applicability', 'applicability'],
        ['justification', 'justification'],
        ['designRequirements', 'designRequirements'],
        ['notes', 'notes'],
        ['rename', 'name'],
      ] as const) {
        const value = readStringOption(options, flag);
        if (value !== undefined) changes[field] = value;
      }
      await controlUpdateCommand({
        io,
        name,
        changes,
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  control
    .command('link <control> <itemId>')
    .description('Link a test or document to a control')
    .requiredOption('--type <type>', 'item type: test or document')
    .option('--unlink', 'unlink instead of link')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, itemId: string, options: unknown) => {
      await controlLinkCommand({
        io,
        name,
        itemId,
        itemType: readStringOption(options, 'type') ?? 'test',
        action: readBooleanOption(options, 'unlink') ? 'unlink' : 'link',
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  vendor
    .command('files <name>')
    .description('List the files attached to a vendor')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await vendorFilesCommand({
        io,
        name,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  vendor
    .command('attach <name>')
    .description('Attach a file to a vendor')
    .option('--file <path>', 'stage and attach a local file')
    .option('--upload <id>', 'attach an already-staged upload')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await vendorAttachCommand({
        io,
        name,
        file: readStringOption(options, 'file'),
        uploadId: readStringOption(options, 'upload'),
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  vendor
    .command('detach <name> <mappingId>')
    .description('Detach a file from a vendor by its mapping id')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, mappingId: string, options: unknown) => {
      await vendorDetachCommand({
        io,
        name,
        mappingId,
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  const document = program.command('document').description('Browse, read and change documents');

  document
    .command('list')
    .description('List documents with status and counts')
    .option('--name <text>', 'filter by name')
    .option('--status <csv>', 'filter by workflow status')
    .option('--page <n>', 'page number')
    .option('--limit <n>', 'page size')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (options: unknown) => {
      await policyListCommand({
        io,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
        name: readStringOption(options, 'name'),
        status: readStringOption(options, 'status'),
        page: readNumberOption(options, 'page'),
        limit: readNumberOption(options, 'limit'),
      });
    });

  document
    .command('get <document>')
    .description('Print a document as Markdown (by name or id)')
    .option('--version-number <n>', 'a specific version number')
    .option('--minor-number <n>', 'a specific minor version (with --version-number)')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (policyName: string, options: unknown) => {
      await policyGetCommand({
        io,
        policy: policyName,
        version: readNumberOption(options, 'versionNumber'),
        minor: readNumberOption(options, 'minorNumber'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  document
    .command('update <document>')
    .description('Update document metadata')
    .option('--name <value>', 'rename')
    .option('--description <value>', 'description')
    .option('--type <value>', 'document type')
    .option('--publish <on|off>', 'published state')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (policyName: string, options: unknown) => {
      const changes: Record<string, unknown> = {};
      const name = readStringOption(options, 'name');
      const description = readStringOption(options, 'description');
      const type = readStringOption(options, 'type');
      const publish = readStringOption(options, 'publish');
      if (name !== undefined) changes.name = name;
      if (description !== undefined) changes.description = description;
      if (type !== undefined) changes.type = type;
      if (publish !== undefined) changes.publish = publish === 'on' || publish === 'true';
      await policyUpdateMetaCommand({
        io,
        policy: policyName,
        changes,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  document
    .command('versions <document>')
    .description('Show a document\u2019s version history')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (policyName: string, options: unknown) => {
      await policyVersionsCommand({
        io,
        policy: policyName,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  document
    .command('create')
    .description('Create a new blank document')
    .requiredOption('--name <name>', 'policy name')
    .option('--type <type>', 'document type')
    .option('--description <text>', 'short description')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (options: unknown) => {
      await policyCreateCommand({
        io,
        name: readStringOption(options, 'name') ?? '',
        type: readStringOption(options, 'type'),
        description: readStringOption(options, 'description'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  document
    .command('edit <document>')
    .description('Replace the content of a draft document with Markdown')
    .option('--file <path>', 'read the new Markdown from a file')
    .option('--content <markdown>', 'new Markdown inline')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (policyName: string, options: unknown) => {
      await policyEditCommand({
        io,
        policy: policyName,
        file: readStringOption(options, 'file'),
        content: readStringOption(options, 'content'),
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  document
    .command('version <document>')
    .description('Create a new draft version of a document')
    .option('--change-type <type>', 'change type')
    .option('--summary <text>', 'change summary')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (policyName: string, options: unknown) => {
      await policyVersionCommand({
        io,
        policy: policyName,
        changeType: readStringOption(options, 'changeType'),
        summary: readStringOption(options, 'summary'),
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  document
    .command('submit <document>')
    .description('Submit a draft document for review')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (policyName: string, options: unknown) => {
      await policySubmitCommand({
        io,
        policy: policyName,
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  document
    .command('approve <document>')
    .description('Approve a document awaiting approval')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (policyName: string, options: unknown) => {
      await policyApproveCommand({
        io,
        policy: policyName,
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  document
    .command('delete <document>')
    .description('Delete a document')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (policyName: string, options: unknown) => {
      await policyDeleteCommand({
        io,
        policy: policyName,
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  const risk = program.command('risk').description('Manage risks');

  risk
    .command('list')
    .description('List the risk register')
    .option('--status <csv>', 'filter by status')
    .option('--business-unit <value>', 'filter by business unit')
    .option('--page <n>', 'page number')
    .option('--limit <n>', 'page size')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (options: unknown) => {
      await riskListCommand({
        io,
        status: readStringOption(options, 'status'),
        businessUnit: readStringOption(options, 'businessUnit'),
        page: readNumberOption(options, 'page'),
        limit: readNumberOption(options, 'limit'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  risk
    .command('get <risk>')
    .description('Show one risk by title or id')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (riskName: string, options: unknown) => {
      await riskGetCommand({
        io,
        risk: riskName,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  risk
    .command('update <risk>')
    .description('Update risk fields')
    .option('--status <value>', 'open | in_treatment | monitor | closed')
    .option('--title <value>', 'title')
    .option('--description <value>', 'description')
    .option('--owner <value>', 'owner')
    .option('--treatment-type <value>', 'treatment strategy')
    .option('--treatment-notes <text>', 'treatment notes (Markdown)')
    .option('--business-unit <value>', 'business unit')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (riskName: string, options: unknown) => {
      const changes: Record<string, string> = {};
      for (const field of [
        'status',
        'title',
        'description',
        'owner',
        'businessUnit',
        'treatmentType',
        'treatmentNotes',
      ]) {
        const value = readStringOption(options, field);
        if (value !== undefined) changes[field] = value;
      }
      await riskUpdateCommand({
        io,
        risk: riskName,
        changes,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  risk
    .command('create')
    .description('Create a risk')
    .requiredOption('--title <title>', 'risk title')
    .option('--category <value>', 'category')
    .option('--description <value>', 'description')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (options: unknown) => {
      await riskCreateCommand({
        io,
        title: readStringOption(options, 'title') ?? '',
        category: readStringOption(options, 'category'),
        description: readStringOption(options, 'description'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  risk
    .command('delete <risk>')
    .description('Delete a risk')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (riskName: string, options: unknown) => {
      await riskDeleteCommand({
        io,
        risk: riskName,
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  risk
    .command('treatment <risk>')
    .description('Show a risk’s treatment strategy and notes')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (risk: string, options: unknown) => {
      await riskTreatmentCommand({
        io,
        risk,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  risk
    .command('scores <risk>')
    .description('Show a risk’s scores')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (risk: string, options: unknown) => {
      await riskScoresCommand({
        io,
        risk,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  risk
    .command('controls <risk>')
    .description('List the controls linked to a risk')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (risk: string, options: unknown) => {
      await riskControlsCommand({
        io,
        risk,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  risk
    .command('link <risk>')
    .description('Link a control to a risk, or unlink a mapping')
    .option('--control <id>', 'control instance id to link')
    .option('--unlink <mappingId>', 'control mapping id to unlink')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (risk: string, options: unknown) => {
      const mappingId = readStringOption(options, 'unlink');
      await riskLinkControlCommand({
        io,
        risk,
        controlInstanceId: readStringOption(options, 'control'),
        mappingId,
        action: mappingId ? 'unlink' : 'link',
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  risk
    .command('files <risk>')
    .description('List the files attached to a risk')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (risk: string, options: unknown) => {
      await riskFilesCommand({
        io,
        risk,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  risk
    .command('attach <risk>')
    .description('Attach a file to a risk')
    .option('--file <path>', 'stage and attach a local file')
    .option('--upload <id>', 'attach an already-staged upload')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (risk: string, options: unknown) => {
      await riskAttachCommand({
        io,
        risk,
        file: readStringOption(options, 'file'),
        uploadId: readStringOption(options, 'upload'),
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  risk
    .command('detach <risk> <mappingId>')
    .description('Detach a file from a risk by its mapping id')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (risk: string, mappingId: string, options: unknown) => {
      await riskDetachCommand({
        io,
        risk,
        mappingId,
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  const check = program.command('check').description('Monitoring checks');

  check
    .command('list')
    .description('List monitoring checks')
    .option('--integration-type <csv>', 'filter by integration type')
    .option('--status <csv>', 'filter by status')
    .option('--page <n>', 'page number')
    .option('--limit <n>', 'page size')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (options: unknown) => {
      await checkListCommand({
        io,
        integrationType: readStringOption(options, 'integrationType'),
        status: readStringOption(options, 'status'),
        page: readNumberOption(options, 'page'),
        limit: readNumberOption(options, 'limit'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  check
    .command('resources <check>')
    .description('List the resources covered by a check')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (checkName: string, options: unknown) => {
      await checkResourcesCommand({
        io,
        check: checkName,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  check
    .command('run <check>')
    .description('Show a check\u2019s latest run')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (checkName: string, options: unknown) => {
      await checkRunCommand({
        io,
        check: checkName,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  check
    .command('integrations')
    .description('List check integration types')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (options: unknown) => {
      await checkIntegrationsCommand({
        io,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  check
    .command('runs <check>')
    .description('List a check’s run history')
    .option('--page <n>', 'page number')
    .option('--limit <n>', 'page size')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await checkRunsCommand({
        io,
        check: name,
        page: readNumberOption(options, 'page'),
        limit: readNumberOption(options, 'limit'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  check
    .command('findings <check>')
    .description('List the findings raised from a check')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await checkFindingsCommand({
        io,
        check: name,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  check
    .command('enable <check>')
    .description('Enable a check for this tenant')
    .option('--notes <text>', 'why')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await checkSetEnabledCommand({
        io,
        check: name,
        enabled: true,
        notes: readStringOption(options, 'notes'),
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  check
    .command('disable <check>')
    .description('Disable a check for this tenant')
    .option('--notes <text>', 'why')
    .option('--yes', 'apply without prompting')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (name: string, options: unknown) => {
      await checkSetEnabledCommand({
        io,
        check: name,
        enabled: false,
        notes: readStringOption(options, 'notes'),
        yes: readBooleanOption(options, 'yes'),
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  const job = program.command('job').description('Check background jobs started by other commands');

  job
    .command('status <jobId>')
    .description('Show the status of a background job')
    .option('--api-url <url>', 'API base URL')
    .option('--json', 'output raw JSON')
    .action(async (jobId: string, options: unknown) => {
      await jobStatusCommand({
        io,
        jobId,
        apiUrl: readStringOption(options, 'apiUrl'),
        json: readBooleanOption(options, 'json'),
      });
    });

  // A bare `ciphrix` shows the banner and help; commands never print the banner.
  program.action(() => {
    writeBlock(io.stdout, `${formatBanner(io.theme)}\n\n`);
    program.outputHelp();
  });

  return program;
};

/**
 * Runs the CLI and resolves to a process exit code. `--help`/`--version` and
 * usage errors are handled by commander and mapped to their exit codes.
 */
export const main = async (
  argv: readonly string[] = process.argv,
  io: CliIO = createDefaultIO(),
): Promise<number> => {
  const program = createProgram(io);

  program.exitOverride();
  program.configureOutput({
    writeOut: (text) => io.stdout.write(text),
    writeErr: (text) => io.stderr.write(text),
  });

  try {
    await program.parseAsync([...argv]);
    return 0;
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode;
    }
    const message = error instanceof Error ? error.message : String(error);
    writeLine(io.stderr, `${io.theme.red('error')} ${message}`);
    return 1;
  } finally {
    setCliInsecureHttpOptIn(false);
  }
};
