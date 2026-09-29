import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { format } from 'prettier';
import { CONFIGURATION_HELP, createProgram } from '../dist/cli.js';

const outputPath = resolve('skills/ciphrix/references/commands.md');
const checkOnly = process.argv.includes('--check');

const effectNotes = {
  login:
    'Starts device authorization and stores the credential after sign-in succeeds; opens the verification link by default unless --no-open is supplied.',
  logout:
    'Revokes the remote session before removing the stored credential; use --local-only to remove the local credential without remote revocation.',
  'context set':
    'Changes a Business or Operating Context answer through the direct API write path.',
  'context reset':
    'Resets Business Context. The CLI asks for confirmation when required; --yes skips that prompt.',
  'test attach':
    'Attaches or unlinks evidence. A local --file is uploaded and attached in the same command; the command can return a background job id.',
  'test update': 'Changes test settings; the CLI asks for confirmation when required.',
  'test delete': 'Deletes a custom test; the CLI asks for confirmation when required.',
  'test run create':
    'Creates a pending test run; the CLI prompts if the API requests confirmation.',
  'test run result':
    'Records a formal test-run result; the CLI prompts if the API requests confirmation.',
  'test run delete': 'Deletes the selected test run; the CLI asks for confirmation when required.',
  'framework update': 'Changes a clause assessment; the CLI asks for confirmation when required.',
  'framework link':
    'Links or unlinks a test or document to a clause; the CLI asks for confirmation when required.',
  'control update': 'Changes control fields; the CLI asks for confirmation when required.',
  'control link':
    'Links or unlinks a test or document to a control; the CLI asks for confirmation when required.',
  'asset update': 'Changes asset fields; the CLI asks for confirmation when required.',
  'asset create': 'Creates an asset; the CLI prompts if the API requests confirmation.',
  'asset delete': 'Deletes an asset; the CLI asks for confirmation when required.',
  'asset tag': 'Adds or removes an asset tag; the CLI asks for confirmation when required.',
  'vendor create': 'Creates a vendor; the CLI prompts if the API requests confirmation.',
  'vendor update': 'Changes vendor fields; the CLI prompts if the API requests confirmation.',
  'vendor delete': 'Deletes a vendor; the CLI asks for confirmation when required.',
  'vendor attach': 'Attaches a staged or local file; the CLI asks for confirmation when required.',
  'vendor detach': 'Detaches a file; the CLI asks for confirmation when required.',
  'risk update': 'Changes risk fields; the CLI prompts if the API requests confirmation.',
  'risk create': 'Creates a risk; the CLI prompts if the API requests confirmation.',
  'risk delete': 'Deletes a risk; the CLI asks for confirmation when required.',
  'risk link': 'Links or unlinks a control to a risk; the CLI asks for confirmation when required.',
  'risk attach': 'Attaches a staged or local file; the CLI asks for confirmation when required.',
  'risk detach': 'Detaches a file; the CLI asks for confirmation when required.',
  'check enable':
    'Enables a monitoring check for this tenant; the CLI asks for confirmation when required.',
  'check disable':
    'Disables a monitoring check for this tenant; the CLI asks for confirmation when required.',
  'check run': 'Read-only: shows the latest run for a monitoring check.',
  'document update': 'Changes document metadata; the CLI prompts if the API requests confirmation.',
  'document create': 'Creates a blank document; the CLI prompts if the API requests confirmation.',
  'document edit': 'Replaces draft document content; the CLI asks for confirmation when required.',
  'document version': 'Creates a new draft version; the CLI asks for confirmation when required.',
  'document submit': 'Submits a draft for review; the CLI asks for confirmation when required.',
  'document approve':
    'Records a formal document approval; the CLI asks for confirmation when required.',
  'document delete': 'Deletes a document; the CLI asks for confirmation when required.',
};

const program = createProgram();

const lines = [
  '# Ciphrix CLI command reference',
  '',
  '> Generated from the Commander command tree and help output. Regenerate with `npm run commands:generate`; CI checks for drift with `npm run commands:check`.',
  '>',
  '> Live `ciphrix --help` and `ciphrix <command> --help` output is authoritative for the installed version.',
  '',
  'The sections below are captured from the CLI help implementation. Positional arguments in `<angle brackets>` are required; `[square brackets]` are optional. `Options` lists flags accepted by that command. Commander defaults are shown when defined in the command tree; descriptions also call out defaults that are part of the public interface.',
  '',
  '## `ciphrix`',
  '',
  '```text',
  `${program.helpInformation().trimEnd()}${CONFIGURATION_HELP}`.trimEnd(),
  '```',
  '',
];

