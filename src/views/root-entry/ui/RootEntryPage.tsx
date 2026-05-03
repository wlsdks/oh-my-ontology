"use client";

import { useLocalVault } from "@/features/docs-vault-local";
import { OntologyViewPage } from "@/views/ontology-view";
import { LandingPage } from "@/views/landing";

/**
 * 루트 `/` 진입 분기 — vault 선택 여부에 따라 두 surface 로 갈림:
 *
 * - vault 미선택 → LandingPage (첫 인상 — "이게 뭔지" 5초 설명 + "내 폴더 열기" CTA)
 * - vault 선택됨 → OntologyViewPage (실제 hub — 트리 + ego graph + stub)
 *
 * vault picker 자체는 별도 `/docs` 라우트. LandingPage 의 "내 마크다운 폴더
 * 열기" 버튼이 그 곳으로 보낸다.
 *
 * 첫 visit 첫 paint: vault.handle 은 IndexedDB 에서 비동기 복원되므로
 * 잠깐의 초기값 (null) 동안 LandingPage 가 그대로 잡힌다 — 사용자가 vault
 * 를 진짜로 안 골랐는지, 단지 IDB 복원이 늦은 건지 구분이 어려운 ms 단위
 * 깜박임. UX 영향 거의 0 (사용자가 한 frame 안에 클릭 못 함).
 *
 * **`/` vs `/ontology` 의도적 dual-surface (R3 결정)** — vault 선택 시
 * 둘 다 `OntologyViewPage` 를 렌더하지만 *역할이 다름*:
 *   - `/` = home / back-link target / error fallback (10 inbound). 사용자
 *     머릿속 "기본 자리".
 *   - `/ontology` = explicit deep-link namespace (19 inbound — landing
 *     CTA / project overview / hub rails / global search / 노드 deep
 *     link `/ontology/?node=<id>`).
 * Round 3 에서 redirect 통합 검토했으나 codex 어드바이저 + inbound 매핑
 * 결과 한쪽으로 합치면 다른 쪽 inbound 가 깨짐 → keep both, 의도 명시.
 */
export function RootEntryPage() {
  const vault = useLocalVault();
  if (vault.handle) return <OntologyViewPage />;
  return <LandingPage />;
}
