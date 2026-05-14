import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import { parseOmotIgnore, refMatchesOmotIgnore } from './omot-ignore.mjs';

describe('parseOmotIgnore', () => {
  it('빈 줄 / 주석 / 부정(!) skip', () => {
    const patterns = parseOmotIgnore(`
# this is a comment
src/views/**

!keep-this

cli/src/commands/*.mjs
    `);
    assert.deepEqual(patterns, ['src/views/**', 'cli/src/commands/*.mjs']);
  });

  it('행 끝 / 는 strip', () => {
    assert.deepEqual(parseOmotIgnore('public/'), ['public']);
  });

  it('빈 입력은 빈 array', () => {
    assert.deepEqual(parseOmotIgnore(''), []);
    assert.deepEqual(parseOmotIgnore('\n\n# comment\n'), []);
  });
});

describe('refMatchesOmotIgnore', () => {
  it('* 는 / 제외 모든 문자', () => {
    assert.equal(refMatchesOmotIgnore('src/foo.ts', ['src/*.ts']), true);
    assert.equal(refMatchesOmotIgnore('src/views/foo.ts', ['src/*.ts']), false);
  });

  it('** 는 디렉토리 가로지름', () => {
    assert.equal(refMatchesOmotIgnore('src/views/foo.ts', ['src/**']), true);
    assert.equal(refMatchesOmotIgnore('src/views/deep/foo.ts', ['src/**']), true);
    assert.equal(refMatchesOmotIgnore('cli/views/foo.ts', ['src/**']), false);
  });

  it('** 가운데 — src/**/foo.ts', () => {
    assert.equal(refMatchesOmotIgnore('src/views/foo.ts', ['src/**/foo.ts']), true);
    assert.equal(refMatchesOmotIgnore('src/views/deep/foo.ts', ['src/**/foo.ts']), true);
    assert.equal(refMatchesOmotIgnore('src/foo.ts', ['src/**/foo.ts']), true);
    assert.equal(refMatchesOmotIgnore('src/views/bar.ts', ['src/**/foo.ts']), false);
  });

  it('? — 단일 문자', () => {
    assert.equal(refMatchesOmotIgnore('src/a.ts', ['src/?.ts']), true);
    assert.equal(refMatchesOmotIgnore('src/ab.ts', ['src/?.ts']), false);
  });

  it('exact match', () => {
    assert.equal(refMatchesOmotIgnore('mcp/src/index.js', ['mcp/src/index.js']), true);
    assert.equal(refMatchesOmotIgnore('mcp/src/index.mjs', ['mcp/src/index.js']), false);
  });

  it('여러 패턴 중 어느 하나라도 매치하면 true', () => {
    const patterns = ['src/**', 'mcp/src/*.mjs'];
    assert.equal(refMatchesOmotIgnore('src/views/foo.ts', patterns), true);
    assert.equal(refMatchesOmotIgnore('mcp/src/parser.mjs', patterns), true);
    assert.equal(refMatchesOmotIgnore('cli/src/index.mjs', patterns), false);
  });

  it('빈 patterns → 무엇도 매치 안 됨', () => {
    assert.equal(refMatchesOmotIgnore('anything', []), false);
    assert.equal(refMatchesOmotIgnore('anything', null), false);
    assert.equal(refMatchesOmotIgnore('anything', undefined), false);
  });

  it('정규식 메타 문자 안전 처리', () => {
    // path.with.dots — `.` 가 regex 에서 any-char 인데 우리 패턴은 literal 로 다뤄야 함
    assert.equal(refMatchesOmotIgnore('path.with.dots', ['path.with.dots']), true);
    assert.equal(refMatchesOmotIgnore('pathXwithXdots', ['path.with.dots']), false);
  });
});
