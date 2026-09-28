# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `ciphrix login` opens the verification link in the default browser when possible; `--no-open` keeps the flow headless. Device-code polling now uses RFC 8628 defaults, waits the advertised interval before each poll, bounds timing values, and increases the delay after `slow_down`.
- `ciphrix login` / `ciphrix logout` using device authorization (RFC 8628). `login` prints a single link with
  the code embedded; credentials are stored in the OS keychain with a `0600` file fallback.
- `ciphrix policy read <policyId>` — print a policy as Markdown.
- `ciphrix risk update <riskId> --status <status>` — change a risk status, with an interactive
  confirmation step (`--yes` to skip).
- `ciphrix tools list` / `ciphrix tools run` for direct tool access, including the two-step confirmation
  and idempotency flow for writes; `--json` output for scripting.
- `--api-url` / `CIPHRIX_API_URL` to target another environment.

### Changed

- API calls now time out after 30 seconds, response bodies are capped at 10 MiB, and local evidence
  uploads are limited to regular files of at most 50 MiB before they are read into memory.
- The canonical public npm package is now `@ciphrix/cli`; the installed executable remains `ciphrix`.
- `ciphrix logout` now confirms remote revocation before removing a credential, retains it after
  transient failures for retry, and offers `--local-only` for explicit device-only removal.
- API requests and uploads now require HTTPS unless the caller explicitly enables plaintext HTTP for
  local/non-production testing with `--allow-insecure-http` or `CIPHRIX_ALLOW_INSECURE_HTTP=true`;
  URL credentials, query strings, fragments and non-HTTP(S) schemes are rejected, and redirects are
  blocked to prevent credential or upload forwarding.
- The CLI now requires an explicit `CIPHRIX_CREDENTIAL_STORE=file` opt-in for local/headless plaintext
  credential storage; keychain failures no longer silently downgrade to a file.
- The CLI now talks to the versioned tool surface (`/api/tools/v1`).
- TypeScript project scaffold (strict compiler settings, build, tests, linting, formatting) and the shared
  terminal output helpers (colour handling, status vocabulary, banner).
- Documentation and repository governance: README, CONTRIBUTING, SECURITY, Code of Conduct, issue/PR
  templates, CI and release workflows.

## [0.1.0] - unreleased

First pre-release. Authentication and the tool commands are still being built.
