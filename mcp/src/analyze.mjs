// R16 (b3) — analyze_repo_structure
//
// AI agent (Claude Code, Codex, Cursor) 가 사용자 한 줄 "이 codebase 분석해줘"
// 후 호출할 *deterministic* 도구. side effect 0 — vault 변경 안 함, 후보만
// 제안. agent 가 사용자에게 보여주고 *명시 add_concept* 호출.
//
// 단일 source of truth 보존:
//   - 결과는 return only. vault frontmatter 직접 안 건드림.
//   - 사용자 검토 + 명시 add 로만 vault 진입 → drift 0.
//
// 감지 패턴 (generic — 80% codebase cover. 더 정교한 framework 별 detect 는
// 후속 도구 — infer_imports / extract_domains_from_readme 등):
//   - package.json `name` → project slug + title
//   - README.md 첫 H1 → project title (package.json 없으면 fallback)
//   - README.md H2 sections → domain 후보
//   - src/ (또는 root) 깊이 1 폴더 → capability 후보 (단 dotfile / 일반 무시
//     폴더 제외)
//   - 각 capability 폴더의 main file (index.ts/js/mjs/tsx) → element 후보
//
// 결과 shape:
//   {
//     rootPath, framework: 'fsd' | 'next' | 'generic',
//     project?: { slug, title },
//     domains: [{ slug, title, evidence: { source, line? } }],
//     capabilities: [{ slug, title, evidence: { source } }],
//     elements: [{ slug, title, evidence: { source } }],
//     suggestedRelations: [{ from, to, type }],
//     skipped: [{ path, reason }],
//   }

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename, relative } from 'node:path';

const DEFAULT_IGNORE = new Set([
  'node_modules',
  '.git',
  'out',
  'dist',
  'build',
  '.next',
  '.expo',
  '.turbo',
  '.cache',
  '.idea',
  '.vscode',
  'coverage',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'venv',
]);

const SOURCE_FOLDERS = ['src', 'lib', 'app', 'packages'];

const ELEMENT_ENTRY_FILES = [
  'index.ts',
  'index.tsx',
  'index.js',
  'index.mjs',
  'main.ts',
  'main.js',
];

/**
 * 한 codebase 의 root 를 walk + README 분석 → ontology node 후보 list.
 *
 * @param {string} rootPath — 분석할 디렉토리 (보통 cwd 또는 user-provided).
 * @param {{ maxDepth?: number, ignore?: string[] }} options
 * @returns analysis result
 */
