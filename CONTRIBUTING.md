# Contributing to ciphrix-cli

Thanks for taking the time to contribute. This repository is public, so please keep that bar in mind:
changes should be small, reviewed and free of secrets or customer data.

## Development workflow

We use a simple trunk-based model:

- **`main` is always releasable and protected.**
- **There is no long-lived `develop` branch.**
- Every change lands through a **short-lived pull request branch**.
- Branch names: `feat/<name>`, `fix/<name>`, `docs/<name>`, `chore/<name>`.
- **CI and one approval are required** before merging to `main`.
- Public releases are **tagged from `main`** (for example `v0.1.0`).

GitHub enforces what it can: `main` is protected, pull requests and passing CI are required, direct pushes
are blocked, and releases are published from tags on `main`. The naming convention and the "keep branches
short-lived" rule are team practice, described here rather than enforced by CI.

## Local setup

```bash
git clone https://github.com/CiphrixHQ/ciphrix-cli.git
cd ciphrix-cli
nvm use                 # or install Node >= 20.19
npm ci
```

Common scripts:

| Script                  | Purpose                                                                                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev -- --help` | Run the CLI from source.                                                                                                                                                                                   |
| `npm run build`         | Compile to `dist/`.                                                                                                                                                                                        |
| `npm test`              | Run the test suite.                                                                                                                                                                                        |
| `npm run typecheck`     | Type-check without emitting.                                                                                                                                                                               |
| `npm run lint`          | Lint.                                                                                                                                                                                                      |
| `npm run format`        | Format with Prettier.                                                                                                                                                                                      |
| `npm run audit:render`  | Dev aid: call every read tool against the signed-in API and report which returned fields are empty for every row. A report to triage — a blank can be real data or a wrong mapping — not a pass/fail gate. |

Before opening a pull request, run:

```bash
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
```

CI also runs `npm audit --audit-level=high` against the locked dependency tree and Semgrep OSS
against the committed `.semgrep.yml` rules. The dependency audit fails on high or critical advisories;
the local Semgrep rules flag dynamic JavaScript evaluation and untrusted input reaching shell commands.
These checks use no paid GitHub security features or hosted scanning service.

## Commits and pull requests

- Use clear, imperative commit messages (for example `feat: add tools list command`).
- Keep pull requests focused on one change; explain the why, not just the what.
- Add or update tests for behaviour changes.
- Do not include secrets, tokens, real tenant data or internal URLs in code, tests, fixtures, docs or
  commit messages.

### Public attribution and permanent metadata

Git records more than the current files. Commit author names and email addresses, branch names, commit
messages, pull-request discussions, reviews, screenshots, workflow logs and deleted file contents may all
become permanently public.

- Before your first commit, configure an identity you intend to publish. Use an approved company email or
  the verified GitHub `noreply` address shown in **GitHub → Settings → Emails**. Do not guess the address.
- An approved company address is valid public attribution; a `noreply` address hides the email, not the
  contributor's identity.
- Pull-request reviews and approvals are attributed to the reviewer's public GitHub account. They cannot
  be anonymous while retaining review provenance.
- Keep personal email addresses, local filesystem paths, customer or tenant identifiers, internal branch
  names, private discussions and private-environment details out of commits and captured output.
- Inspect screenshots and exported-file metadata before adding them. Use approved synthetic demo data for
  examples.
- Correct identity or metadata before pushing. Do not casually rewrite shared history: rewriting changes
  commit IDs, invalidates references and signatures, and requires a renewed full-history audit.

For repository-local configuration, for example:

```bash
git config user.name "Your Name"
git config user.email "the-exact-address-approved-for-public-commits"
```

## Reporting bugs and requesting features

Use the issue templates. For anything security-related, follow [SECURITY.md](SECURITY.md) instead of
opening a public issue.

## License

By contributing, you agree that your contributions are licensed under [Apache-2.0](LICENSE).
