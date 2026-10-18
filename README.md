<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/logo_dark_mode.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/brand/logo_light_mode.svg">
    <img alt="Ciphrix" src="assets/brand/logo_light_mode.svg" width="360">
  </picture>
</p>

<h1 align="center">Ciphrix CLI</h1>

<p align="center">
  Compliance work, wherever you and your agents work.
</p>

The official command-line interface for the [Ciphrix](https://ciphrix.com) compliance platform.
Use Ciphrix from your terminal, scripts, and agent workspaces to understand compliance context, work with
policies and evidence, run tests, and manage frameworks, controls, assets, vendors, risks, and monitoring.

## Install

Requires Node.js 20.19 or newer.

```bash
npm install --global @ciphrix/cli
ciphrix login
```

Or run a command without installing:

```bash
npx @ciphrix/cli --help
```

Update an existing global installation with `npm install --global @ciphrix/cli@latest`.

`ciphrix login` opens the Ciphrix authorization page in your browser and prints the same link and device
code in the terminal. Your password is never entered into the CLI.

<p align="center">
  <img alt="Ciphrix CLI help and document library" src="assets/readme/ciphrix-cli.jpg" width="824">
</p>

## From question to evidence

```bash
# Understand the organisation before changing anything
ciphrix context get business

# Find a policy and read it as Markdown
ciphrix document list
ciphrix document get "Access Control Policy"

# See what a test covers and inspect its history
ciphrix test links "MFA enforced"
ciphrix test runs "MFA enforced"

# Record a formal result
ciphrix test run result "MFA enforced" \
  --status passing \
  --note "Rolled out organisation-wide"
```

Add `--json` to any command for stable machine-readable output. Commands that perform consequential
changes show the proposed action and ask for confirmation; automation can opt in with `--yes`.

## One interface for compliance work

- **Understand the business** — read Business and Operating Context before proposing or changing controls.
- **Work with policies** — find documents, read Markdown, manage versions, and move work through review.
- **Connect evidence to assurance** — inspect tests and runs, attach evidence, and record formal results.
- **Navigate the compliance model** — trace frameworks, clauses, controls, tests, documents, and assets.
- **Manage operational registers** — work with assets, vendors, risks, treatments, ownership, and files.
- **Operate monitoring** — inspect checks, resources, runs, findings, integrations, and background jobs.

Established record commands accept names and stable Ciphrix codes where advertised. Access inventory,
review tasks and proposals require the exact IDs returned by their read commands; never guess identifiers.

## Built for agent workspaces

Ciphrix ships an agent skill as well as a CLI. The CLI provides the tools; the skill teaches an agent the
Ciphrix domain model, operating principles, authority boundaries, and reliable workflows.

Install the skill with the open [Skills CLI](https://skills.sh/docs/cli):

```bash
# Choose detected agents and installation scope interactively
npx skills add CiphrixHQ/ciphrix-cli --skill ciphrix

# Or install globally for selected agents
npx skills add CiphrixHQ/ciphrix-cli --skill ciphrix \
  -g \
  -a codex \
  -a claude-code \
  -a cursor \
  -a opencode
```

The skill works with compatible agent harnesses including Codex, Claude Code, Cursor, and OpenCode. It
is also included in the npm package at [`skills/ciphrix/SKILL.md`](skills/ciphrix/SKILL.md). Installing
the npm package never modifies an agent's configuration directories.

Run `npx skills update` to update installed skills when a newer version is available. Keep the skill
aligned with your installed CLI version; its generated command reference and local help describe the
available grammar. Server capability discovery remains authoritative for which operations you can use.

### Ask in natural language, operate through the CLI

An agent can translate a request into a Ciphrix command, inspect the structured result, and present the
answer in the workspace where the user is already working.

<p align="center">
  <img alt="An agent uses Ciphrix CLI to inspect the vendor register" src="assets/readme/pi-harness-1.jpg" width="960">
</p>

### Work with evidence from ChatGPT

The same command surface supports multi-step compliance work: inspect a run, reopen it, attach evidence,
return it to its intended state, and explain the resulting evidence assessment.

<table>
  <tr>
    <td width="50%" align="center">
      <img alt="Reopen a compliance test run and attach evidence from ChatGPT" src="assets/readme/chatgpt-2.jpg">
    </td>
    <td width="50%" align="center">
      <img alt="Review the updated run and evidence relevance in ChatGPT" src="assets/readme/chatgpt-1.jpg">
    </td>
  </tr>
  <tr>
    <td align="center"><sub>Reopen the run and attach new evidence</sub></td>
    <td align="center"><sub>Confirm the result and understand evidence relevance</sub></td>
  </tr>
</table>

## Command surface

Run `ciphrix <resource> --help` for its actions and `ciphrix <resource> <action> --help` for the flags of
one command. Installed help is authoritative. The complete generated reference is available at
[`skills/ciphrix/references/commands.md`](skills/ciphrix/references/commands.md) and checked for drift in CI.

<details>
<summary>Browse the command groups</summary>

| Command                                            | What it does                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| `ciphrix login` · `logout`                         | Authorize this device or revoke its session.                                   |
| `ciphrix context get` · `status` · `set` · `reset` | Read and maintain Business and Operating Context.                              |
| `ciphrix document …`                               | Browse, read, create, edit, version, submit, approve, and delete documents.    |
| `ciphrix test …`                                   | Inspect tests, links, runs and evidence; attach items and record results.      |
| `ciphrix framework …`                              | Browse applied frameworks and work with clauses and mappings.                  |
| `ciphrix control …`                                | Inspect controls, ownership, applicability, design requirements, and mappings. |
| `ciphrix asset …`                                  | Maintain the asset register, mappings, and tags.                               |
| `ciphrix vendor …`                                 | Maintain vendors and their attached files.                                     |
| `ciphrix risk …`                                   | Maintain risks, treatment, scores, controls, and files.                        |
| `ciphrix check …`                                  | Operate monitoring checks, resources, runs, findings, and integrations.        |
| `ciphrix job status <jobId>`                       | Follow background work started by another command.                             |

</details>

### Context, reviews and agent-assisted work

The onboarding group reads separate Business and Operating Context, saves agreed questionnaire answers,
and offers explicit optional setup and completion. Business Context readiness is decided by the server;
Operating Context and optional setup do not block journey completion. Saving context never automatically
starts agents or completes the journey. Local `--help` works offline; `onboarding --help-onboarding`
returns authenticated server guidance and the current status pack.

The access group separates inventory, reviewed import proposals, assigned reviewer decisions and campaign
results. A revoke decision records a removal request, not provider-side revocation. Recording decisions,
completing a reviewer task, and ending a campaign are separate operations. Imports merge only explicitly
selected reviewed rows; inspect per-row failures even when some rows applied.

Agent findings and advisory test/control assessments do not make formal human decisions. Assigned-task
discovery does not complete work. File staging and processing are explicit, separate operations; processing
may update context or create vendors. Evidence/CSV commands return expiring signed references without
automatically downloading files. Use each command's help for the exact inputs, next reads and effects.

### Manifest compatibility, JSON and retries

The CLI discovers allowed tools and their effects from the authenticated server manifest. New command
groups require server-declared command bindings. An unavailable binding is reported as unsupported;
the CLI never guesses a different endpoint or interprets the manifest as authorization. Existing
commands keep their successful JSON formats. New capability commands emit complete success/error
envelopes with `--json`, preserving warnings, pagination, truncation and structured error details.
Failures and partially applied mutations return a nonzero exit status.

Confirmed writes require explicit consent. New commands in JSON/non-interactive mode require `--yes`
for confirmed operations; immediate writes do not accept that flag. Write controls are rejected for
reads. The optional `--idempotency-key` names one logical write: reuse identical input for a retry,
never a new key to bypass an unknown outcome. There are no automatic write retries. Confirmed replay
also needs a valid confirmation token; a fresh invocation re-preflights and may be blocked by changed
state or expiry. The CLI does not save confirmation tokens or promise recovery across invocations.
Inspect current records/jobs when uncertain. Replayed status packs and signed URLs are original
snapshots, not refreshed state or renewed downloads.

Mutation JSON files must be regular files, at most 1 MiB, containing an explicitly selected array.
Use clear flags or JSON null where supported, not the string `"null"`. Do not infer confirmations
from suggested matches. New repeated flags collect separate values; existing command conventions remain
compatible. See the generated command reference for all options and nested payload details.

## Safe by default

- Credentials use the operating system keychain by default and are isolated by API environment.
- Device authorization keeps passwords out of the terminal and CLI process.
- API traffic requires HTTPS unless insecure HTTP is explicitly enabled for local testing.
- Redirects are not followed for API calls or uploads.
- Destructive and consequential actions require confirmation unless `--yes` is explicitly supplied.
- JSON output is undecorated and suitable for programs and agents.
- Requests time out, responses are size-limited, and local evidence uploads reject symbolic links and
  files over 25 MiB.

Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Non-production and advanced configuration

The CLI does not use a general configuration file. An API base is selected in this order:

1. The command's `--api-url` option.
2. `CIPHRIX_API_URL`.
3. The built-in production API.

Credentials are stored separately for each API base, so local or test authentication does not replace
the production credential.

| Setting                                                      | Purpose                                                                                                                                       |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `--api-url <url>` / `CIPHRIX_API_URL`                        | Use a different API base, including its public API prefix.                                                                                    |
| `--allow-insecure-http` / `CIPHRIX_ALLOW_INSECURE_HTTP=true` | Explicitly permit HTTP for trusted local testing. Never use it across an untrusted network.                                                   |
| `CIPHRIX_CREDENTIAL_STORE=file`                              | Use a permission-restricted plaintext credential file for intentional headless or test environments. The keychain remains the normal default. |
| `ciphrix login --no-open`                                    | Print the authorization link without opening a browser.                                                                                       |
| `ciphrix logout --local-only`                                | Remove only this device's stored credential without contacting the API.                                                                       |
| `NO_COLOR` / `FORCE_COLOR`                                   | Apply standard terminal colour controls. Piped output is never coloured.                                                                      |

API URLs containing user information, query strings, or fragments are rejected. If remote logout fails,
the local credential is retained so revocation can be retried; `--local-only` is always an explicit choice.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md). `main` is always releasable, and every
change lands through a short-lived pull request with required review and automated checks.

## License

[Apache-2.0](LICENSE)
