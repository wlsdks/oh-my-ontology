---
slug: capabilities/cli-developer-entry
kind: capability
title: CLI Developer Entry (init / list / validate / add / find / import + graph-level)
domain: onboarding-ux
elements:
  - cli/src/index.mjs
  - cli/src/commands/list.mjs
  - cli/src/commands/validate.mjs
  - cli/src/commands/add.mjs
  - cli/src/commands/find.mjs
  - cli/src/commands/import.mjs
  - cli/src/commands/backlinks.mjs
  - cli/src/commands/query.mjs
  - cli/src/commands/rename.mjs
  - cli/src/commands/merge.mjs
  - cli/src/commands/delete.mjs
  - cli/src/lib/mcp-call.mjs
relates:
  - capabilities/mcp-server
  - capabilities/vault-validator
  - domains/onboarding-ux
---

# CLI Developer Entry

R12 (2026-05-04) 에 도입된 *developer-primary* 진입점. R14 에서 `import` (6 명령), R15 follow-up 에서 graph-level 5 명령 추가 — 총 **11 명령**. 사용자가 vault 만든 후 *터미널 즉시* ontology 작업 가능 — 웹 UI / MCP 등록 불필요.

## Local commands (R12 + R14 — vault scaffold + frontmatter)

| Command | What it does |
|---|---|
| `oh-my-ontology init [folder]` | Scaffold vault (5 starter .md + `.mcp.json` cwd + vault) |
| `oh-my-ontology list [vault]` | List ontology nodes (color table, `--kind X` filter, `--json`) |
| `oh-my-ontology validate [vault]` | Frontmatter integrity check (6 issue codes; CI gate via exit 1) |
| `oh-my-ontology add <kind> <slug> --title="..."` | Scaffold new node (duplicate throw, `--domain --body --vault`, R15 `--auto-prefix` default on, `--raw-slug` opt-out) |
| `oh-my-ontology find <query> [vault]` | Search slug + title with yellow highlight (`--kind --json`) |
| `oh-my-ontology import <path...>` | **R14** Import external `.md` (frontmatter normalize + `--auto-prefix` / `--rename` / `--dry-run`) |

## Graph-level commands (R15 follow-up — Concern 4 fix)

post-publish architectural audit 발견 — *위험한-그러나-필수* 작업 (rename/merge/delete) 이 MCP-only 라 mission inversion. 5 명령 추가로 동등.

| Command | What it does |
|---|---|
| `oh-my-ontology backlinks <slug>` | MCP `find_backlinks` — every node referencing the target |
| `oh-my-ontology query "<filter>"` | MCP `query_concepts` — typed filter DSL (kind/domain/has/AND/OR/NOT/parens) |
| `oh-my-ontology rename <old> <new>` | MCP `rename_concept` — atomic, dry-run default, `--confirm` to apply |
| `oh-my-ontology merge <from> <into>` | MCP `merge_concepts` — atomic redirect + delete from, dry-run default |
| `oh-my-ontology delete <slug>` | MCP `delete_concept` — refuses if backlinks remain (`--force` overrides) |

## 구현 단일 진실원

local commands 는 *cli 안* 구현 (4-way parser/3-way validator contract). graph-level 5 는 *MCP server child_process spawn + JSON-RPC* — `cli/src/lib/mcp-call.mjs` 의 thin wrapper. drift surface 0 (logic 복제 안 함). spawn ~50-100ms per call — 한 번씩 호출이라 acceptable.

cli 가 별도 npm package (v0.3.0, R15 follow-up) — `oh-my-ontology` binary. cli/package.json 의 `dependencies: oh-my-ontology-mcp ^0.7.1` 가 graph-level 명령 자동 활성.

## 회귀 차단

cli/src/integration.test.mjs — **32 spawn-based** integration test (R12 #40 11 + R14 add/import 9 + R15 follow-up 8 + R15 hint 4). 매 PR 마다 graph-level 명령의 dry-run/confirm 경로 + backlink redirect 검증.
