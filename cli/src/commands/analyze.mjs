// R16 (b3) — `oh-my-ontology analyze [rootPath]`
// Wraps MCP analyze_repo_structure. side effect 0 — vault 변경 안 함, 후보만.
// 사용자가 결과 보고 *명시적으로* `oh-my-ontology add` 또는 AI agent 의
// add_concept 로 진입.

import { resolve } from 'node:path';
import { callMcpTool } from '../lib/mcp-call.mjs';

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

const KIND_COLOR = {
  project: COLORS.magenta,
  domain: COLORS.blue,
  capability: COLORS.cyan,
  element: COLORS.green,
};

export async function runAnalyze(args) {
  const { rootPath, vault, json, maxDepth, error } = parseArgs(args);
  if (error) {
    process.stderr.write(`${COLORS.red}error${COLORS.reset}  ${error}\n`);
    printUsage();
    return 1;
  }

  const target = resolve(process.cwd(), rootPath);
  // analyze 는 *vault 와 무관* 한 도구지만 mcp 통과 시 OMOT_VAULT 가 필요해서
  // 그냥 cwd 또는 사용자 지정. mcp 의 analyze 도 vault 안 만지지만
  // initialization 흐름에 vault path 가 필요.
  const vaultRoot = resolve(process.cwd(), vault);
  let result;
  try {
    result = await callMcpTool(vaultRoot, 'analyze_repo_structure', {
      rootPath: target,
      maxDepth,
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

  const proj = result.project;
  const fw = result.framework ?? 'generic';
  process.stdout.write(
    `${COLORS.bold}analyze${COLORS.reset} ${COLORS.dim}${target}${COLORS.reset} ` +
      `${COLORS.dim}(framework=${fw})${COLORS.reset}\n\n`,
  );

  if (proj) {
    process.stdout.write(
      `  ${KIND_COLOR.project}project${COLORS.reset}     ${proj.slug} ${COLORS.dim}— ${proj.title}${COLORS.reset}\n\n`,
    );
  }

  printSection('domains', result.domains ?? [], COLORS, KIND_COLOR.domain);
  printSection(
    'capabilities',
    result.capabilities ?? [],
    COLORS,
    KIND_COLOR.capability,
  );
  printSection('elements', result.elements ?? [], COLORS, KIND_COLOR.element);

  const rels = result.suggestedRelations ?? [];
  if (rels.length > 0) {
    process.stdout.write(
      `  ${COLORS.bold}suggested relations${COLORS.reset} ${COLORS.dim}(${rels.length})${COLORS.reset}\n`,
    );
    for (const r of rels.slice(0, 8)) {
      process.stdout.write(
        `    ${COLORS.dim}${r.from} —${r.type}→ ${r.to}${COLORS.reset}\n`,
      );
    }
    if (rels.length > 8)
      process.stdout.write(
        `    ${COLORS.dim}… ${rels.length - 8} more${COLORS.reset}\n`,
      );
    process.stdout.write('\n');
  }

  process.stdout.write(
    `${COLORS.dim}side effect 0 — vault 변경 안 함. 후보가 맞으면${COLORS.reset} ` +
      `${COLORS.bold}oh-my-ontology add${COLORS.reset} ` +
      `${COLORS.dim}또는 AI agent 의 add_concept 로 명시 작성.${COLORS.reset}\n`,
  );
  return 0;
}

function printSection(label, items, colors, kindColor) {
  if (items.length === 0) return;
  process.stdout.write(
    `  ${colors.bold}${label}${colors.reset} ${colors.dim}(${items.length})${colors.reset}\n`,
  );
  for (const it of items.slice(0, 12)) {
    const ev = it.evidence?.source ? `${colors.dim} ← ${it.evidence.source}${colors.reset}` : '';
    process.stdout.write(
      `    ${kindColor}${(it.slug || '').padEnd(36)}${colors.reset} ${it.title || ''}${ev}\n`,
    );
  }
  if (items.length > 12)
    process.stdout.write(
      `    ${colors.dim}… ${items.length - 12} more${colors.reset}\n`,
    );
  process.stdout.write('\n');
}

function parseArgs(args) {
  const flags = { vault: '.', json: false };
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--vault') flags.vault = args[++i] || '.';
    else if (a.startsWith('--vault=')) flags.vault = a.slice('--vault='.length);
    else if (a === '--json') flags.json = true;
    else if (a === '--max-depth')
      flags.maxDepth = Number(args[++i]) || undefined;
    else if (a.startsWith('--max-depth='))
      flags.maxDepth = Number(a.slice('--max-depth='.length)) || undefined;
    else if (a.startsWith('--')) return { error: `unknown flag: ${a}` };
    else positional.push(a);
  }
  return {
    rootPath: positional[0] ?? '.',
    vault: flags.vault,
    json: flags.json,
    maxDepth: flags.maxDepth,
  };
}

function printUsage() {
  process.stderr.write(
    `\n${COLORS.bold}Usage:${COLORS.reset}\n` +
      `  oh-my-ontology analyze [rootPath] [--vault path] [--json] [--max-depth N]\n\n` +
      `${COLORS.bold}What it does:${COLORS.reset}\n` +
      `  Walk a code repository (default: cwd), detect package.json / README\n` +
      `  H2 sections / src/ folders, propose ontology node candidates.\n` +
      `  ${COLORS.bold}side effect 0${COLORS.reset} — vault 변경 안 함. 사용자가 후보 검토 후\n` +
      `  ${COLORS.bold}oh-my-ontology add${COLORS.reset} 또는 AI agent 의 add_concept 로 명시 작성.\n\n` +
      `${COLORS.bold}Example:${COLORS.reset}\n` +
      `  oh-my-ontology analyze\n` +
      `  oh-my-ontology analyze ~/my-app --json\n`,
  );
}
