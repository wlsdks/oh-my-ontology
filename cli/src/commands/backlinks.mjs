// R15 follow-up — `oh-my-ontology backlinks <slug> [vault]`
// Lists every node referencing the target. Thin wrapper over MCP find_backlinks.

import { callMcpTool } from '../lib/mcp-call.mjs';
import { resolveVaultRoot } from '../lib/resolve-vault.mjs';

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

export async function runBacklinks(args) {
  const { slug, vault, json, error } = parseArgs(args);
  if (error) {
    process.stderr.write(`${COLORS.red}error${COLORS.reset}  ${error}\n`);
    printUsage();
    return 1;
  }

  const vaultRoot = resolveVaultRoot(vault);
  let result;
  try {
    result = await callMcpTool(vaultRoot, 'find_backlinks', { slug });
  } catch (err) {
    process.stderr.write(
      `${COLORS.red}error${COLORS.reset}  ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 2;
  }

  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return 0;
  }

  const matches = result?.matches ?? [];
  if (matches.length === 0) {
    process.stdout.write(
      `${COLORS.dim}no backlinks for${COLORS.reset} ${COLORS.bold}${slug}${COLORS.reset}\n`,
    );
    return 0;
  }

  process.stdout.write(
    `${COLORS.bold}${slug}${COLORS.reset} ${COLORS.dim}— ${matches.length} backlink(s)${COLORS.reset}\n\n`,
  );
  for (const bl of matches) {
    const keys = Array.isArray(bl.matchedKeys) ? bl.matchedKeys.join(', ') : '';
    process.stdout.write(
      `  ${COLORS.cyan}${bl.kind ?? '?'}${COLORS.reset}  ` +
        `${bl.slug}` +
        (keys ? ` ${COLORS.dim}(${keys})${COLORS.reset}` : '') +
        `\n`,
    );
  }
  return 0;
}

function parseArgs(args) {
  const flags = { vault: '.', json: false };
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--vault') flags.vault = args[++i] || '.';
    else if (a.startsWith('--vault=')) flags.vault = a.slice('--vault='.length);
    else if (a === '--json') flags.json = true;
    else if (a.startsWith('--')) return { error: `unknown flag: ${a}` };
    else positional.push(a);
  }
  if (positional.length === 0) {
    return { error: 'slug is required' };
  }
  // Optional second positional is vault path (parity with list/find/validate).
  if (positional.length >= 2 && flags.vault === '.') {
    flags.vault = positional[1];
  }
  return { slug: positional[0], vault: flags.vault, json: flags.json };
}

function printUsage() {
  process.stderr.write(
    `\n${COLORS.bold}Usage:${COLORS.reset}\n` +
      `  oh-my-ontology backlinks <slug> [vault] [--vault path] [--json]\n\n` +
      `${COLORS.bold}Example:${COLORS.reset}\n` +
      `  oh-my-ontology backlinks capabilities/mcp-server\n` +
      `  oh-my-ontology backlinks domains/auth ./docs/ontology --json\n`,
  );
}
