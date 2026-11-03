# Releasing the CLI

The production npm release is owned by `.github/workflows/release.yml`. A version-changing merge to
`main` invokes it; a normal documentation-only merge with unchanged package version does not publish.
The protected `npm` environment can require approval before publication.

## Prepare the pull request

1. Choose the next unpublished SemVer version. Additive capabilities use a minor bump; compatible fixes
   use a patch bump. Check `npm view @ciphrix/cli version` and existing release tags first.
2. Run `npm version <version> --no-git-tag-version --ignore-scripts` on the existing PR branch. Commit
   both `package.json` and `package-lock.json`, and set `CLI_VERSION` in `src/constants.ts` to the same
   version. The version-sync test checks this third value; do not create or push a release tag from
   that branch.
3. Move the shipped entries from `Unreleased` into a dated version heading in `CHANGELOG.md`, leaving
   `Unreleased` for future work. Update README, public skill and generated command reference when
   grammar, authority boundaries or output behavior changes.
4. Run `npm run ci`, the dependency/security gates in `AGENTS.md`, and inspect the package contents.
   Keep customer data, private endpoints and operational evidence out of the public repository.
5. Obtain review and merge to `main`. The release workflow compares the new package version with the
   previous `main` version, validates the matching lockfile and changelog, and runs the release checks.

## Publication

The workflow verifies the release commit is reachable from `main`, rebuilds/tests the package and
publishes `@ciphrix/cli` to the default production npm registry with provenance. It then creates the
matching `v<version>` GitHub release/tag at that commit. No separate manual tag push is needed.

Existing `v*` tag pushes remain an explicit release entry point; they must match the package version
and point to a commit reachable from `main`. Do not use both paths for the same version. A publication
failure requires inspection of npm and GitHub release state before retrying; package versions cannot
be overwritten. A failure after npm publication is not permission to publish different bytes under
the same version.

For an existing package, npm trusted publishing must authorize this repository, `release.yml` and the
`npm` environment; GitHub OIDC supplies the credential. Only first-package bootstrap uses `NPM_TOKEN`.
See [repository settings](repository-settings.md) for the required configuration. Merging schedules
the workflow, but cannot guarantee publication when environment approval or publisher setup is missing.
