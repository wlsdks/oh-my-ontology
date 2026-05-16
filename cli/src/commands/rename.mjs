// R15 follow-up — `oh-my-ontology rename <oldSlug> <newSlug> [vault]`
// Atomic graph-level rename: moves the .md, updates `slug:`, rewrites every
// backlink (frontmatter array entries, inline strings, body links).
// Thin wrapper over MCP rename_concept (dry-run + confirm pattern).

import { resolve } from 'node:path';
import { callMcpTool } from '../lib/mcp-call.mjs';
import { parseVaultFlag, resolveTrailingVaultArg } from '../lib/cli-args.mjs';

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

export async function runRename(args) {
  const { oldSlug, newSlug, vault, confirm, json, error } = parseArgs(args);
  if (error) {
    process.stderr.write(`${COLORS.red}error${COLORS.reset}  ${error}\n`);
    printUsage();
    return 1;
  }

  const vaultRoot = resolve(process.cwd(), vault);

  if (!confirm) {
    // Dry-run preview.
    let preview;
    try {
      preview = await callMcpTool(vaultRoot, 'rename_concept', {
        oldSlug,
        newSlug,
        confirm: false,
      });
    } catch (err) {
      process.stderr.write(
        `${COLORS.red}error${COLORS.reset}  ${err instanceof Error ? err.message : String(err)}\n`,
      );
      return 2;
    }
    if (json) {
      process.stdout.write(JSON.stringify(preview, null, 2) + '\n');
      return 0;
    }
    const updates = preview?.updates ?? [];
    process.stdout.write(
      `${COLORS.yellow}dry-run${COLORS.reset}  ` +
        `${COLORS.bold}${oldSlug}${COLORS.reset} → ${COLORS.bold}${newSlug}${COLORS.reset} ` +
        `${COLORS.dim}(${updates.length} file(s) would change)${COLORS.reset}\n\n`,
    );
    for (const u of updates) {
      process.stdout.write(`  ${COLORS.cyan}${u.slug}${COLORS.reset}\n`);
      if (Array.isArray(u.changes)) {
        for (const c of u.changes) {
          process.stdout.write(`    ${COLORS.dim}${c}${COLORS.reset}\n`);
        }
      }
    }
    process.stdout.write(
      `\n${COLORS.dim}re-run with${COLORS.reset} ${COLORS.bold}--confirm${COLORS.reset} ${COLORS.dim}to apply.${COLORS.reset}\n`,
    );
    return 0;
  }

  // Apply.
  let result;
  try {
    result = await callMcpTool(vaultRoot, 'rename_concept', {
      oldSlug,
      newSlug,
      confirm: true,
    });
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
  const updates = result?.updates ?? [];
  process.stdout.write(
    `${COLORS.green}ok${COLORS.reset}    ${COLORS.bold}${oldSlug}${COLORS.reset} → ${COLORS.bold}${newSlug}${COLORS.reset} ` +
      `${COLORS.dim}(${updates.length} file(s) updated)${COLORS.reset}\n`,
  );
  return 0;
}

function parseArgs(args) {
  const flags = { vault: null, confirm: false, json: false };
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--vault') flags.vault = parseVaultFlag(args[++i]);
    else if (a.startsWith('--vault=')) flags.vault = parseVaultFlag(a.slice('--vault='.length));
    else if (a === '--confirm') flags.confirm = true;
    else if (a === '--json') flags.json = true;
    else if (a.startsWith('--')) return { error: `unknown flag: ${a}` };
    else positional.push(a);
  }
  if (positional.length < 2) {
    return { error: 'oldSlug and newSlug are required' };
  }
  const vaultResult = resolveTrailingVaultArg({ vault: flags.vault, positional, vaultIndex: 2 });
  if (vaultResult.error) return vaultResult;
  return {
    oldSlug: positional[0],
    newSlug: positional[1],
    vault: vaultResult.vault,
    confirm: flags.confirm,
    json: flags.json,
  };
}

function printUsage() {
  process.stderr.write(
    `\n${COLORS.bold}Usage:${COLORS.reset}\n` +
      `  oh-my-ontology rename <oldSlug> <newSlug> [vault] [--confirm] [--json]\n\n` +
      `${COLORS.bold}Default${COLORS.reset} dry-run only — preview the changes.\n` +
      `${COLORS.bold}--confirm${COLORS.reset}  apply: move .md, update slug:, rewrite every backlink.\n\n` +
      `${COLORS.bold}Example:${COLORS.reset}\n` +
      `  oh-my-ontology rename capabilities/foo capabilities/bar\n` +
      `  oh-my-ontology rename capabilities/foo capabilities/bar --confirm\n`,
  );
}
