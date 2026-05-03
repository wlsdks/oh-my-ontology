interface DocsVaultHrefInput {
  slug?: string | null;
  hash?: string | null;
}

/**
 * `/docs/?slug=...#section` 형식의 vault href 빌더.
 *
 * single-user OSS — slug / hash 만 인자. 빈 입력이면 `/docs/` 만, slug
 * 만 있으면 `/docs/?slug=...`, hash 까지 있으면 fragment 도 append.
 */
export function buildDocsVaultHref({
  slug,
  hash,
}: DocsVaultHrefInput = {}): string {
  const normalizedSlug = slug?.trim();
  const normalizedHash = hash?.trim().replace(/^#/, '');

  const query = normalizedSlug ? `?slug=${encodeURIComponent(normalizedSlug)}` : '';
  return `/docs/${query}${normalizedHash ? `#${normalizedHash}` : ''}`;
}
