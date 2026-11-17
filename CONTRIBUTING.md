# Contributing

## Branch model

| Branch | Purpose | Who can change it |
|---|---|---|
| `main` | Released code only. | Pull requests from `development` (or a `hotfix/*` branch) only. |
| `development` | Integration branch. All work lands here first. | Pull requests only. |
| topic branches | One piece of work each (see naming below). | You. Deleted automatically after the PR merges. |

Nobody pushes directly to `main` or `development`, force-pushes them, or deletes them. This is enforced by GitHub rulesets with
no bypass, including for the repository owner.

`main` is only updated at release time: open a PR from `development` into `main` once `development` is green and ready to ship.

## Branch names

Every branch other than `main` and `development` must be named `<type>/<description>`:

| Type | Use for | Example |
|---|---|---|
| `feat/` | New features | `feat/vehicle-compare` |
| `fix/` | Bug fixes | `fix/photo-upload-timeout` |
| `hotfix/` | Urgent fix branched from `main` | `hotfix/login-500` |
| `chore/` | Tooling, dependencies, CI, configuration | `chore/upgrade-next` |
| `docs/` | Documentation only | `docs/api-contracts` |
| `refactor/` | Code restructuring without behaviour change | `refactor/vehicle-queries` |
| `test/` | Tests only | `test/e2e-feed` |
| `release/` | Release preparation (optional), `vX.Y.Z` | `release/v1.0.0` |

`<description>`:

- lowercase letters, digits and single hyphens only (no uppercase, spaces, underscores or dots; dots are allowed only in
  `release/vX.Y.Z`)
- 3 to 50 characters, not starting or ending with a hyphen
- an issue number may come first: `feat/12-add-login`

Invalid: `Feature/AddLogin`, `fix/photo_upload`, `feat/new--page`, `my-branch`, `bugfix/thing`.

### How the scheme is enforced

1. A repository ruleset (`branch-naming`) rejects creating any branch outside `main`, `development` and the prefixes above, so
   `git push` of `my-branch` fails.
2. The ruleset can only check prefixes, so `.github/workflows/branch-name.yml` also checks the *full* name and **deletes** a
   newly created branch that is invalid (for example `feat/Bad_Name`).
3. Required status checks `branch-name` and `pr-source` on every pull request.

## Workflow

```
git switch development && git pull
git switch -c feat/my-feature          # name must follow the scheme
# ... commit ...
git push -u origin feat/my-feature
gh pr create --base development        # PRs target development, never main
```

- Merge with a **merge commit** (the only enabled method) once CI is green and review comments are resolved.
- The head branch is deleted automatically after merge.
- Required checks: `web-quality`, `web-integration`, `branch-name` (and `pr-source` for `main`). Checks that do not apply to a
  change (for example docs-only) are skipped and count as passing.
- If a PR falls behind its base, use "Update branch" before merging; required checks must pass on the up-to-date branch.

## Releasing and hotfixes

- **Release:** PR from `development` into `main`. It must pass all four required checks.
- **Hotfix:** `hotfix/<description>` from `main`, PR into `main`, then merge `main` back into `development` through a PR so the
  branches do not drift.

## Commit messages

Imperative, present tense, with a type prefix matching the branch types where it fits (`feat:`, `fix:`, `chore:`, `docs:`,
`refactor:`, `test:`), for example `fix: reject expired reset tokens`.

## Local checks

From `web/`: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:integration`, `npm run test:e2e` (integration and E2E
need Postgres and MinIO: `docker compose up -d db minio`). On Windows run tests from an upper-case drive path (`D:\...`).
