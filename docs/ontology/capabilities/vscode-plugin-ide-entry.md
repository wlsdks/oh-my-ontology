---
slug: capabilities/vscode-plugin-ide-entry
kind: capability
title: VSCode Plugin (IDE Entry, v0.9.0)
domain: onboarding-ux
elements:
  - vscode-plugin/src/extension.ts
  - vscode-plugin/src/walk-vault.ts
  - vscode-plugin/src/tree-provider.ts
  - vscode-plugin/src/parse-frontmatter.ts
  - vscode-plugin/src/code-match.ts
  - vscode-plugin/src/write-vault.ts
  - vscode-plugin/src/mcp-client.ts
  - vscode-plugin/src/backlinks-provider.ts
relates:
  - capabilities/cli-developer-entry
  - capabilities/mcp-server
  - capabilities/mcp-conflict-guard
  - domains/onboarding-ux
---

# VSCode Plugin (IDE Entry, v0.9.0)

R13 (2026-05-04) 에 도입된 *developer-primary IDE* 진입점. CLI 가 터미널, MCP 가 AI agent 진입이라면 이 plugin 은 **VSCode 안에서 직접 vault 노드 보고, 코드 ↔ ontology 점프하고, 새 노드 생성/이름변경/병합하고, backlinks 탐색**.

v0.1.0 MVP → v0.5.0 (e2e + self-match) → v0.6.0 (informative status bar) → v0.7.0 (rename / merge commands) → v0.8.0-v0.8.2 (graph webview 시도) → **v0.9.0 (graph webview 제거 — 웹의 강점 영역으로 위임)**.

## v0.9.0 의 4 surface

### 1. Ontology TreeView (v0.1.0)

- Activity Bar 좌측 entry — graph 모티브 SVG icon
- vault 노드 `kind` 별 그룹화 (project / domain / capability / element / document / vault-readme)
- 노드 클릭 → 해당 `.md` 열기 (`ohMyOntology.openNode`)
- workspace 의 `docs/ontology/` 자동 detect, 다른 폴더는 picker (`ohMyOntology.pickVault`)
- vault path 영속 (`globalState` + 설정 `oh-my-ontology.vaultPath`)

### 2. 코드 ↔ ontology 점프 + informative status bar (v0.2.0 + v0.5.0 self-match + v0.6.0)

- 활성 editor 의 파일 path 와 vault 노드 매치 시 status bar (좌측) 에 노드 title 표시
- v0.6.0: 매치 종류 (self / exact / ancestor / element-array) 와 노드 kind 가 status bar tooltip 에 명시 — 사용자가 *왜 이 노드와 매치됐는지* 즉시 파악
- 매치 우선순위: self-match (활성 파일이 ontology .md 자체) > exact path > directory ancestor > capability.elements 배열
- status bar 클릭 → `ohMyOntology.openMatchedNode` → 해당 .md 열기

### 3. Add concept + Rename / Merge (v0.3.0 → v0.7.0 — write surface)

- **Add concept** — Command Palette: `oh-my-ontology: Add concept` 또는 TreeView 헤더 `+` 버튼. QuickPick (kind) → InputBox (slug) → InputBox (title) → optional domain → KIND_FOLDER auto-prefix. CLI `add` 와 동일 contract.
- **Rename concept (v0.7.0)** — TreeView context menu 또는 Command Palette. dry-run preview (영향 받는 backlink 개수) → confirm → MCP `rename_concept` 로 atomic 갱신.
- **Merge concepts (v0.7.0)** — 두 노드 합치기. 같은 dry-run / confirm 패턴. 두 명령 모두 silent overwrite 차단 + mtime conflict guard.
- 작성/변경 후 tree refresh + 결과 .md 자동 열림.

### 4. Backlinks panel (v0.4.0 — MCP server connect)

- 두 번째 TreeView 'Backlinks (current file)' — 활성 editor 매치 노드의 backlinks 표시
- ontology .md 직접 열어도 자동 populate (self-match 가 트리거)
- 데이터 소스: `oh-my-ontology-mcp` 의 `find_backlinks` 도구 (plugin 이 spawn)
- MCP 실패 시 raw filesystem scan (`computeBacklinksLocally`) 으로 graceful fallback
- `useMcp` 설정으로 끄기 가능

## v0.8 → v0.9 — graph webview 제거 결정

v0.8.0-v0.8.2 에서 IDE 안에서 vault 그래프 시각화를 webview 로 시도. CSP nonce 이슈 (#66 fix) 를 해결한 후에도 *웹의 Sigma WebGL 그래프 대비 가치 marginal* 판단 → v0.9.0 (#67) 에서 제거. 그래프 시각화는 `pnpm dev` → `/topology` 에서 보고, IDE 안에서는 트리 + 점프 + 작성에 집중.

대신 빈 Backlinks 패널 placeholder 에 *"For a graph view of the whole vault, run `pnpm dev` and open `/topology` in the browser."* 안내 link 추가.

## 5-way parser contract 편입

`vscode-plugin/src/parse-frontmatter.ts` 가 5-way 계약 5번째 진입점 (이전 4: src/shared, mcp, scripts/lib, cli). 12 fixture × 5 parser = 60 case 가 매 PR 마다 drift 차단. 동일 lenient 파서 = vault 호환성 보장.

## 4-layer 자동 검증

| Layer | 기법 | 무엇 검증 |
|---|---|---|
| 단위 logic | `node --test` (code-match / write-vault / backlinks-local) | parser / matcher / writer / fallback logic |
| MCP integration | spawn `mcp/src/index.js` (mcp-client.test.mjs) | wire protocol drift |
| VSCode integration | `@vscode/test-electron` (extension.test.ts) | activation / commands / config / contributes |
| Marketplace 준비 | `vsce package` (CI step) | manifest / icon / files / contributes shape |

CI 매 PR 마다 1–4 자동 — plugin 깨지면 즉시 fail.

## Marketplace 미발행

사용자가 `code --install-extension oh-my-ontology-vscode-0.9.0.vsix` 로 본인 VSCode (또는 fork — Cursor / Antigravity 호환) 에 설치해 일상 사용. Marketplace 발행 결정은 본인이 충분히 사용해본 후 명시 승인.