const walk = (command, parents = []) => {
  for (const child of command.commands) {
    const path = [...parents, child.name()].join(' ');
    lines.push(
      `## \`ciphrix ${path}\``,
      '',
      '```text',
      child.helpInformation().trimEnd(),
      '```',
      '',
    );
    const hasYesOption = child.options.some((option) => option.attributeName() === 'yes');
    const note =
      effectNotes[path] ||
      (hasYesOption
        ? 'This operation may request confirmation based on the server response; --yes skips the interactive prompt when one is requested.'
        : undefined);
    if (note) lines.push(`**Effect:** ${note}`, '');

    const defaults = child.options
      .filter((option) => option.defaultValue !== undefined)
      .map((option) => `\`${option.attributeName()}\`: \`${String(option.defaultValue)}\``);
    if (defaults.length) lines.push(`**Commander defaults:** ${defaults.join(', ')}.`, '');
    walk(child, [...parents, child.name()]);
  }
};

walk(program);

const expectedEffectPaths = [
  'login',
  'logout',
  'context set',
  'context reset',
  'test attach',
  'test run create',
  'test run result',
  'test run delete',
  'test update',
  'test delete',
  'framework update',
  'framework link',
  'control update',
  'control link',
  'asset update',
  'asset create',
  'asset delete',
  'asset tag',
  'vendor create',
  'vendor update',
  'vendor delete',
  'vendor attach',
  'vendor detach',
  'risk update',
  'risk create',
  'risk delete',
  'risk link',
  'risk attach',
  'risk detach',
  'check enable',
  'check disable',
  'document update',
  'document create',
  'document edit',
  'document version',
  'document submit',
  'document approve',
  'document delete',
];
const commandPaths = new Set();
const collectPaths = (command, parents = []) => {
  for (const child of command.commands) {
    const pathParts = [...parents, child.name()];
    commandPaths.add(pathParts.join(' '));
    collectPaths(child, pathParts);
  }
};
collectPaths(program);
for (const path of expectedEffectPaths) {
  if (!Object.hasOwn(effectNotes, path) || !commandPaths.has(path)) {
    throw new Error(`Missing command effect mapping or command: ${path}`);
  }
}

lines.push(
  '## Behavioral defaults',
  '',
  '- API URL selection uses `--api-url`, then `CIPHRIX_API_URL`, then the production API default. API URLs must use HTTPS unless plaintext HTTP is explicitly enabled with `--allow-insecure-http` or `CIPHRIX_ALLOW_INSECURE_HTTP=true`.',
  '- Credentials use the operating system keychain by default. File-based credential storage requires the explicit `CIPHRIX_CREDENTIAL_STORE=file` opt-in.',
  '- Commands that accept `--page` or `--limit` use the server/API pagination defaults when omitted.',
  '- Commands whose help says they use the current run use that run when `--run` is omitted; `test run create` defaults its date to now.',
  '',
);

lines.push(
  '## Safe examples',
  '',
  '```sh',
  'ciphrix --help',
  'ciphrix login --api-url https://api.example.com',
  "ciphrix document get 'Example Policy'",
  'ciphrix test list --page 1 --limit 25',
  "ciphrix asset get '<asset-code>'",
  '```',
  '',
  'Examples use generic values. Replace placeholders with values from the authenticated tenant; never guess identifiers. Use `--yes` only after the user authorized that specific change. It bypasses an interactive confirmation prompt when one is requested; it does not grant access or override API authorization.',
  '',
);

const content = await format(`${lines.join('\n')}\n`, { parser: 'markdown' });

if (checkOnly) {
  let existing;
  try {
    existing = await readFile(outputPath, 'utf8');
  } catch {
    console.error(`Command reference is missing: ${outputPath}`);
    process.exitCode = 1;
  }
  if (existing !== undefined && existing !== content) {
    console.error(
      'Command reference is out of date. Run npm run commands:generate and commit the result.',
    );
    process.exitCode = 1;
  }
} else {
  await mkdir(resolve('skills/ciphrix/references'), { recursive: true });
  await writeFile(outputPath, content);
}
