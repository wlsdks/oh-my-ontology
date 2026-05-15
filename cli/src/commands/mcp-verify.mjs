// `oh-my-ontology mcp-verify [vault]` — run the MCP package verify CLI
// against the resolved vault. This gives installed CLI users the same
// first-contact MCP check without knowing the mcp package's internal path.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveVaultRoot } from '../lib/resolve-vault.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(import.meta.url);

const COLORS = {
  red: '\x1b[31m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

export async function runMcpVerify(args) {
  const { vault, error } = parseArgs(args);
  if (error) {
    process.stderr.write(`${COLORS.red}error${COLORS.reset}  ${error}\n`);
    printUsage();
    return 1;
  }

  const vaultRoot = resolveVaultRoot(vault);
  let verifyScript;
  try {
    verifyScript = resolveVerifyScript();
  } catch (err) {
    process.stderr.write(
      `${COLORS.red}error${COLORS.reset}  ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 2;
  }

  return runVerifyScript(verifyScript, vaultRoot);
}

function resolveVerifyScript() {
  const envPath = process.env.OMOT_MCP_VERIFY_PATH;
  if (envPath && existsSync(envPath)) return envPath;

  const monoDev = resolve(__dirname, '../../../mcp/scripts/verify.mjs');
  if (existsSync(monoDev)) return monoDev;

  try {
    return require_.resolve('oh-my-ontology-mcp/scripts/verify.mjs');
  } catch {
    throw new Error(
      'oh-my-ontology-mcp verify script not found. Install oh-my-ontology-mcp or set OMOT_MCP_VERIFY_PATH.',
    );
  }
}

function runVerifyScript(verifyScript, vaultRoot) {
  return new Promise((resolveP) => {
    const proc = spawn('node', [verifyScript], {
      env: { ...process.env, OMOT_VAULT: vaultRoot },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stdout.on('data', (b) => process.stdout.write(b));
    proc.stderr.on('data', (b) => process.stderr.write(b));
    proc.on('close', (code) => resolveP(code ?? 1));
    proc.on('error', (err) => {
      process.stderr.write(`${COLORS.red}error${COLORS.reset}  ${err.message}\n`);
      resolveP(2);
    });
  });
}

function parseArgs(args) {
  const flags = { vault: '.' };
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--vault') flags.vault = args[++i] || '.';
    else if (a.startsWith('--vault=')) flags.vault = a.slice('--vault='.length);
    else if (a.startsWith('--')) return { error: `unknown flag: ${a}` };
    else positional.push(a);
  }
  if (positional.length > 0 && flags.vault === '.') flags.vault = positional[0];
  if (positional.length > 1) return { error: `too many arguments: ${positional.slice(1).join(' ')}` };
  return { vault: flags.vault };
}

function printUsage() {
  process.stderr.write(
    `\n${COLORS.bold}Usage:${COLORS.reset}\n` +
      `  oh-my-ontology mcp-verify [vault]\n` +
      `  oh-my-ontology mcp-verify --vault path\n\n` +
      `Runs the MCP package verify CLI against the resolved vault.\n`,
  );
}
