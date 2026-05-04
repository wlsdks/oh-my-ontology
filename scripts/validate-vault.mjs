#!/usr/bin/env node
// Vault validator CLI — frontmatter silent corruption 가시화.
//
// 사용법:
//   node scripts/validate-vault.mjs [vaultDir]
//   pnpm vault:validate
//
// 기본 vaultDir = docs/ontology (이 프로젝트의 dogfood vault).
// error 가 한 건이라도 있으면 exit 1, warning 만 있으면 exit 0.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "./lib/parse-frontmatter.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const KNOWN_VAULT_KINDS = [
  "project",
  "domain",
  "capability",
  "element",
  "document",
  "vault-readme",
];

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

function validate(raw) {
  const issues = [];

  const startsWithDelim = raw.startsWith("---");
  const closingIndex = startsWithDelim ? raw.indexOf("\n---", 3) : -1;

  if (startsWithDelim && closingIndex === -1) {
    issues.push({
      code: "unclosed-frontmatter",
      severity: "error",
      message:
        "frontmatter 시작 `---` 만 있고 끝 `---` 가 없습니다 — 노드로 인식되지 않습니다.",
    });
    return { ok: false, issues };
  }

  if (!startsWithDelim) {
    return { ok: true, issues };
  }

  const { frontmatter } = parseFrontmatter(raw);
  const keys = Object.keys(frontmatter);

  if (keys.length === 0) {
    issues.push({
      code: "parse-zero-keys",
      severity: "warning",
      message:
        "frontmatter 블록은 있지만 key 가 하나도 추출되지 않았습니다 — 들여쓰기 또는 콜론 누락 의심.",
    });
    return { ok: true, issues };
  }

  const rawKind = frontmatter.kind;
  const hasKindKey = "kind" in frontmatter;

  if (!hasKindKey) {
    issues.push({
      code: "missing-kind",
      severity: "warning",
      message:
        "frontmatter 에 `kind:` 가 없습니다 — graph 노드가 되려면 kind 가 필요합니다.",
    });
  } else if (typeof rawKind !== "string" || rawKind.trim() === "") {
    issues.push({
      code: "empty-kind",
      severity: "error",
      message: "`kind:` 값이 비어있습니다 — graph 노드로 인식되지 않습니다.",
    });
  } else if (!KNOWN_VAULT_KINDS.includes(rawKind.trim())) {
    issues.push({
      code: "unknown-kind",
      severity: "warning",
      message: `\`kind: ${rawKind.trim()}\` 는 인식되지 않는 값입니다. 인식되는 값: ${KNOWN_VAULT_KINDS.join(" / ")}.`,
    });
  }

  return {
    ok: !issues.some((i) => i.severity === "error"),
    issues,
  };
}

async function main() {
  const arg = process.argv[2];
  const vaultDir = arg
    ? path.resolve(process.cwd(), arg)
    : path.join(ROOT, "docs", "ontology");

  const files = await walk(vaultDir);
  const reports = [];
  let errorFiles = 0;
  let warningFiles = 0;

  for (const file of files) {
    const raw = await readFile(file, "utf8");
    const report = validate(raw);
    if (report.issues.length === 0) continue;
    reports.push({ file: path.relative(ROOT, file), report });
    if (report.issues.some((i) => i.severity === "error")) errorFiles += 1;
    else warningFiles += 1;
  }

  if (reports.length === 0) {
    console.log(
      `[validate-vault] ${files.length} 파일 스캔 — issue 0. vault clean ✓`,
    );
    process.exit(0);
  }

  for (const { file, report } of reports) {
    console.log(`\n${file}`);
    for (const issue of report.issues) {
      const tag = issue.severity === "error" ? "✗ ERROR" : "▲ WARN ";
      console.log(`  ${tag}  [${issue.code}] ${issue.message}`);
    }
  }

  console.log(
    `\n[validate-vault] ${files.length} 파일 / ${reports.length} 문제 (error ${errorFiles} · warning ${warningFiles})`,
  );

  process.exit(errorFiles > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
