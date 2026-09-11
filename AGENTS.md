# Hordbook — agent instructions

Hordbook is a personal, rank-ordered word hoard for learning English vocabulary, built as an installable single-page web app (PWA) for iPhone. Words are organised into collections; the first collection is the New General Service List (NGSL 1.2).

Read `CONTEXT.md` for the domain vocabulary before making changes.

## Hard constraints

- Zero running cost beyond the owner's existing ChatGPT Plus subscription: no paid APIs, no paid hosting, no paid developer programmes.
- Every data source must be redistributable under a licence compatible with CC BY-SA 4.0, and the shipped data files carry that licence with attribution.
- No servers or accounts: the app is static, progress lives on the device, and sync is export/import.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues for `abaw/hordbook`, operated through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels are used verbatim (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` at the repo root plus `docs/adr/` for decisions. See `docs/agents/domain.md`.

## Working notes

- `git push` from Amazon-managed hosts is gated by Code Defender until the repository is approved; GitHub API operations via `gh` (issues, labels) are not gated.
