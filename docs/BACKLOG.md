# Backlog — oh-my-ontology

> 작업 *순번* 만. user 가 "T?? 진행해" 하면 그것만 분해해서 실행.
> 완료된 항목은 ✅ 표시 후 별도 batch 정리 시 일괄 삭제.

---

## ✅ 완료 (refactor/first-principles-slim-1 PR #1, main 머지 완료, 23 commits)

| # | 항목 | 결과 |
|---|---|---|
| T3+T4 | share-doc 시스템 제거 | ✅ entity + view + Firestore rules cascade 정리 |
| T5+T6 (부분) | AI 추출 *클라이언트* path 제거 | ✅ api-keys + ontology-extraction client + receive-doc. functions/extract-gemini · ontology-extract 는 보존 (user 비용 우려로 비활성, 향후 결정) |
| T7 | read 측 mode-aware (`useProjects` hook) | ✅ entities/docs-vault/lib/derive-projects-from-vault + features/project-data-source/use-projects |
| T8 | ProjectDrawer/Form/Detail mode-aware | ✅ ProjectForm + ProjectDetailPage + GlobalSearch + KnowledgeDocumentNewPage |
| T9 | 검수 큐 mode-aware 안내 | ✅ /review/knowledge 에 local 모드 banner |
| T10 | 빌더 fullscreen 토글 | ✅ F · Esc · 우상단 버튼 |
| T11 | 빌더 "트리로 보기" 시각 위계 | ✅ 약화된 텍스트 only |
| T14 | account-settings 단순화 | ✅ 369→280 줄 |
| T15 | dev-admin-bypass 단순화 | ✅ 인프라 + 41 callsite + 의존 e2e 정리 |
| T16 | frontmatter parser nested object | ✅ block + inline object 모두 지원 + 단위 테스트 10개 |
| T17 | 빌더 onboarding 카피 다듬기 | ✅ 한국어 동작 설명 + mission 약속 명시 |
| T25 | client-error 단순화 | ✅ entity 제거 → console.error |
| T26 | dagre layout 단순화 | ✅ dependency drop + grid layout |

부수 cleanup (BACKLOG 외):
- ✅ docs-vault-activity (GitHub webhook) cascade 제거
- ✅ project-activity entity + InsightsPage 슬림
- ✅ workspace-project entity + 4-layer cascade 완전 제거
- ✅ HomePage Layer 0 컨테이너 drill-down 제거
- ✅ legacy redirect (/project/topology, /project/view)
- ✅ TaxonomyProvider mode-aware

---

## 결정 필요 (P0 — answer 후 즉시 unblock)

### T1. `/` 자동 vault 전환 정책 결정
- **현 상황**: T7 mode-aware hook 으로 사실상 자동 전환 작동 (vault 활성 시 / 가 vault 데이터 표시).
- **추가로 필요한 결정**: `/?account=demo-workspace` 같은 명시 query 가 있을 때 vault 와 충돌 시 어느 쪽 우선?
  - (a) vault 가 항상 우선 (mission ideal)
  - (b) ?account= 가 명시되면 cloud (현재 동작)
  - (c) v0.x = b, v1.0 = a
- **답 후 작업**: 분기 변경 + 5-step 온보딩 hint

### T13. OperationsNav 온톨로지 탭 분기 결정
- **선택지**: (a) 빌더 / 트리 두 갈래로 분리 / (b) 현재 통합 유지 / (c) 토글 버튼만 추가
- **답 후 작업**: 1-2 commit

### AI 추출 cloud Functions 잔재 (T5+T6 마무리)
- **상황**: 클라이언트 path 는 제거됨. functions/extract-gemini.js + ontology-extract.js 는 남음.
- **선택지**: (a) 유지 — 추후 비용 허용 시 재활성화 / (b) 완전 제거 — knowledge-document-detail 의 "분석 시작" 버튼 + knowledgeJobs/Outputs 컬렉션 + 검수 큐 의존도 같이 삭제
- **답 후 작업** ((b) 시): 7000+ 줄 cascade

---

## Mission inconsistency 마무리

(없음 — T7, T8, T9 로 mode-aware 통합 완료)

---

## UX 다듬기 (small wins, additive)

### T12. NodeDetailPanel evidence excerpt modal
- 트리 row evidence chip 클릭 시 markdown 발췌 modal
- AI 영역 의존 — 비활성. T5/T6 결정 후

### T18. V1.1 — Qualifiers + Rank
- frontmatter 에 `since: 2024-Q1`, `via: REST`, `rank: deprecated`
- spec: `docs/ONTOLOGY-MODEL-V2-DRAFT.md` §2 + §10.2
- est: 5-7 commit, additive

### T19. V1.5 — Relation Cardinality
- "belongs_to.sourceCardinality = 'one'" 같은 1:1 / 1:N 제약
- spec: §6
- est: 3-5 commit

### T20. V1.3 — Rich References
- evidence 에 retrievedAt / extractionModelId / confidence
- spec: §4
- est: 3-5 commit

### T21. V1.2 — Literal Properties
- node 에 description / color / releasedAt 같은 atomic property
- needs: T18 stable
- est: 7-10 commit

### T22. V2 통합 KnowledgeStatement (5-phase)
- needs: T18-T21 모두 stable
- est: 30+ commit, 9-12 개월

---

## Cleanup / 회귀 차단

### T23. mode-aware e2e tests
- local / cloud / static 시나리오로 각 surface 검증
- needs: Firebase emulator 셋업
- est: 3-5 commit + 인프라

### T24. knowledge-* 컬렉션 통합 검토
- knowledge-version / knowledge-job / knowledge-output 컬렉션 합칠 수 있는지
- needs: AI 결정 (T5+T6)

### T27. KnowledgeDocumentDetailPage / KnowledgeReviewWorkspacePage 정리
- 둘 다 큰 파일 (수백 줄)
- needs: AI 결정 (T5+T6)

### Review backlog (이미 처리 일부)
- ✅ M1, m1, m2, m3, M2 — 모두 main 머지됨
- M3: docs/MODE-AWARE-CRUD.md taxonomy fork 명문화 — md 커밋 정책 확정 후
- m4: 비활성화된 e2e 재활성화 — Firebase emulator 셋업 (T23 와 같은 의존)

---

## 추천 진행 순서

1. **T1, T13** P0 결정 — 막힌 항목 해소
2. **AI Functions 결정** (T5+T6 b 면 큰 batch)
3. T18 (V1.1 qualifiers) → T19 → T20 → T21 — V1.x progressive
4. T23 e2e (Firebase emulator)
5. T22 V2 통합 — 마지막
