// Unit tests for writeDoc + resolveSlug — Add concept command (R13 #51).
// node --test src/write-vault.test.mjs

import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeDoc, resolveSlug } from '../out/write-vault.js';

function withVault(fn) {
  const root = mkdtempSync(join(tmpdir(), 'omot-vscode-write-'));
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('resolveSlug — autoPrefix on, kind 별 folder 자동', () => {
  assert.equal(resolveSlug('capability', 'foo', true), 'capabilities/foo');
  assert.equal(resolveSlug('domain', 'auth', true), 'domains/auth');
  assert.equal(resolveSlug('element', 'jwt', true), 'elements/jwt');
});

test('resolveSlug — autoPrefix off 면 그대로', () => {
  assert.equal(resolveSlug('capability', 'foo', false), 'foo');
  assert.equal(resolveSlug('capability', 'auth/bar', false), 'auth/bar');
});

test('resolveSlug — 이미 prefix 있으면 두 번 안 붙임', () => {
  assert.equal(
    resolveSlug('capability', 'capabilities/foo', true),
    'capabilities/foo',
  );
});

test('resolveSlug — project / document 는 prefix 없음', () => {
  assert.equal(resolveSlug('project', 'main', true), 'main');
  assert.equal(resolveSlug('document', 'spec', true), 'spec');
});

test('writeDoc — 새 노드 작성 + 디렉토리 자동 생성', async () => {
  await withVault(async (root) => {
    const filePath = await writeDoc(root, 'capabilities/foo', {
      frontmatter: { slug: 'capabilities/foo', kind: 'capability', title: 'Foo' },
    });
    assert.ok(existsSync(filePath));
    const content = readFileSync(filePath, 'utf-8');
    assert.match(content, /slug: capabilities\/foo/);
    assert.match(content, /kind: capability/);
    assert.match(content, /title: Foo/);
    assert.match(content, /# Foo/);
  });
});

test('writeDoc — 기존 slug 면 throw (silent overwrite 차단)', async () => {
  await withVault(async (root) => {
    await writeDoc(root, 'capabilities/foo', {
      frontmatter: { kind: 'capability', title: 'Foo' },
    });
    await assert.rejects(
      () =>
        writeDoc(root, 'capabilities/foo', {
          frontmatter: { kind: 'capability', title: 'Dup' },
        }),
      /already exists/i,
    );
  });
});

test('writeDoc — 배열 frontmatter 는 block list 로 직렬화', async () => {
  await withVault(async (root) => {
    const filePath = await writeDoc(root, 'capabilities/bar', {
      frontmatter: {
        kind: 'capability',
        title: 'Bar',
        elements: ['src/a', 'src/b'],
      },
    });
    const content = readFileSync(filePath, 'utf-8');
    assert.match(content, /elements:\n {2}- src\/a\n {2}- src\/b/);
  });
});

test('writeDoc — body override', async () => {
  await withVault(async (root) => {
    const filePath = await writeDoc(root, 'foo', {
      frontmatter: { kind: 'document', title: 'Foo' },
      body: '\n# Custom heading\n\nSome body text.\n',
    });
    const content = readFileSync(filePath, 'utf-8');
    assert.match(content, /# Custom heading/);
    assert.match(content, /Some body text/);
  });
});

test('writeDoc — frontmatter 키 순서 (slug → kind → title → domain → 그 외)', async () => {
  await withVault(async (root) => {
    const filePath = await writeDoc(root, 'capabilities/qux', {
      frontmatter: {
        title: 'Qux',
        kind: 'capability',
        slug: 'capabilities/qux',
        domain: 'auth',
        relates: ['domains/auth'],
      },
    });
    const content = readFileSync(filePath, 'utf-8');
    const fmBlock = content.split('---')[1];
    const lines = fmBlock.trim().split('\n');
    assert.match(lines[0], /slug:/);
    assert.match(lines[1], /kind:/);
    assert.match(lines[2], /title:/);
    assert.match(lines[3], /domain:/);
  });
});
