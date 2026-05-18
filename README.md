# oh-my-ontology

> **A repo-native memory layer for Claude Code, Cursor, and Codex.**
>
> Your AI coding agent forgets your codebase between sessions. Give it a
> local, git-backed mental model it can read, query, and maintain through MCP.

[![CI](https://github.com/wlsdks/oh-my-ontology/actions/workflows/ci.yml/badge.svg)](https://github.com/wlsdks/oh-my-ontology/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![MCP](https://img.shields.io/badge/MCP-23_tools-5e6ad2)](mcp/README.md)

**Live demo:** https://oh-my-ontology.web.app
**GitHub:** https://github.com/wlsdks/oh-my-ontology

`oh-my-ontology` is a local-first workbench for the shared memory between a
developer and their AI coding agent. The graph is not stored in a hosted
database. It is plain markdown frontmatter inside your repo, so every change is
reviewable as a normal git diff.

```bash
npx oh-my-ontology init ./ontology
oh-my-ontology analyze . --vault ./ontology
oh-my-ontology workspace-brief ./ontology
oh-my-ontology health ./ontology
```

No backend. No login. No cloud account. Your repo is the source of truth.

---

## Why It Exists

AI coding agents are useful, but they usually rebuild project context from
scratch every session. They remember the current prompt better than the long
term shape of the codebase: domains, capabilities, dependencies, ownership,
and design decisions.

`oh-my-ontology` gives agents a durable local memory they can query before
touching code and update after real changes.

The product is not "please maintain an ontology." The useful loop is:

1. Open a repo.
2. Draft the first graph automatically from source layout, README headings,
   `package.json`, and TS/JS imports.
3. Let the AI agent answer through MCP using the maintained graph.
4. After code work, let the agent propose memory updates.
5. Review the markdown diff.
6. The next agent session starts with better context.

## What It Does

| Surface | What you use it for |
|---|---|
| **CLI** | Init a vault, bootstrap from a repo, validate frontmatter, compile graphs, inspect paths, find backlinks, rename/merge/delete nodes safely. |
| **MCP server** | Give Claude Code, Cursor, Codex, and other agents 23 local read/write tools over stdio JSON-RPC. |
| **Web workbench** | Browse and edit the same vault through `/docs`, `/ontology`, `/topology`, `/projects`, and the ERD builder. |
| **Compiler + query engine** | Turn markdown files into a deterministic graph artifact with `graphHash`, issues, indexes, health checks, impact, lineage, cycles, and maintenance actions. |

## How The Memory Works

Every markdown file is one graph node. Frontmatter is the machine-readable
record; the body is the human-readable explanation.

```yaml
---
slug: capabilities/token-issue
kind: capability
title: Token issue
domain: domains/auth
elements:
  - elements/src/auth/token-service
dependencies:
  - capabilities/session-refresh
---

Issues access and refresh tokens for authenticated users.
```

`compile_ontology` reads the vault and produces a deterministic graph artifact:
canonical nodes, canonical edges, aliases, issues, `graphHash`, `maxMtime`, and
optional query indexes. `query_ontology` then answers graph-style questions
over that artifact: neighbors, paths, centrality, communities, impact, blast
radius, project scope, lineage, cycles, health, workspace brief, and
maintenance plan.

That means this is not a server-side graph database. It is a markdown-backed
ontology vault with graph database behavior at runtime.

## Quick Start

### 1. Create a local vault

```bash
npx oh-my-ontology init ./ontology
```

The command scaffolds a git-friendly markdown vault and prints the MCP setup
steps for your agent. Claude Code and Cursor can read the generated `.mcp.json`.
Codex can use the printed `codex mcp add ...` command.

### 2. Draft the first graph

```bash
oh-my-ontology analyze . --vault ./ontology      # preview only
oh-my-ontology bootstrap . --vault ./ontology    # write accepted candidates
oh-my-ontology workspace-brief ./ontology
```

`analyze` is side-effect-free. It proposes domains, capabilities, elements, and
relations from real repo structure. `infer-imports` can add TS/JS import
evidence for dependency edges.

### 3. Run the visual workbench

```bash
git clone https://github.com/wlsdks/oh-my-ontology
cd oh-my-ontology
pnpm install
pnpm dev
```

Open `http://localhost:3000`, go to `/docs`, and choose a markdown vault folder.
The browser reads and writes local files through the File System Access API.

## Three views plus MCP, one vault

The same frontmatter graph is rendered three ways and exposed to agents through MCP:

- **Topology** (`/topology`) - Sigma WebGL spatial network of projects and relations.
- **Tree** (`/`, `/ontology`) - project to domain to capability to element drill-down.
- **ERD builder** (`/ontology/edit`) - xyflow canvas for adding nodes and relations visually.
- **MCP** (`mcp/`) - JSON-RPC stdio server with 23 tools for AI agents.

All four read and write the same `.md` files. Pick the interface that matches
the task; the vault stays the source of truth.

## Agent Workflow

Use the graph before code work:

```bash
oh-my-ontology workspace-brief ./ontology
oh-my-ontology overview ./ontology
oh-my-ontology backlinks capabilities/token-issue ./ontology
oh-my-ontology blast-radius capabilities/token-issue ./ontology
```

Then let the agent sync memory after non-trivial changes:

- New code capability: add a `kind: capability` node.
- New concrete file/module worth tracking: add a `kind: element` node.
- New dependency: add a relation.
- Rename or merge: use the safe dry-run commands first, then confirm.

Manual editing is allowed, but the product bet is automation: bootstrap first,
agent-maintained memory after that.

## Web Routes

| Route | Purpose |
|---|---|
| `/` | Landing page or ontology hub after a vault is selected |
| `/docs` | Local vault picker, markdown editor, command palette |
| `/ontology` | Tree and ego graph hub |
| `/ontology/edit` | ERD canvas builder |
| `/ontology/insights` | Kind census, hubs, relation breakdown |
| `/topology` | Spatial graph view |
| `/projects` | Project list from `kind: project` docs |

The public demo is a static site. Real vault editing happens only after the
browser receives permission to access a local folder on your machine.

## Verifiable promises

| Promise | How this repo checks it |
|---|---|
| **No backend** | `pnpm bundle:check` keeps Firebase/server chunks out of local-first routes. |
| **Static deploy** | `pnpm build` exports to `out/`; Firebase Hosting serves only static files. |
| **Vault integrity** | `pnpm vault:validate`, `test:vault:validate`, `vault:audit`, and `test:vault:audit` run in CI. |
| **MCP/CLI contracts** | `pnpm test:mcp:docs`, `pnpm package:check`, `pnpm test:contracts`, and focused `test:mcp:*` scripts cover the agent surface. |
| **Dogfooding** | This repo's own vault has **29 nodes**: capabilities 17, domains 6, elements 4, project 1, vault-readme 1. |

For the detailed maintainer command matrix, see
[`docs/DEVELOPMENT-CHECKS.md`](docs/DEVELOPMENT-CHECKS.md).

## Local Development

```bash
pnpm install
pnpm dev
pnpm exec tsc --noEmit
pnpm lint
pnpm test:run
pnpm build
pnpm bundle:check
```

Helpful vault commands:

```bash
pnpm vault:validate
pnpm vault:audit
pnpm dogfood:compile
pnpm dogfood:health
pnpm dogfood:brief
```

### Vault tooling

The vault tooling is intentionally local and scriptable:

```bash
pnpm vault:validate              # frontmatter integrity audit
pnpm vault:validate /your/vault  # validate any folder
pnpm vault:validate -- --help    # print validator usage without scanning
pnpm test:vault:validate         # focused validator CLI argument contract
pnpm vault:audit                 # dogfood ontology paths match real repo files
pnpm test:vault:audit            # focused vault audit CLI argument contract
```

CI runs `pnpm vault:validate`, `pnpm test:vault:validate`,
`pnpm vault:audit`, `pnpm test:vault:audit`, and `pnpm package:check` on every PR.

## Architecture

| Area | Stack |
|---|---|
| App | Next.js 16, React 19, TypeScript 5, App Router, static export |
| UI | Tailwind CSS 4, Radix primitives, lucide icons |
| Graph | Sigma.js, Graphology, ForceAtlas2, xyflow |
| Local-first | File System Access API, IndexedDB handle persistence |
| Agent interface | `@modelcontextprotocol/sdk`, stdio JSON-RPC |
| Tests | Vitest, Testing Library, jsdom, Playwright, Node test runner |

Feature-Sliced Design import direction is enforced by ESLint:

```text
app -> views -> widgets -> features -> entities -> shared
```

## Documentation

| Document | Use it for |
|---|---|
| [`docs/PRODUCT-DIRECTION.md`](docs/PRODUCT-DIRECTION.md) | Product strategy and launch framing |
| [`docs/AGENT-MEMORY-POSITIONING.md`](docs/AGENT-MEMORY-POSITIONING.md) | Why this is agent memory, not an ontology editor |
| [`docs/FEATURES.md`](docs/FEATURES.md) | Current CLI, MCP, and web feature inventory |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Local-first architecture and data flow |
| [`docs/DEVELOPMENT-CHECKS.md`](docs/DEVELOPMENT-CHECKS.md) | Maintainer verification and release checks |
| [`mcp/README.md`](mcp/README.md) | MCP registration and tool contracts |
| [`cli/README.md`](cli/README.md) | CLI commands and examples |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Contribution workflow |

## Contributing

Issues and PRs are welcome. The most useful feedback right now is practical:

- Try `npx oh-my-ontology init` in a real repo.
- Connect an AI coding agent through MCP and note where the memory helps or fails.
- Bring a messy markdown vault and report where validation or bootstrap is confusing.

Before contributing, read [`AGENTS.md`](AGENTS.md). It is the canonical guide
for both humans and AI agents working in this repo.

## License

MIT. See [`LICENSE`](LICENSE).

---

## 한국어 가이드

`oh-my-ontology`는 Claude Code, Cursor, Codex 같은 AI coding agent가
코드베이스의 장기 맥락을 잃지 않도록 돕는 local-first memory layer입니다.

핵심은 간단합니다.

- markdown frontmatter가 그래프입니다.
- git repo가 진실원입니다.
- 백엔드, 로그인, DB가 없습니다.
- 개발자와 AI agent가 같은 `.md` vault를 읽고 씁니다.

빠른 시작:

```bash
npx oh-my-ontology init ./ontology
oh-my-ontology analyze . --vault ./ontology
oh-my-ontology bootstrap . --vault ./ontology
oh-my-ontology workspace-brief ./ontology
```

웹 workbench를 로컬에서 실행하려면:

```bash
pnpm install
pnpm dev
```

브라우저에서 `http://localhost:3000/docs`를 열고 vault 폴더를 선택하면 됩니다.
실제 파일 읽기/쓰기는 브라우저의 로컬 폴더 권한으로만 동작합니다.

제품의 목표는 “온톨로지를 손으로 관리하게 만드는 도구”가 아닙니다. 목표는
repo를 열면 초안을 만들고, agent가 작업 후 mental model 업데이트를 제안하고,
사용자가 diff처럼 승인하고, 다음 agent 작업에서 바로 더 나은 맥락을 느끼는
루프입니다.
