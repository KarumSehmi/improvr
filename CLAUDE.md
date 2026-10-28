# Improvr

## Small changes go straight to `main`

For small, self-contained changes, such as adding a calendar event, to-do, birthday or reminder (usually a step in `src/lib/migrations.ts`), or a quick tweak to a habit, commit directly to `main` and push. Don't create a branch or a pull request. Run `npx tsc -b`, `npx oxlint` and `npx vitest run` first, and push only if they pass.

Bigger features and anything that changes how the app works still get a branch and a pull request.
