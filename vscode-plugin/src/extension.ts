import * as vscode from 'vscode';
import { walkVault, VaultNode } from './walk-vault';
import { OntologyTreeProvider } from './tree-provider';
import { findOntologyMatch } from './code-match';
import { writeDoc, resolveSlug } from './write-vault';

const STORAGE_VAULT_KEY = 'oh-my-ontology.vaultPath';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const treeProvider = new OntologyTreeProvider();
  vscode.window.registerTreeDataProvider('ohMyOntology.tree', treeProvider);

  // R13 #50 — code↔ontology jump: surface the matching node for the active
  // editor in the status bar. Click → open the node's .md.
  const matchStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  matchStatusBar.command = 'ohMyOntology.openMatchedNode';
  context.subscriptions.push(matchStatusBar);

  let cachedNodes: VaultNode[] = [];
  let currentMatch: VaultNode | null = null;

  const updateMatchForActiveEditor = (): void => {
    const editor = vscode.window.activeTextEditor;
    const folders = vscode.workspace.workspaceFolders;
    if (!editor || !folders || folders.length === 0 || cachedNodes.length === 0) {
      currentMatch = null;
      matchStatusBar.hide();
      return;
    }
    // Pick the workspace folder that owns the active document, fall back to first.
    const workspace =
      vscode.workspace.getWorkspaceFolder(editor.document.uri) ?? folders[0];
    const match = findOntologyMatch(
      workspace.uri.fsPath,
      editor.document.uri.fsPath,
      cachedNodes,
    );
    currentMatch = match;
    if (!match) {
      matchStatusBar.hide();
      return;
    }
    const icon = iconForKind(match.kind);
    matchStatusBar.text = `${icon} ${match.title}`;
    matchStatusBar.tooltip = `oh-my-ontology · ${match.kind} · ${match.slug}\nClick to open ${match.slug}.md`;
    matchStatusBar.show();
  };

  const refresh = async (): Promise<void> => {
    const vaultPath = await resolveVaultPath(context);
    if (!vaultPath) {
      cachedNodes = [];
      treeProvider.setNodes([]);
      updateMatchForActiveEditor();
      return;
    }
    try {
      const nodes = await walkVault(vaultPath);
      cachedNodes = nodes;
      treeProvider.setNodes(nodes);
      vscode.window.setStatusBarMessage(
        `oh-my-ontology: ${nodes.length} ${nodes.length === 1 ? 'node' : 'nodes'} from ${vaultPath}`,
        4000,
      );
      updateMatchForActiveEditor();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`oh-my-ontology: ${msg}`);
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('ohMyOntology.refresh', refresh),
    vscode.commands.registerCommand('ohMyOntology.pickVault', async () => {
      const picked = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Pick ontology vault folder',
      });
      if (!picked || picked.length === 0) return;
      await context.globalState.update(STORAGE_VAULT_KEY, picked[0].fsPath);
      await refresh();
    }),
    vscode.commands.registerCommand(
      'ohMyOntology.openNode',
      async (node: VaultNode) => {
        if (!node?.filePath) return;
        const doc = await vscode.workspace.openTextDocument(node.filePath);
        await vscode.window.showTextDocument(doc);
      },
    ),
    vscode.commands.registerCommand('ohMyOntology.openMatchedNode', async () => {
      if (!currentMatch?.filePath) {
        vscode.window.showInformationMessage(
          'oh-my-ontology: no ontology node owns this file.',
        );
        return;
      }
      const doc = await vscode.workspace.openTextDocument(currentMatch.filePath);
      await vscode.window.showTextDocument(doc);
    }),
    vscode.commands.registerCommand('ohMyOntology.addConcept', async () => {
      const vaultPath = await resolveVaultPath(context);
      if (!vaultPath) {
        vscode.window.showWarningMessage(
          'oh-my-ontology: pick a vault folder first (use the Activity Bar entry).',
        );
        return;
      }
      const kindPick = await vscode.window.showQuickPick(
        [
          { label: 'capability', description: 'A user-visible feature' },
          { label: 'element', description: 'A concrete code unit' },
          { label: 'domain', description: 'A grouping of capabilities' },
          { label: 'document', description: 'A reference doc' },
          { label: 'project', description: 'Top-level (usually one per workspace)' },
        ],
        { placeHolder: 'Pick the kind of concept to add' },
      );
      if (!kindPick) return;
      const kind = kindPick.label;

      const rawSlug = await vscode.window.showInputBox({
        placeHolder: 'slug — e.g. token-issue (auto-prefixed to capabilities/token-issue)',
        prompt: 'Slug for the new concept (no .md extension)',
        validateInput: (v) =>
          !v || !v.trim() ? 'slug is required' : null,
      });
      if (!rawSlug) return;

      const title = await vscode.window.showInputBox({
        placeHolder: 'title — e.g. "Token issue"',
        prompt: 'Display title',
        validateInput: (v) =>
          !v || !v.trim() ? 'title is required' : null,
      });
      if (!title) return;

      let domain: string | undefined;
      if (kind === 'capability' || kind === 'element') {
        const domainPick = await vscode.window.showInputBox({
          placeHolder: 'parent domain (optional, e.g. auth)',
          prompt: 'Parent domain slug — leave empty to skip',
        });
        domain = domainPick?.trim() || undefined;
      }

      const slug = resolveSlug(kind, rawSlug.trim(), true);
      const fm: Record<string, unknown> = {
        slug,
        kind,
        title: title.trim(),
      };
      if (domain) fm.domain = domain;

      try {
        const filePath = await writeDoc(vaultPath, slug, { frontmatter: fm });
        await refresh();
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
        vscode.window.setStatusBarMessage(
          `oh-my-ontology: created ${slug}.md`,
          4000,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`oh-my-ontology: ${msg}`);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('oh-my-ontology.vaultPath')) {
        void refresh();
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      updateMatchForActiveEditor();
    }),
  );

  await refresh();
}

function iconForKind(kind: string): string {
  switch (kind) {
    case 'project':
      return '$(rocket)';
    case 'domain':
      return '$(symbol-namespace)';
    case 'capability':
      return '$(symbol-function)';
    case 'element':
      return '$(symbol-file)';
    case 'document':
      return '$(file-text)';
    default:
      return '$(circle-outline)';
  }
}

export function deactivate(): void {
  // no-op
}

async function resolveVaultPath(
  context: vscode.ExtensionContext,
): Promise<string | undefined> {
  const config = vscode.workspace.getConfiguration('oh-my-ontology');
  const fromConfig = (config.get<string>('vaultPath') ?? '').trim();
  if (fromConfig) return fromConfig;

  const fromState = context.globalState.get<string>(STORAGE_VAULT_KEY);
  if (fromState) return fromState;

  // Auto-detect: workspace folder with `docs/ontology/` or `.md` with `kind:` frontmatter
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    const candidate = vscode.Uri.joinPath(folders[0].uri, 'docs', 'ontology');
    try {
      const stat = await vscode.workspace.fs.stat(candidate);
      if (stat.type === vscode.FileType.Directory) {
        return candidate.fsPath;
      }
    } catch {
      // not a dogfood-shaped repo — fine
    }
  }
  return undefined;
}
