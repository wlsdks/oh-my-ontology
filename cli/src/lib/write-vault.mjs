import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { buildMarkdown } from './parse-frontmatter.mjs';

/**
 * vault-relative slug → file path. AI agent / prompt injection 으로 악의적인
 * slug ('../../etc/passwd' 등) 가 들어와도 vault root 바깥의 파일을 가리키지
 * 못하도록 normalize 후 root 포함 검사. mcp/src/vault.mjs 의 slugToPath 와
 * 같은 contract.
 */
export function slugToPath(rootPath, slug) {
  if (typeof slug !== 'string' || slug.length === 0) {
    throw new Error('slug must be a non-empty string');
  }
  if (slug.includes('\0')) {
    throw new Error('slug must not contain a null byte');
  }
  const candidate = resolve(rootPath, `${slug}.md`);
  const normalizedRoot = resolve(rootPath);
  if (
    candidate !== normalizedRoot &&
    !candidate.startsWith(normalizedRoot + sep)
  ) {
    throw new Error(`slug points outside the vault root: "${slug}"`);
  }
  return candidate;
}

/**
 * 새 doc 작성. 디렉토리 자동 생성. 기존 파일 있으면 throw (덮어쓰기 절대
 * 안 함 — 사용자 작업 보호). mcp/src/vault.mjs 의 writeDoc 와 같은 contract.
 */
export function writeDoc(rootPath, slug, { frontmatter, body = '' }) {
  const filePath = slugToPath(rootPath, slug);
  if (existsSync(filePath)) {
    throw new Error(`Doc already exists: ${slug}`);
  }
  mkdirSync(dirname(filePath), { recursive: true });
  const md = buildMarkdown({ frontmatter, body });
  writeFileSync(filePath, md, 'utf-8');
  return filePath;
}
