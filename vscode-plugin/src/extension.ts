import * as vscode from 'vscode';
import { walkVault, VaultNode } from './walk-vault';
import { OntologyTreeProvider } from './tree-provider';
import { findOntologyMatch } from './code-match';

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
