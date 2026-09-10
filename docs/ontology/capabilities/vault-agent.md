---
uid: a81da7e2-8ff6-46c9-a0aa-27b2948bc7b3
slug: capabilities/vault-agent
kind: capability
title: "Agent Connect & Vault Access"
display_ko: 에이전트 연결과 볼트 접근
domain: domains/agent-integration
elements: [elements/agents-destination, elements/vault-agent-panel]
path: src/features/vault-agent
created_by: human
relation_notes: { elements/agents-destination: "Attaching an agent to this folder is an operational task with progress, so the connect flow needs one address where a person installs a tool, runs the eight-step connection check, and repairs what it finds; that work sat in three separate places until this destination gathered it.", elements/vault-agent-panel: "The rule that an answer only counts when it cites actual vault reads is worth nothing unless a person can see those reads, so this panel is the surface where the agent's tool calls, audit logs, timeouts, and mandatory-read failures are judged before its answer is trusted." }
---

## Definition

The app's connect flow and MCP surface that allow AI agents to discover, authenticate, read, and write the vault. Interactive agents within the app collect actual vault tool evidence. Activated only when both absolute paths and read manifests are present, ensuring concepts on screen, text read by models, and audit logs in the vault point to a single source. Local runners apply limited read order and round-trip time limits. One correction is issued if any of mandatory reads, detailed payload remaining exact citations, or Korean responses to Korean questions are omitted; answers not followed on the second attempt are not loaded for the user. Structure audits verify from selecting `domain` candidates after census up to argument contracts reading details of all 8 max exact slugs. The model rejects responses if it synthesizes capabilities/elements as non-existent when only one project root is selected or census confirms existence. Final synthesis preserves incompleteness of the verified scope without using count, fan-out, recommended node counts, or bridge evidence as defects. If batch detail reading exceeds character limits, instead of keeping only the first line, all candidates are first compressed into the same shape of definition excerpt, relationship count, and resolved neighbors, recording only remaining slugs and body text characters in the actual payload as the read scope. Each `*Info` field preserves what was truncated and requires a single concept re-read before editing. This surface is for vault-only curators who cannot see source code, so it does not directly create or edit project's `## Competency answers`. System prompt, write-intent, and final apply boundaries all prevent this, passing source-backed credentials to the repository-reading Atlas MCP builder.


## Constraints: Client config and native vault writes

The agent config state in App Settings counts only two actual client configs, not disguising example templates as connections. Source-checkout and app-bundled launch shape, current vault coordinates
must match to be ready, and live stdio connection and tool inventory are proven by separate `mcp-verify`.
Native vault writes retain Unix's piece-by-piece no-follow directory FD traversal, private-new-inode
checks, and atomic rename. Thus, a parent name changing to an external symbolic link after inspection
does not redirect a current vault write outside its opened directory. Windows reparse-point races are still
unproven and provide no guarantee beyond static link checks.

## Library Compile correction context

Local Compile has a separate source-read, existing-Wiki-read and page-proposal catalogue. It returns existing Markdown as untrusted context in bounded sequential chunks, and requires a complete-read receipt plus an exact current text/timestamp match before replacing a page. Current raw-source reads alone supply citation support; prior human notes are attributed context, not source proof or instructions. The same turn budget includes both source and Wiki text. A later refused attempt invalidates an earlier ready proposal for the same identifiable page.

The local consent card exposes the exact proposed and previous Markdown. Its current work view is independent of first-run guidance and the selected document; the narrow index stands aside, and closing the work view returns to the previous selection. Before applying selected replacements, the hook rechecks their prior text and fresh file timestamps; a detected correction stops those selected writes. Reading and receipts do not establish semantic preservation or human approval, and the sequential write path is not a transaction. The Library still lets the person choose its separate Claude Code or Codex ACP route; this local read contract does not govern an ACP agent's independent filesystem access.

## Identity Boundary

The interactive vault agent owned here is a provider-neutral loop using a configured model or local runner and calling the vault tool catalogue. Launching Claude Code or Codex over ACP belongs to `capabilities/acp-runtime`. That separate capability records configuration isolation, the requests handled by the app's permission gate, and the limits on an agent's independent filesystem writes. A runtime mode label or app callback is not an operating-system filesystem sandbox.

## Evidence
- src/features/vault-agent: provider-neutral agent loop, tool execution, evidence citation
- src-tauri/src/llm.rs: local/remote transport, audit logs, isolated timeout
- src-tauri/src/llm_audit.rs: log-before-send scheduling/commitment, Unix openat/O_NOFOLLOW·link-count boundaries, vault-specific exclusive locking and reservation tail verification
- src-tauri/src/agent_setup.rs: Unix dirfd/no-follow traversal and atomic replacement helpers shared by native vault writes
- src/widgets/vault-agent-panel: panel where users judge read/failure/proposal
- src/shared/config/mcp-server-launch.ts · src/entities/vault-session/model/use-local-vault.ts
  : shared judgment of JSON/TOML launch shape and vault readiness
- src/widgets/app-settings-menu/ui/VaultAgentSetupPanel.tsx: active config with two
  Settings surfaces that do not hide template roles
- src/features/vault-agent/model/competency-qualification-boundary.ts: shared boundary preventing vault-only
  proposal/apply from bypassing source-backed qualifications
- scripts/deploy-macos-app-local.mjs: local deployment contract dogfooding latest installed app assets

## Confidence
high (0.92)
