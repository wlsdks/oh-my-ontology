# Development Checks

This page keeps the maintainer-only command matrix out of the public README.
Use it when changing `mcp/`, `cli/`, package manifests, release scripts, or the
dogfood ontology contract.

## Everyday Checks

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm test:run
pnpm build
pnpm bundle:check
```

## Vault Checks

```bash
pnpm vault:validate              # frontmatter integrity audit
pnpm vault:validate /your/vault  # validate any folder, not just dogfood
pnpm vault:validate -- --help    # print validator usage without scanning
pnpm test:vault:validate         # focused validator CLI argument contract
pnpm vault:audit                 # capability/element path drift guard
pnpm test:vault:audit            # focused vault audit CLI argument contract
pnpm vault:migrate --list        # see registered schema migrations
pnpm vault:migrate <id>          # dry-run a migration
pnpm vault:migrate <id> --write  # apply a migration to disk
```

`health --json` and `workspace-brief --json` validate the diagnosis payload
shape before writing machine output. Workspace next actions need a valid
severity. Non-JSON `workspace-brief` also prints a `GROWTH` line with
`actions`, `relations`, `dangling`, `external`, and `ignoredExternal` counts.
Both commands forward focused diagnosis tuning flags to MCP `query_ontology`,
including `--dependency-types A,B`, `--component-types A,B`,
`--component-limit N`, and `--node-limit N`.

## Package / MCP Release Checks

```bash
pnpm package:check              # MCP/CLI package files contract + CLI lib + docs self-test
pnpm test:cli:lib               # focused CLI shared helper unit contracts
pnpm test:cli:mcp-call          # narrow CLI MCP wrapper parser/spawn contracts
pnpm test:contracts             # focused cross-package contract tests
pnpm test:mcp:docs              # focused README + dogfood ontology docs contract
pnpm test:mcp:dogfood           # focused structuredContent/compile/tools-list/row-label/vault-warning/health/sample-shape/maintenance work-queue+formatter/initialize+batch-relation/destructive dry-run/help/argument/timeout/strict relation/closest-value/stderr checks
pnpm test:mcp:dogfood:timeout   # narrow dogfood argument/timeout/help retry diagnostics
pnpm test:mcp:maintenance       # narrow maintenance_plan filter/cursor/work-queue+formatter gates
pnpm test:mcp:package           # focused MCP/CLI package-script/entrypoint/dependency/tarball contract checks
pnpm test:mcp:suggestions       # focused enum/argument suggestion checks
pnpm test:mcp:verify            # focused MCP verify helper checks, including tool inventory names
pnpm test:mcp:verify:first-contact # narrow MCP verify first-contact initialize-safety-recovery/write-safety/health-summary/advisory/read/sample gates
pnpm test:mcp:verify:timeout    # narrow MCP verify timeout/startup/help diagnostics
pnpm dogfood:compile            # quick compile_ontology summary over docs/ontology
pnpm dogfood:health             # quick health gate over docs/ontology
pnpm dogfood:brief              # quick workspace_brief health snapshot over docs/ontology
pnpm dogfood:verify             # root checkout installed-style verify over docs/ontology
pnpm dogfood:test               # full dogfood helper regression suite when focused checks are not enough
pnpm dogfood:walk               # actual MCP stdio walk over this repo's ontology
pnpm dogfood:help               # print dogfood usage without starting MCP
pnpm dogfood:walk -- --help     # print dogfood usage without starting MCP
pnpm cli:mcp-verify docs/ontology --timeout-ms 15000 # root checkout dogfood verify
pnpm cli:mcp-verify -- --help   # root checkout shortcut for installed mcp-verify help scope
OMOT_DOGFOOD_TIMEOUT_MS=12000 pnpm dogfood:walk
OMOT_TEST_NAME_PATTERN="mcp-verify" pnpm integration:cli
pnpm integration:cli:mcp-verify
pnpm integration:cli:maintenance # narrow CLI maintenance command integration gates
OMOT_TEST_NAME_PATTERN="tools/list|initialize" pnpm integration:mcp
pnpm integration:mcp:readme
pnpm exec node --test --test-name-pattern "README first exploration" mcp/src/integration.test.mjs
pnpm smoke:packed-cli
cd mcp && OMOT_VAULT=../docs/ontology npm run verify
cd mcp && npm run verify -- ../docs/ontology
cd mcp && npm run verify -- --vault ../docs/ontology
cd mcp && npm run verify -- ../docs/ontology --timeout-ms 15000
```

Use these when changing MCP, CLI, package, or release behavior. Prefer focused
`test:mcp:*` scripts before escalating to broader checks. Use `pnpm dogfood:test` only when the dogfood helper
itself needs the full regression suite beyond `test:mcp:dogfood`.
Use the dogfood-helper checks when the live MCP walk or its retry diagnostics
change.

`integration:cli` and `integration:mcp` accept `OMOT_TEST_NAME_PATTERN`, so you
can run only the spawn-heavy integration cases touched by a small change. When
you need Node's `--test-name-pattern`, call `pnpm exec node --test --test-name-pattern ... <file>`; do not append it after `pnpm integration:* --`,
because pnpm forwards `--` as a test file.

`test:cli:mcp-call`, `integration:cli:mcp-verify`,
`integration:cli:maintenance`, and `integration:mcp:readme` cover the common
CLI MCP wrapper, install verification, CLI maintenance work-queue, and
first-contact read-only checks. `cli:mcp-verify` is a source-checkout shortcut for the CLI wrapper.

Use `pnpm dogfood:compile` when you only need the current dogfood vault
`compile_ontology` summary, `pnpm dogfood:health` when you need the
fail-closed health JSON gate, or `pnpm dogfood:brief` when you need the
`workspace_brief` JSON snapshot before choosing the next focused gate.
`dogfood:compile` is the fastest repeatable compiler summary for the dogfood vault. `dogfood:health` is
the fastest repeatable fail-closed health gate for the dogfood vault.
`dogfood:brief` is the fastest repeatable first-contact snapshot for the dogfood vault. `dogfood:verify`
runs the full installed-style dogfood vault gate. `dogfood:test` is the full dogfood helper regression suite to reserve for helper-level
changes that outgrow `test:mcp:dogfood`.

`pnpm cli:mcp-verify docs/ontology --timeout-ms 15000` runs the same full
verify against this repo's dogfood vault from the repo root. Use
`pnpm cli:mcp-verify -- --help` only for help output; vault arguments are passed
without the extra `--`.

`npm run verify` calls `get_concepts` with discovered slugs plus one missing
slug, then runs `workspace_brief`, tuned `workspace_brief`, `health`, and tuned `health`. That covers the batch-read partial-row contract and first-contact
diagnosis an AI agent should run. It also checks `overview` and `project_map`
`query_plan` targets plus actual `neighbors`, node to project `path`, and
`project_scope` calls. Project-less vaults skip only the containment-specific
`project_scope` smoke, and empty vaults skip node-targeted graph smoke until a
first node exists.

`smoke:packed-cli` runs the installed CLI package `npm test`, checks installed
`mcp-verify --help`, and verifies project-less and empty-vault paths. Its scope
includes graph-query, destructive dry-run, post-write maintenance schema,
strict argument / enum rejection, annotations, write relation enums, and health
tuning schema scope. It also covers graph-query, destructive dry-run,
post-write maintenance schema, strict argument / enum, annotation, write
relation enum, and health tuning smoke scope without assuming every valid vault
has containment roots. It creates a dependency-cycle vault and checks installed
`workspace-brief --json` exits 1 on fail-severity nextActions.

For local CLI gates, `compile --json` exits 1 on unresolved graph references,
flushes large raw artifacts safely through stdout pipes, `cycles --json` exits
1 on dependency cycles, and `path --json` exits 1 when `found:false`.

The graph diagnostic exit contract is fail-closed: malformed `compile`,
`cycles`, `path`, `health`, or `workspace-brief` payloads are treated as command
failures instead of clean vaults. For `health --json` and
`workspace-brief --json`, top-level diagnosis `status` must be `healthy` or
`needs_attention`. `health` and `workspace-brief` also accept focused diagnosis
tuning flags such as `--dependency-types A,B`, `--component-types A,B`,
`--component-limit N`, and `--node-limit N`, forwarding them to MCP
`query_ontology`.

`dogfood:walk` runs that diagnosis plus graph lookup tasks against this repo's
own `docs/ontology` vault and exits non-zero if core MCP responses, strict
unknown-argument and invalid-enum rejection, `get_concepts` success/partial
rows, path edge check, vault warnings, `validate_vault` problem files,
`workspace_brief.nextActions`, `workspace_brief.nextActions[].sample`
executable shapes, `workspace_brief.health.checks`, `health`, or tuned
`workspace_brief` / tuned `health` gates regress. Set
`OMOT_DOGFOOD_TIMEOUT_MS=12000 pnpm dogfood:walk` for slower local filesystems;
the value must be a positive integer in milliseconds, and `--help` / timeout
failures print the same retry shape.

For `npm run verify` / `mcp-verify` timeout mistakes, the error reports the
received value or the true timeout, plus a concrete retry example such as
`npm run verify -- --timeout-ms 15000`, so agents can self-correct without
guessing the accepted format. Direct verifier and CLI wrapper retry hints
preserve an explicit vault, for example
`npm run verify -- --vault <path> --timeout-ms 15000` or
`oh-my-ontology mcp-verify --vault <path> --timeout-ms 15000`.
