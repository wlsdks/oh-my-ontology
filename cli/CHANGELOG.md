# Changelog — oh-my-ontology (CLI)

## 0.2.0 — 2026-05-04 (R12)

### Added — 4 new commands (developer-primary daily entry points)

- **`list [vault]`** — list ontology nodes (color table). `--kind X` filter, `--json` machine-readable.
- **`validate [vault]`** — frontmatter integrity check, 5 issue codes (unclosed-frontmatter / empty-kind / missing-kind / unknown-kind / parse-zero-keys). `exit 1` on errors — usable as a CI gate.
- **`add <kind> <slug> --title="..." [--domain X] [--body "..."] [--vault path]`** — scaffold a new ontology node. `kind` enum (project / domain / capability / element / document). Throws on duplicate slug. `mcp add_concept` 과 같은 contract.
- **`find <query> [vault] [--kind X] [--json]`** — search slug + title (case-insensitive). Yellow highlight on the matching span. Empty match = `exit 0` (정상).

### Internals

- `cli/src/lib/parse-frontmatter.mjs` — copy of `mcp/src/parser.mjs` (read + serialize). cli 가 별도 npm package 라 cross-import 불가능 → contract test 로 drift 차단:
  - `tests/contract/parse-frontmatter.contract.test.ts` 4-way (src/shared · mcp · scripts/lib · cli)
  - `tests/contract/validate-vault-document.contract.test.ts` 3-way (src/shared · mcp · cli)
- `cli/src/lib/walk-vault.mjs` — fs walk + slug 변환.
- `cli/src/lib/validate.mjs` — vault frontmatter validator.
- `cli/src/lib/write-vault.mjs` — `slugToPath` (vault root sandbox) + `writeDoc`.
- `cli/src/integration.test.mjs` — 11 spawn-based integration cases (영구 회귀 가드).

### Onboarding flow

`init` 의 next-steps 갱신 (R12 #36):
1. Explore — cd + `list` + `validate`
2. Add first node — `add capability ... --title=...` + `find token`
3. Edit project.md
4. Wire AI agent (`.mcp.json.example`, 14 tools 명시)
5. See graph (web UI)

### Tarball

- `files` 에 `CHANGELOG.md` 추가.

## 0.1.0 — initial

- `init [folder]` — scaffold vault (project / domain / capability / element starter .md + `.mcp.json.example`).
