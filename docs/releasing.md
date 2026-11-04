# Releasing the CLI

The production npm release is owned by `.github/workflows/release.yml` and runs on `v*` tag pushes.
A merge to `main`, including a version bump, does not publish. The protected `npm` environment
restricts eligible release refs and can require approval before publication.

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
5. Obtain review and merge to `main`. After verifying the intended merged commit and obtaining explicit
   release authorization, create and push its matching `v<version>` tag. Do not create a release tag
   on the unmerged PR branch or change the workflow/environment restrictions to bypass this step.

## Publication

The workflow verifies the release commit is reachable from `main`, rebuilds/tests the package and
publishes `@ciphrix/cli` to the default production npm registry with provenance. It then creates the
GitHub release for the triggering version tag.

The tag must match the package version and point to a commit reachable from `main`. A publication
failure requires inspection of npm and GitHub release state before retrying; package versions cannot
be overwritten. A failure after npm publication is not permission to publish different bytes under
the same version.

For an existing package, npm trusted publishing must authorize this repository, `release.yml` and the
`npm` environment; GitHub OIDC supplies the credential. Only first-package bootstrap uses `NPM_TOKEN`.
See [repository settings](repository-settings.md) for the required configuration. A tag push invokes
the workflow, but publication still requires environment approval and valid publisher setup.
