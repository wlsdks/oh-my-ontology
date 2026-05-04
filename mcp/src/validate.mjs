/**
 * MCP 도구 입력 validation helpers.
 *
 * UI 와 parity 유지: src/views/ontology-edit/lib/is-untitled-title.ts 의
 * Inspector 검증과 같은 룰 — 비-empty, trim 후 비-empty 강제. AI agent 가
 * silent pollution (untitled / blank-title 노드) 만들지 못하게.
 */

/**
 * vault frontmatter 의 title 으로 안전한 값인지 판정.
 * 비-string, undefined, null, 빈 문자열, 공백-only 모두 reject.
 *
 * 사용처: addConcept (필수 입력), patchConcept (frontmatter 에 title 포함 시).
 *
 * @param {unknown} value
 * @returns {value is string}
 */
export function isValidVaultTitle(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

import { parseFrontmatter } from './parser.mjs';

/**
 * R11 #23 — vault frontmatter silent corruption 검출. src/shared/lib/
 * validate-vault-document.ts 와 같은 5 issue codes 보장 (drift 시 contract
 * test 가 차단). raw 까지 보고 unclosed/parse-zero 검출.
 *
 * issue codes:
 *  - unclosed-frontmatter (error)
 *  - empty-kind (error)
 *  - missing-kind (warning)
 *  - unknown-kind (warning)
 *  - parse-zero-keys (warning)
 *
 * @param {string} raw
 * @returns {{ ok: boolean, issues: Array<{code: string, severity: 'error'|'warning', message: string}> }}
 */
export const KNOWN_VAULT_KINDS = [
  'project',
  'domain',
  'capability',
  'element',
  'document',
  'vault-readme',
];

export function validateVaultDocument(raw) {
  const issues = [];
  const startsWithDelim = raw.startsWith('---');
  const closingIndex = startsWithDelim ? raw.indexOf('\n---', 3) : -1;

  if (startsWithDelim && closingIndex === -1) {
    issues.push({
      code: 'unclosed-frontmatter',
      severity: 'error',
      message:
        'frontmatter 시작 `---` 만 있고 끝 `---` 가 없습니다 — 노드로 인식되지 않습니다.',
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
      code: 'parse-zero-keys',
      severity: 'warning',
      message:
        'frontmatter 블록은 있지만 key 가 하나도 추출되지 않았습니다 — 들여쓰기 또는 콜론 누락 의심.',
    });
    return { ok: true, issues };
  }

  const rawKind = frontmatter.kind;
  const hasKindKey = 'kind' in frontmatter;

  if (!hasKindKey) {
    issues.push({
      code: 'missing-kind',
      severity: 'warning',
      message:
        'frontmatter 에 `kind:` 가 없습니다 — graph 노드가 되려면 kind 가 필요합니다.',
    });
  } else if (typeof rawKind !== 'string' || rawKind.trim() === '') {
    issues.push({
      code: 'empty-kind',
      severity: 'error',
      message: '`kind:` 값이 비어있습니다 — graph 노드로 인식되지 않습니다.',
    });
  } else if (!KNOWN_VAULT_KINDS.includes(rawKind.trim())) {
    issues.push({
      code: 'unknown-kind',
      severity: 'warning',
      message: `\`kind: ${rawKind.trim()}\` 는 인식되지 않는 값입니다.`,
    });
  }

  return {
    ok: !issues.some((i) => i.severity === 'error'),
    issues,
  };
}
