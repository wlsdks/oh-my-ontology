import type { VaultDoc } from "../model/types";

/**
 * vault doc → Project.slug 산정 — `fm.slug` 가 truthy 면 그것을 (앞뒤 공백
 * 제거), 그 외엔 파일 경로 기반 fileSlug:
 *   - `projects/foo` → `foo`
 *   - `ontology/project` → `project`
 *   - `bar` → `bar`
 *
 * deriveProjectsFromVault 와 buildTopologyDeeplinkForDoc 둘 다 같은 결과를
 * 내야 토폴로지 ?p= deeplink 가 drawer 를 정확히 연다. 한 곳만 갱신해 어긋
 * 나는 회귀를 방지하기 위해 본 helper 가 단일 source of truth.
 */
export function computeProjectSlug(doc: VaultDoc): string | null {
  const fm = doc.frontmatter ?? {};
  const fmSlugRaw = fm.slug;
  const fmSlug =
    typeof fmSlugRaw === "string" && fmSlugRaw.trim() ? fmSlugRaw.trim() : null;
  const fileSlug = doc.slug.startsWith("projects/")
    ? doc.slug.replace(/^projects\//, "")
    : doc.slug.split("/").pop() || doc.slug;
  return fmSlug ?? (fileSlug || null);
}
