# Repository rules for AI agents

Read [CONTRIBUTING.md](CONTRIBUTING.md) before creating branches, committing or opening pull requests.

- Never push to, force-push, merge into, or delete `main`. It is protected by a GitHub ruleset and only receives
  `development` at release time.
- The integration branch is `development`. Pull requests target `development`.
- Branch names must be `<type>/<description>` with type `feat|fix|hotfix|chore|docs|refactor|test` (or `release/vX.Y.Z`),
  lowercase, hyphen-separated, 3-50 characters in the description. Invalid names are rejected or auto-deleted by CI.
- Do not change repository settings, rulesets or branch protection unless the user explicitly asks.
