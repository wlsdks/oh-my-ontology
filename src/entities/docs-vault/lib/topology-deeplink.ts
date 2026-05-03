import type { VaultDoc } from "../model/types";
import { computeProjectSlug } from "./project-slug";

/**
 * frontmatter.kind === 'project' 인 문서는 deriveProjectsFromVault 가
 * Project 엔티티로 변환해 토폴로지 그래프 노드로 등재한다. 같은
 * slug 산정 helper (computeProjectSlug) 를 공유해 ?p=<slug> deeplink 가
 * drawer 를 항상 정확히 연다. 그 외 kind 는 토폴로지에 1:1 노드가 없으므로
 * null.
 */
export function buildTopologyDeeplinkForDoc(doc: VaultDoc): string | null {
  const rawKind = doc.frontmatter?.kind;
  const kind = typeof rawKind === "string" ? rawKind.trim() : "";
  if (kind !== "project") return null;
  const slug = computeProjectSlug(doc);
  if (!slug) return null;
  return `/topology/?p=${encodeURIComponent(slug)}`;
}
