# CHANGELOG

> 주요 변경 이력. 코드 commit 메시지가 *왜* 를 답하고, 이 파일은 *언제 / 어떤 surface 가 바뀌었는지* 를 답한다. PR 단위가 아닌 **사용자 가시 변화** 위주.
>
> 최신이 위. semver 도입 전 v0.x 단계라 날짜 기반.

---

## 2026-05-01 — Mode-aware CRUD + Builder rebrand

### 사용자 가시 변화

- `/` Landing — 정적 미니 토폴로지 SVG (14 노드 / 21 relations) + 3-step rail (markdown → 추출 → 토폴로지·트리·ERD) + Obsidian/Notion 비교 카피 + footer (MIT licensed · GitHub · 기술 스택). Marketing 섹션 (Why / Coming soon roadmap / Stats / framer-motion 애니메이션 / Sigma drift 배경) 은 모두 제거.
- `/projects/` — 비로그인 사용자 redirect 제거. list 즉시 노출. 비로그인 + vault 활성 사용자가 ProjectQuickCreatePanel 로 *vault 의 .md 직접 생성* 가능 (mode-aware).
- `/ontology/edit/` — '온톨로지 아틀라스' → **'온톨로지 빌더'** 로 rebrand. 헤더 5줄 → 1줄 + ⓘ 툴팁. max-w 1400 → 1800 으로 캔버스 확장. 비로그인 시 'Missing or insufficient permissions' raw 에러 안 보이고 ephemeral 캔버스만 자유.
- `/ontology/` — 'i' 아이콘 hover 툴팁 동작 + 카피 강화 (계층 + 빌더 진입 안내). '편집기' 버튼 → **'빌더 열기 →'** 인디고 fill prominent. 하단 footer 에 nodes/relations + mode + projection version 노출 (V1.0 강점 가시화).
- `/ontology/` 의 vault 모드 — `VaultOntologyStubsPanel` 노출. frontmatter (`kind`, `capabilities`, `elements`, `relates`, `dependencies`, `domain`) 가 즉시 stub 노드/엣지로 자라는 모습 시각화.
- OperationsNav '문서' 탭 — vault 활성 시 `/docs/` 로, 그 외 `/knowledge/` 로 분기.
- Landing / app 전체의 'Demo' 브랜드 잔재 → **`oh-my-ontology`** 로 정리 (page title / OG / twitter / PWA manifest).

### 새 entity / feature / shared 모듈

- `src/shared/lib/data-source-mode.ts` + `src/features/data-source-mode/` — 4 운영 모드 (Static / Local / Cloud / Hybrid) 인지 hook.
- `src/features/project-data-source/` — `useProjectMutations` mode-aware hook (local 은 vault 직접 쓰기, cloud 는 Firestore).
- `src/entities/docs-vault/lib/project-frontmatter.ts` — Project ↔ frontmatter 양방향 매퍼 + `buildProjectMarkdown`.
- `src/entities/docs-vault/lib/derive-ontology-from-vault.ts` — frontmatter → ontology stub 변환 (fast path, AI 추출 거치지 않음).
- `src/features/vault-ontology/` — useVaultOntology hook + VaultOntologyStubsPanel widget.
- `src/entities/local-fs-handle/` — File System Access 핸들의 entity 화 (multi-vault forward-compat).
- `src/entities/local-fs-handle/api/permission.ts` — `verifyHandlePermission(handle, mode, {ask})` 일반화 유틸.
- `src/entities/docs-vault/lib/build-local-manifest.ts` — `computeLocalVaultFingerprint` 함수 추가 (auto-refresh skip).

### 제거 / 정리

