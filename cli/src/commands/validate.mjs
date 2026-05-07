import { readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { walkMd } from '../lib/walk-vault.mjs';
import { validateVaultDocument } from '../lib/validate.mjs';

const COLORS = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
};

/**
 * R11 #32 — \`oh-my-ontology validate [vault]\`
 *
 * vault 의 frontmatter integrity 검증. 5 issue codes (unclosed-frontmatter
 * / empty-kind / missing-kind / unknown-kind / parse-zero-keys). error 1+
 * 시 exit 1.
 *
 * R+ — \`--json\` 플래그 (cycle 40): 머신 가독 출력. CI / 스크립트 / agent
 * 가 ANSI strip 없이 issue 행을 그대로 파싱.
 *
 * R+ — \`--strict\` 플래그 (cycle 42): warning 도 exit 1. CI 가 missing-
 * expected-field (capability/element 의 domain 누락 등) 도 차단하려 할 때.
 * default 는 errors 만 fail.
 *
 * R+ — \`--fail-on=<code1,code2,...>\` (cycle 43): 특정 issue code 만 fail.
 * \`--strict\` 보다 우선 — listed code 들에 해당하는 issue 1+ 시 exit 1,
 * 나머지는 무시. CI 가 점진적으로 특정 violation 만 hard-gate 하려 할 때.
 */
