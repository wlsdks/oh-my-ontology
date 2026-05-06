---
name: ontology-bootstrap
description: Bootstrap an empty (or near-empty) oh-my-ontology vault from the surrounding codebase — call analyze_repo_structure once, show the proposed candidates, and selectively land the accepted ones via add_concept / add_relation. Use when the user says "이 codebase 분석해줘" / "bootstrap the ontology" / "fill the vault from the code", or when you notice the vault has only the 5 starter nodes and the user has asked you to do anything ontology-related. Skip when the vault already has 20+ user-curated nodes — bootstrap is for the cold-start case only.
---

# /ontology-bootstrap — fill an empty vault from the code

Two facts make a fresh `oh-my-ontology` vault feel empty:

1. `oh-my-ontology init` only seeds 5 *example* nodes — they're meant to be
   replaced, not extended.
2. Hand-authoring the first 20–30 nodes is the heaviest friction in the
   onboarding path (measured: ~25 cli `add` calls in the Paravel real-codebase
   dogfood — `docs/dogfood-paravel-2026-05-06.md`).

This skill closes that gap with **one MCP call + selective writes**.
It is the *cold-start* counterpart to `/ontology-sync` (which keeps an
already-grown vault in step with new code).

## When to run

**Run when** any of these are true:
- the user says "이 codebase 분석해줘" / "bootstrap the ontology" / "fill the vault from this repo" / similar.
- the user asked you to do anything ontology-related and `list_kinds` shows ≤ 5 nodes (only starters).
- the user just ran `oh-my-ontology init` and is asking what to do next.

**Skip when**:
- the vault already has 20+ user-curated nodes — at that point `/ontology-sync` (incremental) is the right tool.
- the user explicitly opted out (e.g. "I'll add nodes by hand") — respect it.
- there is no reachable repository (running in a non-code dogfood folder).

## Workflow

The MCP server (`oh-my-ontology-mcp`, R16 v0.8.0+) exposes
`analyze_repo_structure`. CLI wrapper: `oh-my-ontology analyze [rootPath]`.

### 1. Measure the cold-start (cheap)

```
list_kinds                                # confirm vault is near-empty
```

If `total > 20` and the kinds look user-curated (mix of capability/domain/element with non-`example` slugs), ask before proceeding — the user may want `/ontology-sync` instead.

### 2. Analyze the repo (one call, side effect 0)

```
analyze_repo_structure({ rootPath: "<repo root or '.'>", maxDepth: 2 })
```

The response shape:

```jsonc
{
  "rootPath": "/path/to/repo",
  "framework": "fsd" | "next" | "generic",
  "project":      { "slug": "...", "title": "..." },
  "domains":      [{ "slug", "title", "evidence": { "source": "README.md", "line": 7 } }, …],
  "capabilities": [{ "slug", "title", "evidence": { "source": "src/features/auth" } }, …],
  "elements":     [{ "slug", "title", "evidence": { "source": "src/widgets/header" } }, …],
  "suggestedRelations": [{ "from": "<project>", "to": "<cap>", "type": "contains" }, …],
  "skipped":      [{ "path": "...", "reason": "dotfile/ignore" }, …]
}
```

This call writes **nothing** — it's a pure read. The user is the only writer.

### 3. Show a compact summary to the user

Five lines max — the agent is the curator, not the encyclopedia. Group by kind, count, list the top 3 of each, point at evidence:

```
Detected framework: fsd
project:       my-app — Sample app
domains (3):   authentication · billing · notifications     ← README.md
capabilities (5): auth · billing · user · …                 ← src/features/* + src/entities/*
elements (2):  src/widgets/header · src/views/home          ← FSD widget/view dirs

Land all of these as the ontology bootstrap? (yes / pick / refine)
```

### 4. Hand control to the user

Three branches:

- **yes** — call `add_concept` for project, then each domain, capability, element in that order. Each call is 1 line of args. Then call `add_relation` for each suggested relation (`from → to`, `type: 'contains'` for project→capability). Skip relations whose endpoints didn't make it in.
- **pick** — list the candidates one kind at a time, let the user accept/reject per item, then call `add_concept` only for the accepted ones.
- **refine** — let the user rename slugs / titles inline before any write. Pass the refined version to `add_concept`.

Whatever path is chosen, **the user (via your `add_concept` / `add_relation` calls) is the only writer**. Single source of truth preserved.

### 5. Land + verify

After the writes, finish with one read so the user sees the result:

```
list_kinds                                # new census
list_concepts({ limit: 100 })             # the new vault contents
```

Show the kind census diff in the reply (e.g. *"Vault grew 5 → 18 nodes (+3 domains, +6 capabilities, +4 elements)"*).

## Failure modes

- **`add_concept` throws on existing slug** — the starter `example` nodes (or a previous bootstrap) collided. Use `patch_concept` to overwrite, or pick a different slug.
- **`missing-expected-field` warning** — a capability or element was added without `domain:`. Tolerable for bootstrap (vault still validates), but flag the warnings to the user so they can backfill.
- **MCP unavailable in this session** — fall back to the CLI: `oh-my-ontology analyze .` to get the same JSON, then `oh-my-ontology add <kind> <slug> --title=...` for each accepted candidate.
- **Repo too deep / monorepo** — pass `rootPath` for the relevant subdirectory, or run `analyze` per package and merge results.

## Reply discipline

Five lines or fewer per reply. Show what changed (counts, slugs), not how. Do not paste the full JSON response. The user is reading a chat thread, not API output.

## Cross-references

- **`/ontology-sync`** — the *incremental* counterpart for already-grown vaults.
- **`AGENTS.md` → "Working with the ontology while you code"** — the read-then-write discipline for non-bootstrap tasks.
- **`docs/dogfood-paravel-2026-05-06.md`** — the friction measurement that motivated this skill (25 manual `add` calls in a real codebase).
- **`mcp/README.md` → "Frontmatter shape per kind"** — what fields each kind needs.