export function analyzeRepoStructure(rootPath, options = {}) {
  if (!existsSync(rootPath) || !statSync(rootPath).isDirectory()) {
    throw new Error(`rootPath not a directory: ${rootPath}`);
  }
  const maxDepth = options.maxDepth ?? 2;
  const ignore = new Set([
    ...DEFAULT_IGNORE,
    ...((options.ignore ?? []).map(String)),
  ]);

  const skipped = [];
  const project = detectProject(rootPath);
  const { domains, readmePath } = detectDomainsFromReadme(rootPath);

  // SOURCE_FOLDERS 중 첫 번째 존재하는 것을 src dir 로
  let srcDir = null;
  for (const cand of SOURCE_FOLDERS) {
    const p = join(rootPath, cand);
    if (existsSync(p) && statSync(p).isDirectory()) {
      srcDir = p;
      break;
    }
  }

  // framework heuristic — *features/* 만 있어도 fsd 로 (oh-my-ontology 자체
  // 같이 lean FSD). 둘 이상 marker 면 strong fsd.
  let framework = 'generic';
  const fsdMarkers = ['features', 'entities', 'widgets', 'shared', 'views'];
  if (srcDir) {
    const subs = readdirSync(srcDir).filter((s) =>
      statSync(join(srcDir, s)).isDirectory(),
    );
    const fsdHits = subs.filter((s) => fsdMarkers.includes(s)).length;
    if (fsdHits >= 1) framework = 'fsd';
  }
  if (existsSync(join(rootPath, 'next.config.js')) || existsSync(join(rootPath, 'next.config.ts'))) {
    framework = framework === 'fsd' ? 'fsd' : 'next';
  }

  const capabilities = [];
  const elements = [];

  if (srcDir) {
    // FSD pattern — features/ 가 capability 의 main 영역
    const fsdRoots =
      framework === 'fsd'
        ? ['features', 'entities', 'widgets', 'views']
        : null;

    if (fsdRoots) {
      for (const r of fsdRoots) {
        const dir = join(srcDir, r);
        if (!existsSync(dir)) continue;
        for (const sub of readdirSync(dir)) {
          if (ignore.has(sub) || sub.startsWith('.')) {
            skipped.push({ path: join(dir, sub), reason: 'dotfile/ignore' });
            continue;
          }
          const subPath = join(dir, sub);
          if (!statSync(subPath).isDirectory()) continue;
          // features/ 와 entities/ 의 sub 는 capability 후보, widgets/views 는
          // element 후보 (FSD 정의)
          const isCapabilityish = r === 'features' || r === 'entities';
          const slug = isCapabilityish
            ? `${sub}`
            : `${r}/${sub}`;
          const evidence = {
            source: relative(rootPath, subPath),
          };
          if (isCapabilityish) {
            capabilities.push({
              slug,
              title: humanize(sub),
              evidence,
            });
          } else {
            elements.push({
              slug: relative(rootPath, subPath),
              title: humanize(sub),
              evidence,
            });
          }
        }
      }
    } else {
      // generic — src/ 의 깊이 1 폴더 만
      for (const sub of readdirSync(srcDir)) {
        if (ignore.has(sub) || sub.startsWith('.')) {
          skipped.push({ path: join(srcDir, sub), reason: 'dotfile/ignore' });
          continue;
        }
        const subPath = join(srcDir, sub);
        if (!statSync(subPath).isDirectory()) continue;
        capabilities.push({
          slug: sub,
          title: humanize(sub),
          evidence: { source: relative(rootPath, subPath) },
        });
        // index 파일이 있으면 element 추가
        for (const entry of ELEMENT_ENTRY_FILES) {
          const ep = join(subPath, entry);
          if (existsSync(ep)) {
            elements.push({
              slug: relative(rootPath, ep),
              title: `${humanize(sub)} entry`,
              evidence: { source: relative(rootPath, ep) },
            });
            break;
          }
        }
      }
    }
  }

  // suggested relations:
  //   - 각 capability → project (capabilities[]) endorse 후보
  //   - 각 capability 의 첫 element → element relation
  const suggestedRelations = [];
  if (project) {
    for (const cap of capabilities) {
      suggestedRelations.push({
        from: project.slug,
        to: cap.slug,
        type: 'contains',
      });
    }
  }
  if (maxDepth > 0); // reserved for deeper element walking

  void readmePath; // signal used

  return {
    rootPath,
    framework,
    project,
    domains,
    capabilities,
    elements,
    suggestedRelations,
    skipped,
  };
}

function detectProject(rootPath) {
  const pkgPath = join(rootPath, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const slugRaw = String(pkg.name || basename(rootPath));
      const slug = slugRaw.replace(/^@/, '').replace(/\//g, '-');
      const title =
        (typeof pkg.description === 'string' && pkg.description.trim()) ||
        humanize(slug);
      return { slug, title };
    } catch {
      // fall through
    }
  }
  // README first H1
  for (const cand of ['README.md', 'readme.md', 'README']) {
    const p = join(rootPath, cand);
    if (!existsSync(p)) continue;
    try {
      const text = readFileSync(p, 'utf-8');
      const m = text.match(/^#\s+(.+?)\s*$/m);
      if (m) {
        const title = m[1].trim();
        return { slug: basename(rootPath), title };
      }
    } catch {
      // ignore
    }
  }
  return { slug: basename(rootPath), title: humanize(basename(rootPath)) };
}

function detectDomainsFromReadme(rootPath) {
  const candidates = ['README.md', 'readme.md', 'README'];
  for (const cand of candidates) {
    const p = join(rootPath, cand);
    if (!existsSync(p)) continue;
    try {
      const text = readFileSync(p, 'utf-8');
      const lines = text.split(/\r?\n/);
      const domains = [];
      const seen = new Set();
      for (let i = 0; i < lines.length; i += 1) {
        const m = lines[i].match(/^##\s+(.+?)\s*$/);
        if (!m) continue;
        const title = m[1].trim();
        const slug = slugify(title);
        if (!slug || seen.has(slug)) continue;
        // skip generic README sections
        if (
          /^(usage|installation|getting started|quick start|license|contributing|requirements|features|setup|status|tech stack|architecture|folder map|routes|tests?|documentation)$/i.test(
            title,
          )
        ) {
          continue;
        }
        seen.add(slug);
        domains.push({
          slug,
          title,
          evidence: { source: cand, line: i + 1 },
        });
        if (domains.length >= 12) break; // sanity cap
      }
      return { domains, readmePath: p };
    } catch {
      // ignore
    }
  }
  return { domains: [], readmePath: null };
}

function humanize(s) {
  return s
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
