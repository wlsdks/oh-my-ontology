import type { Page } from "@playwright/test";

import { seedFirstRunSeen } from "./first-run-seed";

const VAULT_ROOT = "/Users/probe/Ontology Atlas/launch";

const RUNTIME = {
  id: "claude-code", label: "Claude Agent", description: "", website: null, license: null,
  verified: true, icon: null, brandInk: null, launchKind: "npx", state: "ready",
  cliPath: "/opt/homebrew/bin/claude", adapterPath: null,
  adapterPackage: "@agentclientprotocol/claude-agent-acp", isolated: true,
};

const VAULT_FILES: Record<string, string> = {
  "project.md": "---\nuid: 00000000-0000-4000-8000-000000000001\nkind: project\ntitle: Launch\nslug: launch\n---\n\n# Launch\n",
  "sources/architecture.docx": "Architecture evidence\n",
  "sources/design-system.pdf": "Design system evidence\n",
  "sources/features.html": "<html><body>Features evidence</body></html>\n",
  "sources/release-dates.csv": "date,release\n2026-09-08,Launch\n",
};

const ARCHITECTURE_PAGE = "---\ntitle: Architecture evidence\ncreated_by: agent:claude-code\ncompiled_at: 2026-09-08T00:00:00.000Z\nsources:\n  - sources/architecture.docx\nsource_hash:\n  sources/architecture.docx: 0000000000000000000000000000000000000000000000000000000000000000\nstatus: draft\nsummary: Architecture evidence.\n---\n\n## Summary\n\nArchitecture evidence captured by the ACP harness.\n\n## Facts\n\n- The architecture source is available. [[src:sources/architecture.docx#p1]]\n\n## Decisions\n\n## Open questions\n\n## Not in sources\n";

export type LibraryWorkScenario = "successful-write" | "failed-unknown-target";

export interface LibraryWorkHarnessSnapshot {
  files: Record<string, string>;
  writes: Array<{ relativePath: string; content: string; mtime: number }>;
  calls: Array<{ method: string; params?: unknown }>;
  events: Array<{ event: string; payload: unknown }>;
  scenario: LibraryWorkScenario;
}

export interface LibraryWorkHarness {
  snapshot(page: Page): Promise<LibraryWorkHarnessSnapshot>;
  read(page: Page): Promise<void>;
  wait(page: Page): Promise<void>;
  write(page: Page): Promise<void>;
  finish(page: Page): Promise<void>;
}

/**
 * A protocol-level installed-app bridge. It drives ACP lines and actual Tauri command shapes,
 * never a product-only event or Library state. Each work phase is explicit so a headed capture
 * can hold a genuine read or permission wait without a fabricated timer.
 */
