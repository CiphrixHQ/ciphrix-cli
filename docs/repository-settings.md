# Repository settings

These settings live in GitHub, not in the codebase. Configure them once when the repository becomes
public (and verify after any settings change).

## Branch protection — `main`

- Require a pull request before merging.
- Require **1** approving review.
- Dismiss stale approvals when new commits are pushed.
- Require review from Code Owners (see `.github/CODEOWNERS`, if present).
- Require status checks to pass before merging, including the CI jobs: `secret-scan` and every
  `build-and-test (…)` matrix leg (`20.x`, `22.x`, `24.x`).
- Require branches to be up to date before merging.
- Require conversation resolution before merging.
- **Block force pushes** and **block deletions**.
- Do not allow bypassing the above settings.

## Merge settings

- Allow **squash merging**; disable merge commits and rebase merging (keeps `main` linear).
- Automatically delete head branches after merge.

## Releases

- Publish releases from tags on `main` only (for example `v0.1.0`).
- The `release` workflow publishes the npm package with provenance and creates the GitHub release.
- Configure npm trusted publishing for package `@ciphrix/cli` using GitHub Actions with organization
  `CiphrixHQ`, repository `ciphrix-cli`, workflow filename `release.yml`, and environment `npm`. The
  release workflow uses GitHub OIDC and publishes directly with `npm publish --access public`; enable
  direct publishing for this trusted publisher. No npm publish token or `NPM_TOKEN` secret is
  required.
- Keep the GitHub `npm` environment and configure its protection rules if release approval is needed.

## Security

- Enable Dependabot alerts and security updates (`.github/dependabot.yml`).
- Enable secret scanning and push protection.
- Enable private vulnerability reporting.
