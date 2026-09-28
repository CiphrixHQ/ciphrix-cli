# AGENTS.md — ciphrix-cli

## Project

Public command-line interface for the Ciphrix compliance platform. TypeScript (strict, ESM) on Node
20.19+, `commander` for commands, `vitest` for tests. The CLI is a thin client over the Ciphrix tool
surface (`GET /api/tools/v1` manifest, `POST /api/tools/v1/:name`); it holds no business logic.

## Authorization Is Not Yours To Touch

- The CLI holds no authorization logic. It sends authenticated requests and renders whatever the API returns, including honest `403`/`not_found` results. Never reimplement roles, scopes, or permission checks here.
- Never ask the API team to relax auth, CSRF, or authorization middleware on an existing route to make a CLI flow work. New capabilities use the `/api/tools` surface.

## Public repository and release hygiene

Treat every commit, ref, package file, workflow log, and release artifact as public forever. This rule
also applies to information that is not technically a credential but reveals how private environments
are operated. If a value or procedure is only useful inside company infrastructure, keep it out of
this repository. When in doubt, leave it out and ask.

### Never include

- Internal or development hostnames, URLs, ports, IP addresses, VPN/proxy routes, or environment names.
- Tenant, customer, account or user identifiers; any real customer data.
- Secrets, tokens, API keys, passwords, certificates, or `.env` values.
- Infrastructure, database, deployment, container, or recovery commands; connection strings; bucket,
  queue, cluster, project, tenant, or service names; private DNS conventions; network topology; and
  logs or screenshots copied from an internal system.
- Internal operating procedures, incident/debugging notes, support workarounds, local test runbooks,
  credentials/bootstrap instructions, account-specific behavior, or implementation details that expose
  how private environments or services are administered.
- Internal service, vendor or repository names tied to our infrastructure, and links to private repos,
  tickets, dashboards, or documentation.
- Screenshots or captured output that contain any of the above.
- Internal working assumptions or knowledge that would help someone map, access, or operate private
  company systems, even when no hostname or secret is present.

### Always

- Use generic examples only: `https://api.example.com`, `<policy-id>`, `<your-token>`.
- Configure the environment through `--api-url` / `CIPHRIX_API_URL`; never hardcode one.
- Require HTTPS for API URLs by default. Keep `--allow-insecure-http` and
  `CIPHRIX_ALLOW_INSECURE_HTTP=true` as explicit, documented opt-ins for local/non-production HTTP
  testing. Validate the URL before resolving identity or credentials, reject userinfo/query/fragment
  and non-HTTP(S) schemes, and never follow redirects on authenticated requests or uploads.
- Development and audit scripts must not default to internal, development, loopback, or private-network
  endpoints. Require an explicit `--api-url` / environment value; use a generic placeholder only in
  documentation, never as a working credentialed endpoint.
- Keep manual end-to-end steps, runbooks and internal test data out of this repo — they live in the
  private workspace.
- Before committing, inspect the full diff and scan the current working tree for internal markers and
  secret-shaped values. Before a repository is made public, scan every reachable commit and ref, not
  only the tip or the changeset. Use the configured secret scanner for the complete Git history and
  manually review hostnames, URLs, ports, environment names, private-network addresses, and operational
  details that secret scanners do not recognize. Never print detected credential values in reports or
  CI logs. A clean current tree does not make a dirty history safe.
- Before publishing, build from a clean generated-output directory, inspect the full file list and
  contents produced by `npm pack --dry-run`, and verify there are no stale/generated files, local
  configuration, source maps, fixtures, or internal notes outside the intended package allowlist.
- Do not make the repository public or publish the npm package until the release gate below passes.

### Pre-publication gate

All items are required before changing repository visibility or publishing a release:

1. Fetch and inventory all branches and tags. Audit the current tree and every commit reachable from
   every ref for internal operational knowledge, internal/development endpoints and secret-shaped
   material. Scan the complete Git history with the configured secret scanner; review scanner output
   without exposing secret values.
2. Remove every finding from the current tree. If any reachable history contains internal information,
   stop publication until the authorized history cleanup has completed and the resulting reachable refs
   have been scanned again. Do not assume deleting a file or branch locally removes hosted copies,
   pull-request refs, forks, caches, or prior package artifacts.
3. Run formatting, lint, type checking, tests and build. Build after clearing stale generated output, then
   inspect the npm dry-run manifest and unpacked package contents against the intended package allowlist.
4. Recheck all reachable local and remote refs and package contents after the final edits. If a ref,
   package file, scanner result, or hosted copy cannot be inspected or controlled, stop and resolve that
   gap before making the repository public or publishing.

## Architecture rules

- No business logic. No direct domain persistence. Delegate to the HTTP tool surface.
- Never import or copy API/backend code or a private types package; the manifest is the only contract.
- Do not hardcode tool names, schemas or endpoints beyond the versioned tool path.
- Credentials live in the OS keychain by default; never silently fall back to plaintext storage or print
  or log tokens. The `CIPHRIX_CREDENTIAL_STORE=file` option is an explicit local/headless testing opt-in
  and must keep the containing directory at `0700` and the credential file at `0600` where supported.
- Logout must attempt remote session revocation before removing the local credential. On network,
  redirect, server, or other uncertain failures, retain the credential and give retry guidance; only
  clear it on confirmed revocation or a definitive invalid-session response. `logout --local-only` is
  the explicit opt-in to remove the local copy without revoking the remote session and must say so.
- Keep bounded request deadlines, response buffering and local upload sizes. Uploads must refuse
  symbolic links and special files before reading or transmitting data.

## Code conventions

- TypeScript strict, ESM, single quotes, 2-space indentation, ~100 columns (Prettier).
- Small modules under `src/`; tests under `test/`.
- Errors are honest and actionable, and never leak internal detail.
- Do not add a runtime dependency without a clear justification.

## Workflow

- Trunk-based: `main` is always releasable and protected; changes land through short-lived branches
  named `feat/`, `fix/`, `docs/`, `chore/`; CI and one approval required.
- Conventional commits; update `CHANGELOG.md` for user-visible changes.
- Run before opening a PR: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`.
- Changes to authentication, credential storage, command grammar or output format need an explicit
  review sign-off.

## When you need a value you do not have

Use a placeholder and continue. Do not invent internal values or paste them from another environment.
If a task cannot be completed without an internal value, stop and ask.