export function runValidate(args) {
  const json = args.includes('--json');
  const strict = args.includes('--strict');
  const failOn = parseFailOn(args);
  const vaultPath = resolve(args.find((a) => !a.startsWith('--')) || '.');
  const files = walkMd(vaultPath);
  const reports = [];
  let errorFiles = 0;
  let warningFiles = 0;

  for (const file of files) {
    let raw;
    try {
      raw = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    const report = validateVaultDocument(raw);
    if (report.issues.length === 0) continue;
    reports.push({
      file: relative(process.cwd(), file),
      report,
    });
    if (report.issues.some((i) => i.severity === 'error')) errorFiles += 1;
    else warningFiles += 1;
  }

  // R+ — JSON 출력은 항상 같은 shape (clean vault 도 problems: [] 로). caller
  // 가 .summary.errorFiles 만 보고 분기 가능 — text 모드의 분기 없는 단일
  // structure.
  const groups = groupIssuesByCode(reports);
  if (json) {
    const byCode = {};
    for (const g of groups) {
      byCode[g.code] = {
        severity: g.severity,
        count: g.count,
        files: g.files,
      };
    }
    process.stdout.write(
      JSON.stringify(
        {
          scanned: files.length,
          problems: reports.map(({ file, report }) => ({
            file,
            issues: report.issues.map((i) => ({
              code: i.code,
              severity: i.severity,
              message: i.message,
            })),
          })),
          summary: {
            problemFiles: reports.length,
            errorFiles,
            warningFiles,
            byCode,
            strict,
            failOn,
          },
        },
        null,
        2,
      ) + '\n',
    );
    return decideExit(errorFiles, warningFiles, strict, failOn, groups);
  }

  if (reports.length === 0) {
    console.log(
      `${COLORS.green}[validate] ${files.length} 파일 스캔 — issue 0. vault clean ✓${COLORS.reset}`,
    );
    return 0;
  }

  // strict 모드 안내는 마지막 summary 줄에서 처리.

  for (const { file, report } of reports) {
    console.log(`\n${file}`);
    for (const issue of report.issues) {
      const color =
        issue.severity === 'error' ? COLORS.red : COLORS.yellow;
      const tag = issue.severity === 'error' ? '✗ ERROR' : '▲ WARN ';
      console.log(`  ${color}${tag}${COLORS.reset}  [${issue.code}] ${issue.message}`);
    }
  }

  // R+ — issue code 별 그룹 요약. 큰 vault 에서 같은 종류 경고가 30+ 줄 흐를
  // 때 *어느 코드가 얼마나 많은지* 한눈에. 2+ 회 등장한 code 만 노출 — 1
  // 회짜리는 위 per-file 출력으로 충분.
  // (groups 는 위에서 한 번 빌드해놨음 — JSON / fail-on / 텍스트 모두 공유.)
  const repeatedCodes = groups.filter((g) => g.count >= 2);
  if (repeatedCodes.length > 0) {
    console.log(`\n${COLORS.dim}── grouped by code ──${COLORS.reset}`);
    for (const g of repeatedCodes) {
      const color = g.severity === 'error' ? COLORS.red : COLORS.yellow;
      const tag = g.severity === 'error' ? '✗' : '▲';
      const head = g.files.slice(0, 3).join(', ');
      const tail = g.files.length > 3 ? ` (+${g.files.length - 3} more)` : '';
      console.log(
        `  ${color}${tag}${COLORS.reset} ${g.code} — ${g.count} occurrence${g.count === 1 ? '' : 's'}` +
          `\n     ${COLORS.dim}${head}${tail}${COLORS.reset}`,
      );
    }
  }

  let modeTag = '';
  if (failOn && failOn.length > 0) {
    const matched = failOn.filter((code) => groups.some((g) => g.code === code));
    if (matched.length > 0) {
      modeTag = ` ${COLORS.dim}[--fail-on=${failOn.join(',')}: matched ${matched.join(',')}]${COLORS.reset}`;
    } else {
      modeTag = ` ${COLORS.dim}[--fail-on=${failOn.join(',')}: no match → exit 0]${COLORS.reset}`;
    }
  } else if (strict && warningFiles > 0) {
    modeTag = ` ${COLORS.dim}[--strict: warning 도 exit 1]${COLORS.reset}`;
  }
  console.log(
    `\n[validate] ${files.length} 파일 / ${reports.length} 문제 ` +
      `(${COLORS.red}error ${errorFiles}${COLORS.reset} · ` +
      `${COLORS.yellow}warning ${warningFiles}${COLORS.reset})${modeTag}`,
  );
  return decideExit(errorFiles, warningFiles, strict, failOn, groups);
}

// 우선순위: --fail-on (있으면 그것만) > --strict > default (errors only).
function decideExit(errorFiles, warningFiles, strict, failOn, groups) {
  if (failOn && failOn.length > 0) {
    return groups.some((g) => failOn.includes(g.code)) ? 1 : 0;
  }
  if (errorFiles > 0) return 1;
  if (strict && warningFiles > 0) return 1;
  return 0;
}

function parseFailOn(args) {
  // \`--fail-on=code1,code2\` 또는 \`--fail-on code1,code2\`. 비어 있거나
  // 지정 안 됐으면 null.
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--fail-on') return splitCsv(args[i + 1]);
    if (a.startsWith('--fail-on=')) return splitCsv(a.slice('--fail-on='.length));
  }
  return null;
}

function splitCsv(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const out = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return out.length > 0 ? out : null;
}

/**
 * reports 를 issue code 별로 묶는다. severity 는 같은 code 내에서 max
 * (error > warning) — 한 code 가 양쪽으로 등장하면 더 높은 severity 표시.
 * files 는 등장 순 dedup. count 는 같은 file 의 같은 code 가 여러 번이어도
 * file 당 1로 카운트 (사용자 입장에서 "몇 개 file 이 영향받았나" 가 더 유용).
 */
function groupIssuesByCode(reports) {
  const map = new Map();
  for (const { file, report } of reports) {
    const seenInFile = new Set();
    for (const issue of report.issues) {
      const key = issue.code;
      if (seenInFile.has(key)) continue;
      seenInFile.add(key);
      if (!map.has(key)) {
        map.set(key, { code: key, severity: issue.severity, files: [], count: 0 });
      }
      const entry = map.get(key);
      if (issue.severity === 'error') entry.severity = 'error';
      entry.files.push(file);
      entry.count += 1;
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    // error 먼저, 그 안에서 count 내림차순
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
    return b.count - a.count;
  });
}
