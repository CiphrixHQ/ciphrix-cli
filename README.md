# Ciphrix CLI

The official command-line interface for the [Ciphrix](https://ciphrix.com) compliance platform.

`ciphrix` lets you read and act on your compliance data from a terminal or an agent workspace: sign in
with your Ciphrix account, read a document as Markdown, attach evidence to a test, and update an asset or
a risk.

> **Status: pre-release (0.1.0).** The command surface is being built module by module.

## Requirements

- Node.js 20.19 or newer (see `.nvmrc` for the recommended version).

## Install

```bash
npm install --global @ciphrix/cli
# or run without installing
npx @ciphrix/cli --help
```

## Quickstart

```bash
# Sign in with device authorization — opens the verification link and prints it with the code
ciphrix login

# For headless or agent use, print the link without opening a browser
ciphrix login --no-open

# See what documents exist, then read one as Markdown
ciphrix document list
ciphrix document get "Access Control Policy"

# What a test covers, and what it is measured against
ciphrix test links "MFA enforced"

# Record a result (a formal decision)
ciphrix test run result "MFA enforced" --status passing --note "rolled out org-wide"
```

## Commands

Every resource is addressed by a **name or a stable code** (for example `ACME-DOC-A1B2`), never a UUID.
Run `ciphrix <resource> --help` for the verbs of a resource, and `ciphrix <resource> <verb> --help` for the
flags of one command.

The complete generated command reference, including options and write-behavior notes, is available at
[`skills/ciphrix/references/commands.md`](skills/ciphrix/references/commands.md). The live help output of
the installed version remains authoritative.

| Command                                                                                     | Description                                                                                                             |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `ciphrix login [url]`                                                                       | Sign in with device authorization; opens the link by default (`--no-open` skips it). `--device-name` labels the device. |
| `ciphrix logout`                                                                            | Revoke the remote session, then remove the stored credential. `--local-only` removes only the local credential.         |
| `ciphrix context get <business\|operating>` · `context status`                              | A context digest as Markdown; completion and unanswered questions.                                                      |
| `ciphrix context set <question> <value>` · `context reset`                                  | Answer one question; reset the Business context (asks to confirm).                                                      |
| `ciphrix document list` · `get` · `versions`                                                | The **Document Library**: list, read as Markdown, version history.                                                      |
| `ciphrix document update` · `edit` · `version` · `submit` · `approve` · `create` · `delete` | Change metadata or content, open a new version, move it through review, create or delete.                               |
| `ciphrix test list` · `get` · `runs` · `items`                                              | Tests, their runs, and the items attached to a run.                                                                     |
| `ciphrix test available` · `links`                                                          | Items available to attach; the controls and clauses a test covers.                                                      |
| `ciphrix test attach` · `update` · `delete`                                                 | Attach evidence (returns a job id), change ownership or frequency, delete a custom test.                                |
| `ciphrix test run create` · `run result` · `run delete`                                     | Create a run, record a result (a formal decision), delete a run.                                                        |
| `ciphrix framework list`                                                                    | Applied frameworks, plus what is available to add.                                                                      |
| `ciphrix framework clauses` · `clause` · `items` · `available`                              | A framework's clauses, one clause, and its items.                                                                       |
| `ciphrix framework update` · `link`                                                         | Clause applicability and design requirements; map a test or document to a clause.                                       |
| `ciphrix control list` · `get` · `items` · `available`                                      | Controls with status, applicability and owner; one control; what is mapped to it.                                       |
| `ciphrix control update` · `link`                                                           | Owner, applicability, design requirements and notes; map a test or document.                                            |
| `ciphrix asset list` · `get` · `create` · `update` · `delete`                               | The asset register.                                                                                                     |
| `ciphrix asset links` · `tags` · `tag`                                                      | What an asset is mapped to; its key/value tags.                                                                         |
| `ciphrix vendor list` · `get` · `create` · `update` · `delete`                              | The vendor register.                                                                                                    |
| `ciphrix vendor files` · `attach` · `detach`                                                | Files attached to a vendor.                                                                                             |
| `ciphrix risk list` · `get` · `create` · `update` · `delete`                                | The risk register.                                                                                                      |
| `ciphrix risk treatment` · `scores` · `controls` · `link` · `files` · `attach` · `detach`   | Treatment, scores, linked controls and files.                                                                           |
| `ciphrix check list` · `resources` · `run` · `runs` · `findings` · `integrations`           | Monitoring checks, their runs and findings.                                                                             |
| `ciphrix check enable` · `disable`                                                          | Turn a check on or off for this tenant.                                                                                 |
| `ciphrix job status <jobId>`                                                                | Check a background job started by another command (for example an evidence attachment).                                 |

Writes that change something a person should look at — deleting, linking, editing content, and changes
to a control, clause, test or asset — show the proposed change and ask you to confirm. Add `--yes` to skip
the prompt in a script. Plain field updates (`risk update`, `vendor update`, `document update`) apply
directly.

Add `--json` to any command for machine-readable output. Decoration never appears in JSON output.

## For agents

The Ciphrix **skill** lives at [`skills/ciphrix/SKILL.md`](skills/ciphrix/SKILL.md). It is a short operating
guide for an agent driving the CLI: the platform's domain model, operating principles, authority boundaries
and reliable work patterns. It deliberately does not restate the complete command surface —
`ciphrix --help` is always current, while a skill explains how to reason about the work.

Install it with the open [Skills CLI](https://skills.sh/docs/cli) after this repository is public:

```bash
# Interactive: select the detected agents and installation scope
npx skills add CiphrixHQ/ciphrix-cli --skill ciphrix

# Install globally for specific agents
npx skills add CiphrixHQ/ciphrix-cli --skill ciphrix -g -a codex -a claude-code -a cursor

# Install globally for every supported agent detected by the Skills CLI
npx skills add CiphrixHQ/ciphrix-cli --skill ciphrix -g --agent '*'
```

Installing the executable and installing the skill are intentionally separate. The npm package provides
the `ciphrix` command; the skill teaches Codex, Claude Code, Cursor and other compatible agents how to use
that command responsibly. The npm installer never modifies agent configuration directories.

## Configuration

The CLI does not read a general configuration file. API selection uses the first value available in
this order: a command's `--api-url`, `CIPHRIX_API_URL`, then the built-in production default. The API
base includes its public API prefix; the CLI appends its versioned authentication and `/tools/v1` paths.
Credentials are stored separately for each API base, so signing into a local or non-production environment
does not replace the production credential.

- `CIPHRIX_API_URL` — API base URL. Defaults to the production API; pass `--api-url` (or
  `ciphrix login <url>`) to target another environment.
- API URLs must use HTTPS. For intentional local or non-production testing against a plaintext HTTP
  endpoint, explicitly pass `--allow-insecure-http` (it works before or after the command) or set
  `CIPHRIX_ALLOW_INSECURE_HTTP=true`. This opt-in applies to the whole CLI invocation and permits
  sending credentials and data without transport encryption; use it only on a trusted local network.
  Any HTTP endpoint can be selected while opted in. URL user information, query strings, fragments,
  and schemes other than HTTP(S) are rejected. Redirects are never followed for API requests or uploads;
  configure the final endpoint directly.
- `CIPHRIX_CREDENTIAL_STORE=file` — explicitly use a local file credential store for headless or
  non-production testing. The file is stored in the CLI configuration directory with `0600`
  permissions inside a `0700` directory. It contains plaintext credentials; use the OS keychain
  default for normal use. If the keychain is unavailable, the CLI reports an error instead of
  silently saving credentials to a file.
- `ciphrix logout --local-only` — remove the credential from this device without contacting the API.
  The remote session remains active; revoke it separately in account session settings. If remote
  revocation fails for a transient reason, `logout` keeps the local credential so you can retry, or
  you can explicitly choose `--local-only`.
- API calls time out after 30 seconds and response bodies are limited to 10 MiB. Local evidence
  uploads must be regular files (not symbolic links or special files) and may be at most 50 MiB.
- `NO_COLOR` / `FORCE_COLOR` — standard colour controls. Output is never coloured when piped.

## Security

Please do not report security issues in public. See [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md). The repository follows a trunk-based
workflow: `main` is always releasable, and every change lands through a short-lived pull request.

## License

[Apache-2.0](LICENSE).
