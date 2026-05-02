"use client";

import { useLocalVault } from "@/features/docs-vault-local";
import { OntologyViewPage } from "@/views/ontology-view";
import { LandingPage } from "@/views/landing";

/**
 * 루트 `/` 진입 분기.
 *
 * R10 (auth 영구 제거) 이후 분기 pivot 이 *인증* → *vault 선택 여부* 로
 * 단순화. mission v2 + local-first.md 약속 그대로:
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
 */
export function RootEntryPage() {
  const vault = useLocalVault();
  if (vault.handle) return <OntologyViewPage />;
  return <LandingPage />;
}
