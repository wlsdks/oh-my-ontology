import { afterEach, beforeEach, describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { extractSummaryExcerpt, vaultSlugExists } from './vault.mjs';

let root;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'omot-vault-test-'));
  mkdirSync(join(root, 'capabilities'), { recursive: true });
  writeFileSync(join(root, 'README.md'), '---\nslug: README\n---\n');
  writeFileSync(
    join(root, 'capabilities', 'auth.md'),
    '---\nslug: capabilities/auth\nkind: capability\n---\n',
  );
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('vaultSlugExists', () => {
  it('실재하는 top-level slug 는 true', () => {
    assert.equal(vaultSlugExists(root, 'README'), true);
  });

  it('실재하는 subdir slug 는 true', () => {
    assert.equal(vaultSlugExists(root, 'capabilities/auth'), true);
  });

  it('없는 slug 는 false', () => {
    assert.equal(vaultSlugExists(root, 'capabilities/nope'), false);
    assert.equal(vaultSlugExists(root, 'phantom'), false);
  });

  it('빈 / null / undefined slug 는 false (throw 안 함)', () => {
    assert.equal(vaultSlugExists(root, ''), false);
    assert.equal(vaultSlugExists(root, null), false);
    assert.equal(vaultSlugExists(root, undefined), false);
  });

  it('vault 외부로 escape 시도하는 slug 는 false (throw 안 함)', () => {
    assert.equal(vaultSlugExists(root, '../etc/passwd'), false);
    assert.equal(vaultSlugExists(root, '../../README'), false);
  });

  it('null byte injection 시도는 false', () => {
    assert.equal(vaultSlugExists(root, 'README\0evil'), false);
  });
});

describe('extractSummaryExcerpt (R+)', () => {
  it('prose 시작 — 첫 단락 그대로', () => {
    const body = '`@modelcontextprotocol/sdk` 기반 stdio JSON-RPC 서버. 16 도구 노출.\n\n다음 단락은 무시.';
    const r = extractSummaryExcerpt(body);
    assert.equal(r, '`@modelcontextprotocol/sdk` 기반 stdio JSON-RPC 서버. 16 도구 노출.');
  });

  it('H1 + 빈 줄 + prose — H1 skip 후 prose 만', () => {
    const body = '\n# MCP Server (16 tools)\n\n`@modelcontextprotocol/sdk` 기반 stdio JSON-RPC 서버.\n';
    const r = extractSummaryExcerpt(body);
    assert.equal(r, '`@modelcontextprotocol/sdk` 기반 stdio JSON-RPC 서버.');
  });

  it('H1 + 표 + prose — 표 skip 후 prose 만 (mcp-server 같은 dogfood pattern)', () => {
    const body = '\n# MCP Server\n\n| col1 | col2 |\n|---|---|\n| a | b |\n\n환경변수 설정 후 사용.\n';
    const r = extractSummaryExcerpt(body);
    assert.equal(r, '환경변수 설정 후 사용.');
  });

  it('코드블록 + prose — 코드 skip 후 prose 만', () => {
    const body = '```js\nconst x = 1;\nconst y = 2;\n```\n\nprose paragraph.';
    const r = extractSummaryExcerpt(body);
    assert.equal(r, 'prose paragraph.');
  });

  it('multi-line prose — 한 줄로 join', () => {
    const body = '첫 줄.\n둘째 줄.\n셋째 줄.';
    const r = extractSummaryExcerpt(body);
    assert.equal(r, '첫 줄. 둘째 줄. 셋째 줄.');
  });

  it('빈 / null body — 빈 문자열', () => {
    assert.equal(extractSummaryExcerpt(''), '');
    assert.equal(extractSummaryExcerpt(null), '');
    assert.equal(extractSummaryExcerpt(undefined), '');
  });

  it('block 만 있는 body — fallback (원본 trim, prose 0건)', () => {
    const body = '| a | b |\n|---|---|\n| 1 | 2 |';
    const r = extractSummaryExcerpt(body);
    // prose 못 찾았을 때 fallback — body 전체 (cap 안)
    assert.match(r, /\|/);
  });

  it('maxLen cap — 초과 시 … 부착', () => {
    const long = 'a'.repeat(900);
    const r = extractSummaryExcerpt(long, 800);
    assert.equal(r.length, 801); // 800 + '…'
    assert.ok(r.endsWith('…'));
  });

  it('list / 인용도 block 으로 인식 (-, *, > 모두)', () => {
    const body = '- item 1\n- item 2\n\n뒤에 오는 prose.';
    const r = extractSummaryExcerpt(body);
    assert.equal(r, '뒤에 오는 prose.');
  });
});
