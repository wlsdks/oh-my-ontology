# FEATURES — oh-my-ontology

> Complete inventory of features users can **actually use right now**.
> Last updated: 2026-05-16 (CLI mcp-verify command — CLI · MCP · Web 3 surface, 23 MCP tools, installed MCP health + graph-query smoke path).
> Routes section UI 디테일은 R10 시점 snapshot — surface 자체와 mode branching 은 R15 까지 정확. routes UI micro-detail 은 R10 후 변화 작아 별도 sweep 보다 *대부분 정확* 가정.
> Update trigger: reflect immediately when surfaces are added or removed. Update alongside the PR body and CHANGELOG.

---

## 0. At a glance

> **Mission v3**: "One codebase, one ontology, that the developer and their AI agent grow together."
> **Operating model**: single-user tool. Local-first vault. No login, no backend. **3 surface (CLI · MCP · Web)** — AI agents (Claude Code, Codex, Cursor) read/write directly through the MCP server.

| Surface | Entry | Audience |
|---|---|---|
| **CLI** (R12 / R14 / R15+ · 26 commands) | `init / add / import / list / find / validate / mcp-verify / query / compile` (vault basics + installed MCP health/graph-query smoke + deterministic graph compile) · `analyze / infer-imports / bootstrap` (autonomous ingest) · `backlinks / orphans / path / rename / merge / delete` (graph CRUD) · `overview / hubs / blast-radius / cycles / health / workspace-brief / node / similar` (graph deep dive — `query_ontology` ops) | developer terminal — vault scaffold, daily exploration, bulk import, MCP sanity check, graph deep dive (same authority as AI agent via MCP) |
| **MCP** (R5 / R7 / R11 / R14 / R16 / R17) | 23 tools (15 read · 8 write) over JSON-RPC | AI agent (Claude Code, Codex, Cursor) — read for context · write back findings · bootstrap empty vault (R16 `analyze_repo_structure` · R17 `infer_imports`) |
| **Web** (8 routes, R10 surface diet) | `pnpm dev` / static export | sigma topology · tree+ego · ERD builder · insights — graph visualization, mobile-friendly |

```
input (humans + AI agents)     parse           store              output
        │                       │                │                │
        ▼                       ▼                ▼                ▼
  .md in vault  →          frontmatter   →  user disk      →  Browse (/, /ontology) tree+ego
  (frontmatter)                              (vault)           Topology (/, /topology) Sigma WebGL
  + AI agent (MCP)                                            Builder (/ontology/edit) xyflow ERD
                                                              Insights (/ontology/insights) census
```

---

## 1. Mode branching (data source)

`useDataSourceMode()` resolves to one of two modes (R10b: cloud / auth surface permanently removed):