- `src/features/workspace-project-bridge/` — 통째 삭제 (771 줄 / 9 파일 / 50 tests). multi-account 컨테이너 어댑터 single-user 모드 전환 후 dead.
- `src/widgets/workspace-project-selector/ui/WorkspaceProjectSelector.tsx` — dead UI 230 줄 삭제.
- `src/shared/lib/account-scope.ts` — `appendWorkspaceProjectQuery` / `readRuntimeWorkspaceProjectId` stub 함수 제거.
- `src/shared/lib/use-workspace-project-query.ts` — 통째 삭제 + 3 consumer 의 dead destructure 정리.
- `useScopedAccountAccess` 의 `_accountId` 파라미터 제거 (11 call site 동시 정리).
- `src/views/account-settings/` 의 일부 + `src/widgets/account-menu/` 일부 — 더 이상 사용 안 되는 코드 path 정리.
- e2e audit spec 4 개의 dead `/admin/*` URL 7개 제거.
- LocalVaultPicker 의 off-canon palette (peachy / muted-red / indigo 변종) → 캐논 warning(244,183,49) / danger(229,72,77) / indigo(94,106,210) + 시멘틱 토큰으로 통일.
- LocalVaultPicker error 상태에 actionable 안내 한 줄 추가.

### 버그 fix

- `OntologyEditPage` 의 `accountId = null` 하드코드 제거 — ERD 캔버스 manual node 저장 가능 회복 (이전엔 항상 "계정이 확인되지 않았어요" 토스트로 fail).
- `useApprovedGraphFlow` 가 비로그인 시 Firestore 구독 시도 → raw permissions error — accountId === null 면 구독 skip + 빈 그래프 + loaded:true.
- frontmatter parser 가 multi-line YAML list (`capabilities:\n  - x`) 미지원 → 지원 추가.
- `useLocalVault` 의 manual `refresh` 도 fingerprint skip 적용 (auto-refresh 만 됐던 것).

### 신설 spec / docs (untracked, user review 대기)

- `docs/ONTOLOGY-MODEL-V2-DRAFT.md` — V1.0 강점 + V1.1~V1.5 단계별 진화 (qualifiers / literals / rich-refs / ActionType / cardinality) + V2 통합 statement 모델 + 90+ 항목 체크리스트 + Mermaid 도식 2개 + Glossary 50+ 용어 + 8 Open questions + 13 섹션.
- `docs/LOCAL-FIRST-SYNC.md` — 4 운영 모드 + 충돌 해소 5 원칙 + Hybrid 도입 전 4 open questions.
- `docs/OFFLINE-FIRST-UX-FLOW.md` — 6 사용자 상태 × 11 라우트 매트릭스 + 5-step 온보딩.
- `docs/ACTION-TYPE-SECURITY-DRAFT.md` — V1.4 ActionType 의 8 보안 항목 deepen.
- `docs/MODE-AWARE-CRUD.md` — 오늘 도입한 mode-aware 패턴 contributor 가이드 + anti-pattern 4 종.

### 검증 통과 상태

- 927 tests passing (131 test files)
- tsc 0 errors
- lint 0 errors (warnings 모두 pre-existing)
- Playwright 시각: `/`, `/projects/`, `/ontology/`, `/ontology/edit/`, `/docs/`, 8 라우트 audit 모두 console errors 0.
- 누적 commit: 약 30+ (이날 단일 세션). 누적 diff: -3000+ / +1500+ 라인 (정리 위주).

### Open questions (user 답 대기)

1. `/` 토폴로지가 활성 vault 가 있을 때 자동 전환되어야 하는가? (a/b/c)
2. share-doc 시스템 (`/share/[token]` + sharedDocs Firestore) 제거해도 되는가? (a/b)
3. V2 spec 의 P0/P1 Open questions Q1~Q8 (multi-vault 시점 / ActionType 인증 / dual-read 기간 / none vs unknown / extractionModelId 검증 / summary 마이그레이션 / literal naming scope / ActionInvocation 보존)

---

## 2026-04-30 이전

이전 변경은 이 CHANGELOG 도입 전 — git log 참조 (`git log --oneline 7b16945..ba1e102`).
