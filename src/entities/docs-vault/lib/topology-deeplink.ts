import type { VaultDoc } from "../model/types";

/**
 * frontmatter.kind === 'project' 인 문서는 deriveProjectsFromVault 가
 * Project 엔티티로 변환해 토폴로지 그래프 노드로 등재한다. Project.slug
 * 산정 규칙 (fm.slug 우선, 없으면 `projects/` prefix 제거 / 마지막 경로
 * 세그먼트) 을 그대로 복제해 vault doc → 토폴로지 deeplink (?p=<slug>)
 * 를 만든다. 그 외 kind 는 토폴로지에 1:1 노드가 없으므로 null.
 *
 * 주의: 본 helper 의 slug 산정은 deriveProjectsFromVault.mapVaultDocToProject
 * 와 반드시 같이 가야 한다. 어긋나면 ?p= deeplink 가 drawer 를 못 연다.
 */
export function buildTopologyDeeplinkForDoc(doc: VaultDoc): string | null {
  const rawKind = doc.frontmatter?.kind;
  const kind = typeof rawKind === "string" ? rawKind.trim() : "";
  if (kind !== "project") return null;
  const fm = doc.frontmatter ?? {};
  const fmSlug =
    typeof fm.slug === "string" && fm.slug.trim() ? fm.slug.trim() : null;
  const fileSlug = doc.slug.startsWith("projects/")
    ? doc.slug.replace(/^projects\//, "")
    : doc.slug.split("/").pop() || doc.slug;
  const slug = fmSlug ?? fileSlug;
  if (!slug) return null;
  return `/topology/?p=${encodeURIComponent(slug)}`;
}