| Mode | Condition | Behavior |
|---|---|---|
| **local** | vault folder active | vault manifest is the source of truth |
| **static** | no active vault | build-time dogfood manifest (this project's own ontology) |

**Effect**: when a user opens a vault folder, `/`, `/topology`, `/projects`, `/project/[slug]`, `/ontology`, `/ontology/insights`, and `/ontology/edit` all switch to vault data instantly. Mutations (create / edit / delete / connect) are mode-aware: local → write to vault `.md`; static → rejected with toast (read-only).

**Single source of truth (R8)**: `LocalVaultProvider` mounts once in `app/[locale]/layout.tsx`. All 8 consumers (`useLocalVault()` callsites: RootEntryPage / OperationsNav / OntologyEditPage / DocsVaultPage / useDataSourceMode / useProjects / useProjectMutations / useVaultOntology) share one state instance, one IDB rehydrate, one filesystem walk.

---

## 2. Routes (8 surfaces)

### `/` — Smart entry

- **No vault** → `LandingPage`
- **Vault loaded** → `HomePage` (Sigma topology hub) — same component as `/topology`

### `/` — Landing (no vault)

- **Hero**: title + subtitle + 3-step value chain rail (01 / 02 / 03)
- **Mini topology** animation (14 nodes, 21 edges, SVG ForceAtlas2 — respects `prefers-reduced-motion`)
- **Primary CTA** (R3 cut D): "Open my markdown folder" → `/docs/?intent=local` (auto-opens vault picker)
- **Secondary CTA**: "See the demo first" → `/ontology/`
- **Privacy note**: "Local folders stay on disk, never sent anywhere"
- **Footer**: license · GitHub · stack chips · `LocaleSwitch`

### `/` and `/topology` — Sigma WebGL hub

Both routes render the same `HomePage` (R3 keep-both decision: `/` = home/back-link target, `/topology` = explicit deep-link namespace).

#### Canvas (Sigma + Graphology + ForceAtlas2)
- **Click node** → right-side `ProjectDrawer` opens
- **Drag node** → reposition (releases back to physics)
- **Double-click node** → "local graph" mode (2-hop neighbors only, breadcrumb: `Local · Root · slugA · slugB`, click to backtrack, Esc to exit)
- **Right-click node** → context menu (Focus / Local graph / Copy detail URL)
- **Shift-click 2 nodes** → highlight shortest path
- **Tab** → keyboard cycle to neighbor hub
- **Empty state** (0–1 nodes) → `TopologyEmptyState` card with 3 CTAs (tree / builder / open vault)
- **Filter active** → bottom-left "filter · N / TOTAL" badge

#### `SigmaControls` (top-right, collapsed default)
- Fit Map button · Open Controls button
- Expanded panel: search input · "Hubs only" toggle · Overlay section (recent-update pulse, backref highlight) · Advanced section (owner color, audit highlight, depth slider 1–7, force sliders, Reset layout)
- Shortcuts inside controls: `/` focus search · `0`–`6` set depth · `?` shortcuts sheet

#### `SigmaHubRail` (left, collapsed default)
- Hub list sorted by degree, click to select
- Keyboard: `↑/↓` cycle hubs · `Home/End` jump to first/last
- Suppressed when hero panel expanded (avoid overlap)

#### Top-right buttons
- **Docs button** (`D`) → `DocsQuickDrawer` overlay with pinned/recent docs preview
- **Shortcuts button** (`?`) → `ShortcutSheet`

#### Left workspace info panel
- Expanded: workspace title + project/hub counts + 3 nav links (Projects / Docs / Ontology) + collapse button
- Collapsed: pill with selected project name or workspace summary

#### Right-side `ProjectDrawer` (when a node is selected)
- Project name + icon + category badge · description · tags · stack
- "View project" → `/project/[slug]/`
- "Open docs vault" → `/docs/?slug=...`
- Connections summary (dependencies / referencedBy)
- Impact mode toggle (Default · Upstream · Downstream · Network)
- Integrity checks · screenshots (lazy top 2) · timeline · links
- Footer: "slug · updated DATE"

#### Mobile-only
- `BottomTabBar` (4 tabs: Ontology / Topology / Projects / Docs) at safe-area bottom
- `GestureHint` overlay (dismissible, not persisted)

#### Global keyboard shortcuts (all `useTypingShortcuts`-gated)
| Key | Action |
|---|---|
| `⌘K` | Project search palette (`SearchPalette`) |
| `⇧⌘K` | Global search (`MountedGlobalSearch` — nodes + projects) |
| `D` | Toggle docs drawer |
| `?` | Toggle shortcut sheet |
| `Esc` | Layered: exit local graph → close drawer → clear search |

---

### `/docs` — Docs Vault (reader + editor + palette)

#### Header (always visible)
- Back button · title + doc count · `Local` badge (when source=local)
- **Source toggle** (R3 cut C — radio: Sample / Local). Round 4 J: clicking Local auto-opens vault tools dropdown if no vault loaded yet
- **Palette button** (`⌘K`)
- **Vault tools dropdown** (gear icon, only when source=local + supported):
  - Folder-topology view toggle (button)
  - `LocalVaultPicker` (open / close / refresh / re-authorize / status display)
  - `OntologyStarterCta` (when vault is empty)
  - "New doc" button (when canEdit)

#### Status banner (R9 cut, below header)
- Visible when `source=local && (status='error' || status='permission-needed')`
- Shows error message · "Open picker" button to reauth/re-pick
- Stops the silent server-fallback that was confusing users

#### Sidebar (md+)
- **Pinned docs** (when count > 0): pin/unpin via hover button
- **Recent docs** (when count > 0): chronological
- **Tree** (`DocsVaultTree`): folder hierarchy, click to select, tag-filter auto-expands folders
- **Tags** (`DocsVaultTags`): `<details>` collapsible, top 12 tags + active even if > 12, click to toggle filter

#### Mobile drawer (<md)
- Hamburger button → overlay drawer with sidebar contents

#### Content area
- **view=doc** (default): editor (when editing) or viewer + `DocMetaBar` (word count, reading minutes, tags, updated date) + `DocsVaultBacklinks` + `DocsVaultProjectDepsBar` (in `projects/*` + local)
- **view=folder-topology** (local only): mini Sigma over `projects/*.md`, drag positions saved to frontmatter, `+ Project` button (canEdit)

#### Unified palette (`⌘K`, `DocsVaultUnifiedPalette`)
- **Empty query**: pinned → recent → top 5 commands
- **`>` prefix**: command fuzzy match
- **`#` prefix**: tag fuzzy match
- **General query**: doc title/slug/tags/excerpt search (15 results) + command substring (5)
- Keyboard: `↑↓` move · `↵` execute · `Tab` cycles mode (`""` → `>` → `#`) · `Esc` close
- Doc rows are `<Link>` (⌘-click → new tab)

#### Editor mode (`DocsVaultEditor`, local only)
- Top bar: slug eyebrow · dirty indicator · saved flash · Preview toggle · Save · Cancel
- Format toolbar: Bold / Italic / Code / H1-3 / Bullet / Numbered / Checkbox / Quote / Link
- Editor: textarea, monospace, optional 50/50 live preview (200 ms debounce)
- Wikilink autocomplete (`[[…`): top 8 matching docs, `↑↓ Tab Enter`
- Inline error red banner on save failure
- Keyboard: `⌘S` save · `⌘B` bold · `⌘I` italic · `⌘K` insert link · `Esc` close (with discard confirm)
- `beforeunload` blocks navigation when dirty

#### Commands (~20 in palette)
view-doc · view-folder-topology · pin · unpin · copy URL · print · edit · new doc · daily note · rename · delete · insert TOC · export doc HTML · export vault · import vault · scaffold topology · source-server · source-local · create project · find tags

#### Visual / behavioral details
- Indigo accent (`rgba(139,151,255,…)`) for active, gold star for pinned
- Markdown: GFM tables/lists/blockquotes/code · callout blocks (`> [!tip]` etc.) · wikilinks (`[[slug]]`, `[[slug|label]]`, `[[slug#anchor]]`, `[[project:slug]]`) · heading anchor copy buttons
- Local images: relative paths resolved to blob URLs via `resolveImage` callback
- Recent + pinned per-vault localStorage (key prefix includes vault folder name)
- Sample/Local source toggle persisted to localStorage; folder-topology view forced back to `doc` when switching to server

---

### `/ontology` — Browse (tree + ego + detail)

#### Sub-nav (R3 cut F — always visible, no toggle)
- **Browse** (`/ontology/`) — exact-match `''` and `/ontology`
- **Builder** (`/ontology/edit/`)
- **Insights** (`/ontology/insights/`)
- Caption: "ONTOLOGY · {N} nodes · {E} relations" (visual cue same data)

#### Page header
- Title + info tooltip · counts
- **Search button** (`⌘K`) — node-only `OntologyGlobalSearchAdapter`
- **All / 전체 button** (R4 cut H, `⇧⌘K`) — `MountedGlobalSearch`, nodes + projects unified
- **Builder CTA** (indigo solid) → `/ontology/edit/`
- Stats strip: tree nodes · total relations · evidence documents

#### Left: tree view (`OntologyTreeView`)
- Hierarchical project → domain → capability → element (document kind excluded as evidence)
- Click row → select node (also updates URL `?node=…`)

#### Right: detail panel (`NodeDetailPanel`)
- Kind badge + title · `ManualSourceChip` (currently no-op — all sources `manual`)
- Copy node link button
- Stats: linked projects, evidence count
- Ego graph (1-hop default, 2-hop toggle radio), circular SVG
- Neighbors list (6 preview, expandable; missing stubs amber)
- Related docs list (6 preview, expandable)
- CTAs: link to `/project/<slug>` if project, amber stub warning if unknown kind

#### Empty state (no nodes)
- Mode-aware copy (local 2-step / static 3-step)
- Local: copyable frontmatter YAML snippet
- Buttons: Open Vault / Go to Builder

#### Keyboard
- `⌘K` toggle node search · `⇧⌘K` toggle global search · `Esc` close detail · `?` shortcut sheet

---

### `/ontology/insights` — Insights

6 panels (R3 cut E reordered + folded cross-project):

1. **Kind distribution** (kind → count bars)
2. **Edge type distribution** (canonical order — contains, belongs_to, depends_on, …) + inline caption with cross-project edge count + ratio (folded from removed Cross-project Panel)
3. **Per-project distribution** (top 12 by total nodes)
4. **Hub nodes** (top 10 by degree, click → `/ontology/?node=…`)
5. **Recent nodes** (vault sentinel preview, click → deeplink)
6. **Orphans** (R3 cut E made clickable Links, amber accent, top 10 + "+N more")

Empty state: blue link to `/docs` (open vault).

---

### `/ontology/edit` — Builder (xyflow ERD canvas)

#### Layout (md+)
- Left palette (280 px, collapsible) · Center canvas (flex-1) · Right inspector (360 px, collapsible)
- Mobile (<md): fallback alert + links to `/ontology` and `/topology`

#### Left palette (`OntologyKindPalette`)
- 4 kind buttons: Project / Domain / Capability / Element
- Click or `P` `D` `C` `E` → add ephemeral node
- Collapsed state: 44 px, icon-only (localStorage)

#### Center canvas (`ReactFlow` + dagre/force layout)
- Layout modes: Hierarchy (dagre LR, default) / Force (FA2)
- Auto-layout button (Wand2 icon) ignores frontmatter `canvasPosition` (in-memory only)
- Vault nodes: draggable, drag-stop patches `canvasPosition`
- Ephemeral nodes: in-memory until save
- MiniMap (bottom-right)
- Connection preview: indigo dashed bezier
- **Edge persistence**:
  - vault↔vault drag → auto-persist to source frontmatter array (R4 verified)
  - ephemeral endpoint drag → amber dashed `EphemeralEdge` with center "Save" chip (R4 cut I, R5 cut N validates title before persist to prevent `untitled.md` pollution)

#### Right inspector
- **Ephemeral node**: name input (auto-focus + select) · slug preview · coordinate display · Save button (`Enter`, disabled if title empty/placeholder)
- **Vault node**: title rename (Enter to commit) · slug (read-only) · vault/dogfood badge · backlinks chips
- Editable (when canEdit + live vault):
  - Literal editors: domain (single-line, blur to commit), description (multiline)
  - Array editors: capabilities / elements / dependencies / relates — chip list with `✕` to remove, input + Add to append, newly added items 1.2 s amber highlight
- Delete button (vault node only) → `BlastRadiusConfirm` modal (backlinks shown)

#### Header toolbar
- Help tooltip (palette + drag-to-connect + Save chip onboarding)
- Export buttons (only if nodes/edges exist): Markdown · JSON-LD · GraphML
- Layout toggle: Hierarchy / Force radio
- Auto-layout button
- Fullscreen toggle (`F`)
- Clear ephemeral button (two-step confirm, 3 s timeout)

#### `BuilderOnboarding` (when canvas empty)
- 3-step coach mark: Palette → Connect → Save chip
- "Don't show again" toggle (localStorage)

#### Keyboard shortcuts
| Key | Action |
|---|---|
| `P` / `N` | Add Project |
| `D` | Add Domain |
| `C` | Add Capability |
| `E` | Add Element |
| `F` | Toggle fullscreen |
| `Del` / `Backspace` | Delete selected ephemeral (vault nodes protected) |
| `Esc` | Clear selection or exit fullscreen |
| `Enter` (inspector input) | Save ephemeral node / commit vault rename |

---

### `/projects` — Project list

#### Header
- Eyebrow + H1 with dynamic count badge `{filtered}/{total}`

#### Filters (URL-synced: `?q`, `?cat`, `?st`, `?limit`)
- Full-text search (name / slug / description / tags / stack), Esc clears
- Phase chips (category, with live counts) — toggle
- Status chips (with live counts) — toggle
- "Clear all filters" button

#### Cards (3 col lg / 2 col md / 1 col sm, sorted by `updatedAt` desc, 60-page paginated)
- Title + 2-line description clamp · 3 quick facts (Phase / Status / Dependency count) · slug · ontology count badge (when > 0)
- "See details" + "View topology" buttons (overlay over stretched card link)

#### Empty states
- No projects at all → `ProjectQuickCreatePanel` inline + fallback buttons
- No results after filter → "Clear search" + "View full topology" link
- Static mode (no vault) → "To workspace map" instead of create

---

### `/project/[slug]` — Project detail (with inline edit)

#### Header
- Breadcrumb: Home → Projects → `{Name|Slug}`
- Right actions: docs vault link · copy link · quick-edit menu (mobile)

#### Inline-editable fields (when `canManageProject`)
- name · description · dependencies (picker with cycle check) · tags · stack · links (label|URL multiline)

#### Read-only display
- nameEn · status (with dot color) · category · owner (fallback "Shared internal system") · progress % · slug · updatedAt
- "uncategorized" / "active" fallback labels via taxonomy

#### Featured sections
- **Local topology** — Sigma 1-hop neighbors graph (520 px, minimal mode)
- **Project info card** (when `project.detail` markdown exists)
- **Integrity issues** card (yellow border, only when issues > 0)
- **Screenshots** collapsible (only when count > 0)
- **Linked projects** card (next-project + neighbors map, dedup'd)
- **Ontology overview** card (client-only fetch)

#### "More info" collapsible
- Links · Tags · Stack · Basic info (category / slug / updatedAt)

#### Mobile
- Quick-edit panel (`ProjectQuickEditPanel`, hamburger menu)
- Copy link + topology view buttons in bottom bar

#### Empty / not-found
- Invalid slug → "Project not found" panel + back-to-workspace button
- Loading → "Loading project data" gray panel

---

### `/project/[slug]/edit` and `/project/new` — Full editor

`ProjectForm` (4 collapsible sections + sticky save bar):

1. **Basics** (always open) — slug (disabled in edit, auto-slugify in create) · name · nameEn · category (taxonomy select) · status (taxonomy select)
2. **Story** (collapsible) — description (required) · detail (markdown) · tags CSV · stack CSV · linksText (multiline `label|URL`)
3. **Network** (collapsible, collapsed in create) — dependencies picker with cycle check (suggestions from description/detail text)
4. **Operations** (collapsible, collapsed in create) — startedAt · launchedAt (date order validated) · owner · icon · progress · `isHub` checkbox

#### Validation (`schema.ts`)
- slug: `/^[\p{L}\p{N}-]+$/u` (Unicode letters/numbers/hyphen)
- name + description required (min 1)
- linksText: each line `label|https://…`, http(s) only
- dates: ISO 8601 YYYY-MM-DD, `launchedAt >= startedAt`

#### Actions
- Save & continue · Save & return · Cancel (with dirty-state guard via `beforeunload` + router intercept)
- Delete (edit-only, bottom-left)
- Form nav pills jump to sections
- Top + bottom sticky save bar

#### Mobile preview panel (sidebar, collapsible <lg)
- Live preview `ProjectCard` · completeness % · public status · change summary (max 4 items)

#### Note
- `screenshots` field exists in schema but no uploader UI (markdown/vault assets only — codex Round 6 finding)
- Folder-topology scaffold path (`/docs view: folder-topology`) creates `projects/{slug}.md` without `description` (different contract from this canonical form, by-design — Round 6 skip)

---

### `/project/new` — Create

Same `ProjectForm` minus existing-project context.
- Submit buttons: "Create & continue" / "Create & return"
- Tips panel (easiest path: name → category/status → description, then save)
- Quick-create modal also available in `/projects` list (`ProjectQuickCreatePanel`, reused)

### `/project/fallback` — Static-export fallback

Used when a non-existent slug is hit in static export. Redirects or shows "not found" panel.

---

## 3. MCP server (23 tools)

Run via `pnpm exec node mcp/src/index.js` (registered in user's `.mcp.json`). AI agents read/write the same vault as humans.

**R14 — workflow automation** (Claude Code-specific):

| Trigger | What | Where |
|---|---|---|
| **SessionStart hook** (implicit) | Vault census (kind counts + first 8 entries) auto-injected into agent's system context on session start | `.claude/hooks/inject-ontology-summary.sh` — silent in repos without a vault |
| **`/ontology-bootstrap` skill** (cold start) | Empty vault → first 5–15 nodes from code structure. `analyze_repo_structure` side-effect-zero → user picks candidates → land via batch writers | `.claude/skills/ontology-bootstrap/SKILL.md` |
| **`/ontology-sync` skill** (code change) | "I'm done with this task — please sync the ontology now" loop. git diff + context → MCP write tools | `.claude/skills/ontology-sync/SKILL.md` |
| **`/ontology-extract` skill** (prose ingress, R+) | User shares prose (meeting note / PR / RFC / Notion paragraph) → `find_evidence` + `similar_nodes` cross-check → candidate table → user picks → land. LLM hallucination guard via prose-source citation in body | `.claude/skills/ontology-extract/SKILL.md` |
| **`mcp__oh-my-ontology__*` `instructions` field** (R13 v0.7.1) | Server's initialize response carries kind hierarchy, first-time workflow, write safety patterns — every connecting agent gets the discipline without trial-and-error | `mcp/src/index.js` |
| **`.omotignore`** (R+) | Vault-root gitignore-style file. Patterns match `materialize_external_element` refs in `growth_plan` / `maintenance_plan` and skip them. Intentional external code (e.g. `src/**`, `cli/**`) stops surfacing as noise. `externalElementRefsIgnored` count exposed for transparency | `docs/ontology/.omotignore` (dogfood example) · `mcp/src/omot-ignore.mjs` |

R14 also unified `add_concept` / CLI `add` / CLI `import` to a single per-kind frontmatter schema (`mcp/src/schema.mjs` ↔ `cli/src/lib/schema.mjs`) — three entry points, one shape.

**R14 — vault live updates** (`/topology` + all pages):

- **5s polling** (visible-only) — `useLocalVault` fingerprint check while tab visible
- **Graph diff pulse** — newly appearing slugs amber-pulse for 5s on `/topology`
- **Toasts** — `Added: <slug>` (info) / `Edited: <slug>` (success, mtime change) on every page
- Effect: IDE / AI agent / CLI 변경이 웹 탭 *focus 안 해도* ~5s 안에 그래프 + toast.

#### Read tools (15)
1. **list_concepts** `{ kind?, domain?, since?, summary?, limit? }` — every node, optional filters, mtime, and summary preview
2. **get_concept** `{ slug }` — full detail: frontmatter + prose excerpt + graph neighbors / `outgoingEdges[]` + `mtime` (ms; **R11** caller가 후속 patch/delete 의 `expected_mtime` 으로 전달하면 외부 변경 감지); warnings include frontmatter issues and dangling outgoing graph references
3. **get_concepts** `{ slugs }` — batch read (max 50), order-preserving partial results with the same per-node warnings
4. **find_evidence** `{ title }` — partial-match across title / capabilities / elements / body, with `domain`, `mtime`, and prose excerpt
5. **find_backlinks** `{ slug }` — every node referencing target (frontmatter arrays + wikilinks/markdown)
6. **find_neighbors** `{ slug, direction?, types?, includeNodes?, limit? }` — one-hop local graph around a node, with canonical incoming/outgoing `edges[]` and neighbor summaries; public relation type aliases like `depends_on` are normalized to stored graph keys
7. **find_path** `{ from, to, maxHops? }` — shortest undirected BFS across graph frontmatter, including `domains` / `domain` containment (default 5 hops, includes `edges[via]`)
8. **list_kinds** — vault kind census `{ total, byKind: { capability: N, … } }`
9. **find_orphans** `{ kind?, excludeKinds? }` — isolated nodes across graph frontmatter, including `domains` / `domain` containment (defaults exclude `vault-readme`)
10. **query_concepts** `{ filter, limit? }` — typed filter DSL with AND/OR/NOT on `kind` / `domain` / `slug` / `title` / `has(arrayKey)`
11. **compile_ontology** `{ includeIndexes? }` — deterministic graph artifact with canonical `nodes[]`, `edges[]`, aliases, issues, graph-array canonicalization actions, stable semantic `graphHash`, `maxMtime`, and optional query indexes
12. **query_ontology** `{ operation, ... }` — graph-engine query over the compiled artifact (`neighbors`, `path`, `all_paths`, `query_plan`, `centrality`, `communities`, `similar_nodes`, `explain_relation`, `reachability`, `pattern_walk`, `impact`, `blast_radius`, `subgraph`, `overview`, `schema`, `facets`, `match_nodes`, `match_edges`, `node_profile`, `domain_profile`, `domain_matrix`, `project_scope`, `project_map`, `relation_check`, `components`, `lineage`, `containment_tree`, `cycles`, `topological_order`, `recommend_relations`, `growth_plan`, `maintenance_plan`, `workspace_brief`, `health`) for graph-database-like answers without pulling the full compile payload. `maintenance_plan` actions include stable `id`, cursor resume via `afterActionId`, executable graph-array canonicalization, `byKind` action breakdown, `executable`, `nextExecutableAction`, `nextReviewAction`, plus `executableOnly` / `phases` / `severities` / `kinds` filters.
13. **validate_vault** — whole-vault health check with per-file issues and grouped summary, including non-canonical graph arrays and dangling graph references
14. **analyze_repo_structure** `{ repoRoot? }` — side-effect-free bootstrap candidates from package / README / source layout
15. **infer_imports** `{ repoRoot? }` — side-effect-free TS/JS import graph → dependency edge candidates

#### Write tools (8)
1. **add_concept** `{ slug, kind, title, domain?, capabilities?, elements?, body? }` — create new `.md`; graph arrays are trimmed, deduped, and sorted on write (throws on existing slug); changed writes return compact `postWriteMaintenance`
   - **R6 validation**: title must be non-empty trimmed string (`isValidVaultTitle`)
2. **add_concepts** `{ concepts }` — batch create nodes (max 50), order-preserving partial results; changed batches return compact `postWriteMaintenance` for the final graph
3. **patch_concept** `{ slug, frontmatter?, body?, expected_mtime? }` — update existing (`null` value deletes key); graph arrays are trimmed, deduped, and sorted on patch; changed writes return compact `postWriteMaintenance`
    - **R6 validation**: rejects `title: null` and `title: ""`
    - **R11 conflict guard**: optional `expected_mtime` (from get_concept response). Throws `VaultConflictError` if file mtime differs at write time — caller re-reads and retries.
4. **add_relation** `{ from, to, type }` — append to source frontmatter graph key; changed writes return compact `postWriteMaintenance`
    - type enum: `depends_on` (→ `dependencies`) / `relates` / `contains` / `describes` / `domains` / `capabilities` / `elements` / `domain`
    - **R7 validation**: both `from` AND `to` slug must exist in vault (`vaultSlugExists`)
    - Unique tail aliases and frontmatter `slug:` aliases are resolved to canonical file slugs before write
    - Idempotent: duplicate returns `{ alreadyExists: true }`
5. **add_relations** `{ relations }` — batch edge writer (max 50), idempotent per row; stored relation arrays are deduped and sorted as canonical graph sets; changed batches return compact `postWriteMaintenance` for the final graph
6. **delete_concept** `{ slug, confirm?, force?, expected_mtime? }` — permanent delete; confirmed deletes return compact `postWriteMaintenance`
    - `confirm: false` (dry-run with backlinks preview) / `true` (actual)
    - `force: false` (throw if backlinks exist) / `true` (delete anyway)
    - **R11 conflict guard**: optional `expected_mtime`
7. **rename_concept** `{ oldSlug, newSlug, confirm?, overwrite? }` — **R11** atomic graph-level rename
    - Moves the .md file, updates the moved file's `slug:` key, rewrites every backlink (frontmatter array entries, inline string keys like `domain`, body links `[[oldSlug]]` / `(oldSlug.md)`)
    - Tail-only references (`mcp-server` for `capabilities/mcp-server`) also redirected to the new tail
    - `confirm: false` (dry-run with full update preview) / `true` (actual)
    - Confirmed renames return compact `postWriteMaintenance`
    - Replaces the manual `find_backlinks` + N `patch_concept` loop
8. **merge_concepts** `{ fromSlug, intoSlug, confirm? }` — **R11** atomic graph-level merge
    - Redirects every backlink `fromSlug` → `intoSlug`, then deletes `fromSlug.md`
    - `intoSlug` node preserved as-is (frontmatter / body not auto-merged — use `patch_concept` after to combine)
    - `confirm: false` (dry-run) / `true` (actual)
    - Confirmed merges return compact `postWriteMaintenance`

---

## 4. Cross-cutting UI

### `OperationsNav` (top, always visible)
- Sticky header: 3 nav items (Docs / Ontology / Topology)
- Right: `ModeBadge` (vault folder name + doc count chip OR demo chip with picker link) · `LocaleSwitch` · `ThemeToggle`
- Active detection by pathname prefix
- Sub-nav row appears on `/ontology/*` (R3 always visible)

### `BottomTabBar` (mobile only, `md:` hidden)
- 4 tabs: Ontology (`/`, `/ontology`) · Topology (`/topology`) · Projects (`/projects` or `/project`) · Docs (`/docs`)
- Min height 56 px (safe-area)

### Search palettes (separate by design — R5 skip merge)
- **`⌘K` `SearchPalette`** — projects-focused fuzzy search + top vault docs match (3) + recent (5) + Layer filter (All / Hub / Node)
- **`⇧⌘K` `MountedGlobalSearch`** — ontology nodes + projects unified (`cmdk`-based, kind/project filter chips, virtualized)
- Both palettes share keyboard: `↑↓` navigate · `↵` select · `Esc` close

### `ShortcutSheet` (`?` to open)
- 10 sections grouped: navigation · topology · search palette · hub rail · docs palette · docs graph · docs source · docs actions · tour · portfolio
- 2-column grid on sm+, focus trap, `Esc` closes

### `LocaleSwitch`
- Two-button toggle EN / KO
- Replaces locale prefix in pathname; preserves rest (NOT query params — Scenario 9 finding, R9 deferred)
- localStorage `omot:locale`

### `ThemeToggle`
- Moon / Sun icon toggle
- SSR-safe (mount-state placeholder until first useEffect)
- `html[data-theme]` attribute

---

## 5. Keyboard shortcuts (consolidated)

| Key | Surface | Action |
|---|---|---|
| `⌘K` | Home / Topology / Ontology / Projects / Docs | Project / node search palette |
| `⇧⌘K` | Home / Topology / Ontology | Global search (nodes + projects) |
| `D` | Home / Topology | Toggle docs drawer |
| `?` | Home / Topology / Builder | Toggle shortcut sheet |
| `/` | Sigma controls (when controls expanded) | Focus search input |
| `0`–`6` | Sigma controls | Set depth filter |
| `Esc` | All | Layered close (drawer / palette / local graph) |
| `P` / `N` | Builder | Add Project node |
| `D` | Builder | Add Domain node |
| `C` | Builder | Add Capability node |
| `E` | Builder | Add Element node |
| `F` | Builder | Toggle fullscreen |
| `Del` / `Backspace` | Builder | Delete selected ephemeral |
| `Enter` | Builder inspector | Save ephemeral / commit vault rename |
| `↑↓` | Hub rail | Cycle hubs |
| `Home` / `End` | Hub rail | First / last hub |
| `Tab` (in palette) | Docs palette | Cycle mode (`""` → `>` → `#`) |
| `⌘S` | Docs editor | Save |
| `⌘B` / `⌘I` | Docs editor | Bold / italic wrap |
| `⌘K` (in editor, no `Shift`) | Docs editor | Insert link |

---

## 6. What was removed / added (Rounds 1–15)

For full reasoning see `docs/CHANGELOG.md`. High-level:

- **Round 1-9** (2026-04~05 surface diet + robustness) — presentation mode · Relationship Radar · audience toggle · `/ontology/relations` route · landing CTA swap · `LocalVaultProvider` SSoT · vault error banner · permission state sync. Earlier auth (R10) and cloud (R10b) surface permanently removed.
- **Round 10 / 10b** — `/login` / `/signup` / `/account` / `/reset-password` / `/settings/*` / `/admin/*` / `/review/*` / `/diagnostics/*` / `/knowledge/*` 모두 제거. Firebase / Firestore / Auth / Storage SDKs, screenshot uploader, manual node/edge cloud modal — pure local-first 회귀.
- **Round 11** — `pnpm vault:validate` / `vault:migrate` 신규. MCP v0.7.0 — 14 tools (8 read + 6 write, `rename_concept` / `merge_concepts` 추가). 3-way frontmatter parser contract. mtime 기반 conflict guard.
- **Round 12** — primary audience = developer + AI agent (PM-primary 결정 reverted). CLI 4 명령 추가 (`list / validate / add / find` — `init` 외). Cross-package contract 4-way. dogfood orphan 8 → 1.
- **Round 13** — AI agent quality 첫 측정 (Claude Code + Codex, n=2). MCP `instructions` field (v0.7.1). VSCode plugin v0.1.0 → v0.9.0 (R15 에서 제거).
- **Round 14** — *AI agent ↔ vault 자동 sync*. Web 즉시 반영 4 단계 (5s polling / graph pulse / added toast / modified toast). Frontmatter schema 양식 (3 진입점 동기화). CLI `import` 명령 (외부 .md 정규화). `/ontology-sync` skill + AGENTS read-while-coding 룰. SessionStart hook (vault census 자동 inject).
- **Round 15** — VSCode plugin 제거 (4 surface → 3). CLI `init` 의 mcp 등록 마찰 1 step 제거 (`.mcp.json` 자체 생성, cwd + vault 양쪽). `add` / `import` 의 `--auto-prefix` default on (starter layout 일관). `--raw-slug` opt-out.

---

## 7. Deferred (future rounds — wait-for-signal)

- `/ontology/edit` builder reconsideration — UX persona walkthrough (R3) found dev/PM/AI all skip. design call needed. (R11 #25 PM-drop 후 재평가 — dev 가 frontmatter 직접 편집이 더 빠르면 builder 의 ROI 의문)
- ~~Phase 4 PM polish~~ — **dropped** (R11 #25, PRODUCT-DIRECTION v3). PM-primary 결정 reverted.
- Search palette unification (`⌘K` + `⇧⌘K`) — R5 skip: not duplicates, would require ranking/section redesign.
- LocalVaultPicker hoist out of dropdown — R5 skip: dead-end already closed by R4 J.
- WebGL context-loss `ErrorBoundary` (Scenario 10) — R9 defer: theoretical, no reports.
- Locale switch query-param preservation (Scenario 9) — R9 defer: low frequency.
- MCP `add_concept` project minimal-input parity with `ProjectForm` — R6 skip: AI agent incremental stub by-design.
- folder-topology project scaffold without description — R6 skip: scaffold ≠ canonical authoring (different contract).

---

## 8. Source-of-truth files

When this doc and code disagree, code wins. Trust:
- `package.json`
- `next.config.ts`
- `app/[locale]/layout.tsx`

For per-route truth: open the corresponding `src/views/*` file. Each route has comments explaining mode-aware fallbacks, deep-link sync, and edge cases.