export async function installLibraryWorkHarness(
  page: Page,
  options: { scenario?: LibraryWorkScenario } = {},
): Promise<LibraryWorkHarness> {
  const scenario = options.scenario ?? "successful-write";
  await page.addInitScript(
    ({ initialFiles, initialScenario, vaultRoot, runtime, architecturePage }) => {
      window.localStorage.setItem("library.wikiWriteMode", "ask");
      type EventCallback = (event: { event: string; payload: unknown }) => void;
      const files: Record<string, string> = { ...initialFiles };
      const mtimes: Record<string, number> = {};
      const directories = new Set([".", ".ontology-atlas", "sources", "wiki"]);
      const callbacks = new Map<number, EventCallback>();
      const listeners = new Map<string, Set<number>>();
      const calls: Array<{ method: string; params?: unknown }> = [];
      const events: Array<{ event: string; payload: unknown }> = [];
      const writes: Array<{ relativePath: string; content: string; mtime: number }> = [];
      let callbackId = 1;
      let sessionId = "library-acp-session";
      let nextMtime = 1_727_000_000_000;
      let promptId: number | string | null = null;
      let permissionId: number | string | null = null;
      let phase: "idle" | "read" | "waiting" | "approved" | "rejected" | "written" | "finished" = "idle";
      for (const path of Object.keys(files)) mtimes[path] = nextMtime;

      const emit = (event: string, payload: unknown) => {
        events.push({ event, payload });
        for (const id of listeners.get(event) ?? []) callbacks.get(id)?.({ event, payload });
      };
      const acp = (line: Record<string, unknown>) => emit("acp://message", { sessionId, line: JSON.stringify(line) });
      const result = (id: number | string, value: unknown) => acp({ jsonrpc: "2.0", id, result: value });
      const update = (value: Record<string, unknown>) => acp({ jsonrpc: "2.0", method: "session/update", params: { sessionId, update: value } });
      const relative = (value: unknown) => {
        if (typeof value !== "string") return "";
        if (value === vaultRoot) return "";
        return value.startsWith(`${vaultRoot}/`) ? value.slice(vaultRoot.length + 1) : value;
      };
      const fingerprint = () => ({
        entries: Object.entries(files).filter(([path]) => path.endsWith(".md") || path.startsWith("sources/")).map(([relativePath, text]) => ({ relativePath, lastModified: mtimes[relativePath] ?? nextMtime, size: new TextEncoder().encode(text).length })),
        truncated: false, prunedDirs: [],
      });
      const write = (path: string, content: string) => {
        nextMtime += 1;
        files[path] = content;
        mtimes[path] = nextMtime;
        writes.push({ relativePath: path, content, mtime: nextMtime });
        emit("vault-changed", {});
      };
      const emitRead = () => {
        if (phase !== "idle") return;
        phase = "read";
        update({ sessionUpdate: "tool_call", toolCallId: "read-architecture", title: "mcp__atlas-vault__read_source", kind: "read", status: "pending", rawInput: { file_path: "sources/architecture.docx" } });
      };
      const emitWait = () => {
        if (phase !== "read") return;
        update({ sessionUpdate: "tool_call_update", toolCallId: "read-architecture", status: "completed", rawInput: { file_path: "sources/architecture.docx" }, rawOutput: { text: "Architecture evidence" } });
        phase = "waiting";
        const targetPath = initialScenario === "successful-write" ? `${vaultRoot}/wiki/architecture.md` : `${vaultRoot}/outside/unknown.md`;
        const rawInput = { file_path: targetPath, content: architecturePage };
        update({ sessionUpdate: "tool_call", toolCallId: "write-architecture", title: "mcp__atlas-vault__write_wiki_file", kind: "edit", status: "pending", _meta: { is_mcp_tool_call: true }, rawInput: { server: "atlas-vault", tool: "write_wiki_file", arguments: rawInput } });
        permissionId = 902;
        acp({ jsonrpc: "2.0", id: permissionId, method: "session/request_permission", params: { sessionId, _meta: { is_mcp_tool_approval: true }, options: [{ kind: "reject_once", optionId: "reject", name: "Reject" }, { kind: "allow_once", optionId: "allow", name: "Allow once" }], toolCall: { toolCallId: "write-architecture", title: "mcp__atlas-vault__write_wiki_file", kind: "edit", rawInput } } });
      };
      const emitWrite = () => {
        if (phase !== "approved" || initialScenario !== "successful-write") return;
        write("wiki/architecture.md", architecturePage);
        phase = "written";
        update({ sessionUpdate: "tool_call_update", toolCallId: "write-architecture", status: "completed", rawOutput: { ok: true } });
      };
      const finish = () => {
        if (phase === "finished" || promptId === null) return;
        if (phase !== "written") {
          update({ sessionUpdate: "tool_call_update", toolCallId: "write-architecture", status: "failed", rawOutput: { error: "write rejected or not observed" } });
        }
        phase = "finished";
        update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Work finished." } });
        result(promptId, { stopReason: initialScenario === "successful-write" && Object.keys(files).includes("wiki/architecture.md") ? "end_turn" : "tool_rejected" });
        promptId = null;
      };
      const handleClientMessage = (message: Record<string, any>) => {
        calls.push({ method: message.method ?? "response", params: message });
        if (message.method === "initialize") return result(message.id, { protocolVersion: 1, agentCapabilities: { loadSession: false, promptCapabilities: {} } });
        if (message.method === "session/list") return result(message.id, { sessions: [] });
        if (message.method === "session/new") return result(message.id, { sessionId, modes: { availableModes: [{ id: "default", name: "Default" }], currentModeId: "default" }, models: { availableModels: [], currentModelId: null } });
        if (message.method === "session/set_mode" || message.method === "session/set_model" || message.method === "session/cancel") return result(message.id, {});
        if (message.method === "session/prompt") { promptId = message.id; return; }
        if (message.id === permissionId && phase === "waiting") {
          const allowed = message.result?.outcome?.optionId === "allow" && initialScenario === "successful-write";
          phase = allowed ? "approved" : "rejected";
        }
      };
      const invoke = (command: string, args: Record<string, any> = {}) => {
        calls.push({ method: command, params: args });
        if (command === "plugin:event|listen") { const id = Number(args.handler); const event = String(args.event); if (!callbacks.has(id)) return Promise.reject(new Error("missing event callback")); const set = listeners.get(event) ?? new Set<number>(); set.add(id); listeners.set(event, set); return Promise.resolve(id); }
        if (command === "plugin:event|unlisten") { const event = String(args.event); listeners.get(event)?.delete(Number(args.eventId)); callbacks.delete(Number(args.eventId)); return Promise.resolve(); }
        if (command === "acp_detect_runtimes") return Promise.resolve([runtime]);
        if (command === "secret_status") return Promise.resolve({ provider: args.provider, stored: false, last4: null });
        if (command === "acp_start") return Promise.resolve(sessionId);
        if (command === "acp_stop" || command === "start_vault_watch" || command === "ensure_vault_directory") return Promise.resolve(null);
        if (command === "acp_send") { try { handleClientMessage(JSON.parse(String(args.line ?? ""))); } catch {} return Promise.resolve(null); }
        if (command === "acp_permission_verdict") return Promise.resolve("ask");
        if (command === "mcp_bundled_server") return Promise.resolve({ path: "/Applications/Ontology Atlas.app/mcp", available: true, reason: null });
        if (command === "discover_mcp_connectors") return Promise.resolve({ servers: [], problems: [] });
        if (command === "discover_source_candidates") return Promise.resolve({ candidates: [], truncated: false, unreadableRoots: [] });
        if (command === "pick_vault_directory") return Promise.resolve(vaultRoot);
        if (command === "vault_path_exists") { const path = relative(args.relativePath); return Promise.resolve(args.kind === "directory" ? path === "" || [...directories].some((directory) => directory === path) || Object.keys(files).some((file) => file.startsWith(`${path}/`)) : path in files); }
        if (command === "vault_fingerprint") return Promise.resolve(fingerprint());
        if (command === "hash_vault_files") return Promise.resolve([]);
        if (command === "list_vault_directory") { const directory = relative(args.relativePath); const prefix = directory ? `${directory}/` : ""; const entries = new Map<string, "file" | "directory">(); for (const file of Object.keys(files)) { if (!file.startsWith(prefix)) continue; const rest = file.slice(prefix.length); if (!rest) continue; const [name, child] = rest.split("/"); entries.set(name, child ? "directory" : "file"); } return Promise.resolve([...entries].map(([name, kind]) => ({ name, kind }))); }
        if (command === "read_vault_text_file") { const path = relative(args.relativePath); if (!(path in files)) return Promise.reject(new Error(`missing ${path}`)); return Promise.resolve({ text: files[path], lastModified: mtimes[path] ?? nextMtime }); }
        if (command === "read_vault_binary_file") { const path = relative(args.relativePath); if (!(path in files)) return Promise.reject(new Error(`missing ${path}`)); return Promise.resolve({ bytes: [...new TextEncoder().encode(files[path])], lastModified: mtimes[path] ?? nextMtime }); }
        if (command === "write_vault_text_file") { write(relative(args.relativePath), String(args.content ?? "")); return Promise.resolve(null); }
        return Promise.reject(new Error(`no stub for ${command}`));
      };
      (window as any).isTauri = true;
      (window as any).__TAURI_INTERNALS__ = { transformCallback: (callback: EventCallback) => { const id = callbackId++; callbacks.set(id, callback); return id; }, invoke };
      (window as any).__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: (event: string, id: number) => { listeners.get(event)?.delete(id); callbacks.delete(id); } };
      (window as any).__atlasLibraryWorkHarness = { emitRead, emitWait, emitWrite, finish, snapshot: () => ({ files: { ...files }, writes: [...writes], calls: [...calls], events: [...events], scenario: initialScenario }) };
    },
    { initialFiles: VAULT_FILES, initialScenario: scenario, vaultRoot: VAULT_ROOT, runtime: RUNTIME, architecturePage: ARCHITECTURE_PAGE },
  );
  const call = (currentPage: Page, method: "emitRead" | "emitWait" | "emitWrite" | "finish") => currentPage.evaluate((name) => (window as any).__atlasLibraryWorkHarness[name](), method);
  return { snapshot: (currentPage) => currentPage.evaluate(() => (window as any).__atlasLibraryWorkHarness.snapshot()), read: (currentPage) => call(currentPage, "emitRead"), wait: (currentPage) => call(currentPage, "emitWait"), write: async (currentPage) => {
    await currentPage.waitForFunction(() => (window as any).__atlasLibraryWorkHarness.snapshot().calls.some(
      (entry: any) => entry.method === "response" && entry.params.result?.outcome?.optionId === "allow",
    ));
    await call(currentPage, "emitWrite");
  }, finish: (currentPage) => call(currentPage, "finish") };
}

export async function openLibraryWorkScenario(page: Page, options: { scenario?: LibraryWorkScenario } = {}): Promise<LibraryWorkHarness> {
  await seedFirstRunSeen(page);
  const harness = await installLibraryWorkHarness(page, options);
  await page.goto("/en/docs/");
  await page.getByRole("button", { name: /Open my folder/i }).click();
  await page.getByRole("heading", { name: "Map" }).waitFor();
  await page.goto("/en/library/?guides=off&e2e=1");
  await page.getByTestId("library-index-segment-wiki").click();
  await page.getByTestId("library-compile").click();
  await page.getByTestId("library-agent-dock").waitFor();
  await page.getByTestId("acp-chat-panel").waitFor();
  await page.waitForFunction(
    () => (window as any).__atlasLibraryWorkHarness.snapshot().calls.some((call: { method: string }) => call.method === "session/prompt"),
  );
  return harness;
}
