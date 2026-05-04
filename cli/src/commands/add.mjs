import { resolve, relative } from 'node:path';
import { writeDoc } from '../lib/write-vault.mjs';

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

const KNOWN_KINDS = ['project', 'domain', 'capability', 'element', 'document'];

// R12 #37 — `--auto-prefix` opt-in 시 kind → folder 자동 prefix.
// dogfood vault 패턴 (`capabilities/foo`, `domains/auth`, `elements/jwt`) 따름.
// project / document 는 prefix 없음 (root level).
const KIND_FOLDER = {
  project: '',
  domain: 'domains/',
  capability: 'capabilities/',
  element: 'elements/',
  document: '',
};

/**
 * R12 #34 — \`oh-my-ontology add <kind> <slug> --title=... [--domain X] [--body "..."] [--vault path]\`
 *
 * 새 ontology 노드 .md 작성. 기존 slug 면 throw (덮어쓰기 절대 안 함 —
 * 사용자 작업 보호). mcp 의 add_concept 과 같은 contract.
 */
export function runAdd(args) {
  const opts = parseArgs(args);
  if (opts.error) {
    process.stderr.write(`${COLORS.red}error${COLORS.reset}  ${opts.error}\n`);
    printAddUsage();
    return 1;
  }

  const { kind, slug: rawSlug, title, domain, body, vault, autoPrefix } = opts;
  const vaultPath = resolve(vault);

  // R12 #37 — opt-in folder prefix (capability → capabilities/foo).
  // 사용자가 이미 prefix 명시 (`capabilities/foo`) 한 경우 두 번 적용 회피.
  const folder = KIND_FOLDER[kind] || '';
  const slug =
    autoPrefix && folder && !rawSlug.startsWith(folder)
      ? `${folder}${rawSlug}`
      : rawSlug;

  const fm = {
    slug,
    kind,
    title,
  };
  if (domain) fm.domain = domain;

  try {
    const filePath = writeDoc(vaultPath, slug, {
      frontmatter: fm,
      body: body || `# ${title}\n`,
    });
    const rel = relative(process.cwd(), filePath);
    console.log(
      `${COLORS.green}ok${COLORS.reset}    ${rel}\n` +
        `${COLORS.dim}      ${kind} · ${slug}${domain ? ` · domain=${domain}` : ''}${COLORS.reset}`,
    );
    return 0;
  } catch (err) {
    process.stderr.write(
      `${COLORS.red}error${COLORS.reset}  ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 1;
  }
}

function parseArgs(args) {
  const positional = [];
  const flags = { vault: '.', autoPrefix: false };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--vault') flags.vault = args[++i] || '.';
    else if (a.startsWith('--vault=')) flags.vault = a.slice('--vault='.length);
    else if (a === '--title') flags.title = args[++i] || '';
    else if (a.startsWith('--title=')) flags.title = a.slice('--title='.length);
    else if (a === '--domain') flags.domain = args[++i] || '';
    else if (a.startsWith('--domain=')) flags.domain = a.slice('--domain='.length);
    else if (a === '--body') flags.body = args[++i] || '';
    else if (a.startsWith('--body=')) flags.body = a.slice('--body='.length);
    else if (a === '--auto-prefix') flags.autoPrefix = true;
    else if (a.startsWith('--')) {
      return { error: `unknown flag: ${a}` };
    } else {
      positional.push(a);
    }
  }
  if (positional.length < 2) {
    return { error: 'kind and slug are required' };
  }
  const [kind, slug] = positional;
  if (!KNOWN_KINDS.includes(kind)) {
    return {
      error: `unknown kind: ${kind}. one of ${KNOWN_KINDS.join(' / ')}`,
    };
  }
  if (!flags.title || flags.title.trim() === '') {
    return { error: '--title is required (non-empty)' };
  }
  return {
    kind,
    slug,
    title: flags.title,
    domain: flags.domain,
    body: flags.body,
    vault: flags.vault,
    autoPrefix: flags.autoPrefix,
  };
}

function printAddUsage() {
  process.stderr.write(
    `\n${COLORS.bold}Usage:${COLORS.reset}\n` +
      `  oh-my-ontology add <kind> <slug> --title="..." [--domain X] [--body "..."] [--vault path]\n` +
      `\n${COLORS.bold}kind:${COLORS.reset} ${KNOWN_KINDS.join(' / ')}\n` +
      `\nExample:\n` +
      `  oh-my-ontology add capability auth/token-issue --title="Token issue" --domain=auth\n`,
  );
}
