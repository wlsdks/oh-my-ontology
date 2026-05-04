// Reference migration #1 — frontmatter scalar 의 trailing whitespace 정리.
//
// 예: `kind: project    ` → `kind: project`
//     `title: Foo     `  → `title: Foo`
//
// 동작 범위: frontmatter 블록 (--- 사이) 의 `key: value` 라인만. body 는 손대지
// 않음. inline list / inline object / block list 의 dash item 은 보수적으로
// skip (의도적 들여쓰기 가능성).
//
// idempotent — 두 번 돌려도 결과 동일.

export const id = "2026-05-04-trim-frontmatter-values";
export const description =
  "frontmatter scalar 라인의 trailing whitespace 정리.";

/**
 * @param {{ path: string; raw: string; relativePath: string }} file
 * @returns {{ raw: string } | null}
 */
export function migrate(file) {
  const { raw } = file;
  if (!raw.startsWith("---")) return null;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return null;

  const block = raw.slice(0, end);
  const rest = raw.slice(end);

  const lines = block.split("\n");
  let changed = false;
  const transformed = lines.map((line, idx) => {
    if (idx === 0) return line; // leading ---
    // dash list item — leave indentation as-is
    if (/^\s+-\s/.test(line)) return line;
    // `key: value` — trim trailing whitespace from the right side only
    const m = line.match(/^([^:]*:\s*)(.*?)(\s+)$/);
    if (!m) return line;
    // m[3] is the trailing whitespace; rebuild without it
    const next = `${m[1]}${m[2]}`;
    if (next !== line) changed = true;
    return next;
  });

  if (!changed) return null;
  return { raw: transformed.join("\n") + rest };
}
