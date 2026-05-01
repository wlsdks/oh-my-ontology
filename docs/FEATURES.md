# FEATURES — oh-my-ontology

> 사용자가 **지금 실제로 사용 가능한** 기능 전수 인벤토리.
> 작성일: 2026-05-01 (refactor/first-principles-slim-1 main 머지 직후)
> 출처: routes audit · vault/mode-aware audit · ontology+search audit · auth/project/knowledge/settings audit (4 haiku agents 병렬 점검)

---

## 0. 한눈에

> **mission**: "사용자가 글을 쓰면 시스템이 개념·관계·근거를 자라게 한다. 토폴로지·트리·ERD 세 view 로 본다."
> **운영 모델**: 1인 도구. local-first vault. 로그인은 옵션.

```
입력          파싱            저장             출력
md 문서  →   frontmatter   →  vault 또는    →  토폴로지 (Sigma)
                              Firestore        트리 (계층)
                                               빌더 (xyflow ERD)
```

---

## 1. 모드 분기 (data source)

`useDataSourceMode()` hook 이 셋 중 하나를 결정:

| 모드 | 조건 | 동작 |
|---|---|---|
| **local** | vault 폴더 활성 | vault manifest 가 진실원, Firebase 호출 0 |
| **cloud** | Firebase 로그인 + vault 미활성 | Firestore onSnapshot 실시간 sync |
| **static** | 둘 다 없음 | 빌드 타임 demo manifest |

**효과**: 사용자가 vault 폴더를 열면 `/projects` · `/` · `/project/[slug]` 모든 곳에서 즉시 vault 데이터로 바뀜. mutation (생성/편집/삭제) 도 동일하게 mode-aware.

---

## 2. 라우트별 기능

### 토폴로지 + 검색

#### `/` — 토폴로지 홈 (Sigma WebGL)
- **렌더**: Sigma.js + Graphology + ForceAtlas2 — 전체 프로젝트를 공간 네트워크로 펼침
- **인터랙션**:
  - 노드 클릭 → ProjectDrawer (우측 슬라이드 패널)
  - 노드 hover → tooltip + 1-hop 이웃 강조
  - 드래그 / 휠 → pan / zoom
  - 좌측 Legend (kind 색 범례)
  - 우측 SigmaHubRail (degree 상위 허브 빠른 점프)
  - 하단 RegionNavigator (minimap)
- **단축키**: `⌘K` 검색 · `?` 단축키 시트
- **모드**: 모든 모드에서 동작 — 데이터 소스만 다름

#### `/docs` — Vault Picker / Doc Vault
- **로컬 폴더 선택** (File System Access API):
  - 폴더 선택 → 전체 `.md` 자동 스캔 → manifest 빌드
  - 파일 수 + 마지막 스캔 시각 ("방금 / 5초 전 / 3분 전")
  - 새로고침 / 닫기 / 재승인 버튼
  - 미지원 브라우저 / 권한 거부 / 접근 오류 사용자 친화 메시지
- **vault 활성 시 surface**:
  - 폴더 트리 + 사이드바 (pinned · 최근 · 태그)
  - 본문 viewer (마크다운 + frontmatter 메타바)
  - 폴더 토폴로지 view (Sigma) — 문서 간 링크 그래프
  - "vault frontmatter ontology" 패널 — frontmatter 만으로 추출된 stub 노드/엣지
  - 백링크 / 관련 문서 / 관계 레이더
  - 명령 팔레트 (vault 전용 — Daily Note, Scaffold Topology, 내보내기 등)
- **scaffoldTopology()**: 빈 vault 에 `projects/`, `README.md`, `categories.md`, `statuses.md`, 샘플 프로젝트 hub/leaf 자동 생성

### 프로젝트

#### `/projects` — 프로젝트 목록
- **mode-aware**: local 모드면 vault 의 `projects/*.md`, cloud 면 Firestore
- **검색 / 필터**: query · category · status · 표시 개수
- **카드별**: ontology 노드 카운트 배지, 빠른 작업 (편집 / 공유 링크 복사)
- **ProjectQuickCreatePanel** — 페이지 안에서 인라인 빠른 생성 (mode-aware)
- **CSV 내보내기** — 전체 다운로드
- **WorkspaceOntologyStrip** — 상단 ontology 요약 strip

#### `/project/[slug]` — 프로젝트 상세
- **렌더**: 메타 (이름·설명·태그·스택·상태·카테고리·시작/완료일·진행도·소유자·아이콘) + 의존성 그래프 + 토폴로지 미리보기
- **인라인 편집** (권한 시): description / status 등 즉시 수정
- **DependencyPicker**: 의존성 칩 multi-select + 검색 + cycle/missing 경고
- **공개 화면 share link** + 내부 admin link
- **Mission 7 원자 정합**: vault 의 `projects/<slug>.md` 로부터 모든 정보 자동 매핑

#### `/project/new` · `/project/[slug]/edit` — 에디터
- **풀 폼**: 이름·slug·설명·detail (markdown)·태그·스택·링크·의존성·아이콘·상태·카테고리·진행도·timeline·screenshots
- **자동 추천**: description 에서 다른 프로젝트 이름 발견 시 dependency 추천 chip
- **mode-aware mutation**: local → vault `.md` 작성/패치, cloud → Firestore upsert
- **저장 후 동작 선택**: "저장하고 계속 보기" / "저장하고 목록으로" / "저장하고 공개 화면으로"

#### `/project/fallback` — 정적 export 폴백
- Firebase Hosting rewrite 가 unknown slug 를 client-side Firestore 조회로 라우팅. 빌드타임에 모르는 동적 slug 도 정상 렌더.

### 온톨로지 3-view

#### `/ontology` — Tree (read-only)
- **계층 구조**: project → domain → capability → element (문서 노드는 근거로만 기여, 트리 제외)
- **노드 클릭** → 우측 detail 패널:
  - kind / title / 요약 / project 연결 / 근거 문서 수
  - **ego 그래프** — 1-hop / 2-hop toggle SVG
  - 이웃 리스트 (방향 → / ←) — 클릭 점프
  - 근거 문서 링크
  - "+ 관계 추가" — 모달
  - "노드 링크 복사" — `/ontology/?node=<id>` deeplink
- **상단 pill**: 노드 추가 / 검색 (⌘K) / 빌더 열기 → / 인사이트 / 관계 / 검수 큐
- **통계 카드**: 트리 노드 / 관계 / 근거 문서 / 미해결 stub / 마지막 발행
- **stub 처리**: 미해결 참조 → "승격" (kind 선택) / "폐기" 액션

#### `/ontology/edit` — Builder (xyflow ERD)
- **palette (좌)**: 4 kind 클릭 → 캔버스 가운데에 새 임시 노드 (인디고 dashed)
- **연결**: 노드 가장자리 점에서 drag → 다른 노드에 drop → 임시 관계 edge
- **Inspector (우)**: 임시 노드 선택 시 이름 + 저장 → `knowledgeApprovedNodes/Edges` 로 commit
- **md 내보내기**: ephemeral 노드/엣지를 frontmatter 마크다운으로 download
- **fullscreen toggle**: F 키 또는 우상단 Maximize 버튼 — OperationsNav 숨김 + 풀 viewport
- **단축키**: N (새 project 노드) · F (전체 화면) · Del (선택 삭제) · Esc (선택 해제 / 전체 화면 종료)
- **빌더 onboarding**: 첫 진입 + 빈 캔버스에 3-step coach mark (다시 보지 않기 토글)
- **layout**: 단순 grid (이전 dagre 의존 dropped — commit "dagre 의존성 드롭")

#### `/ontology/insights` — 인사이트
- **kind 분포** (막대), **프로젝트별 분포** (정렬), **관계 type 분포**
- **cross-project 관계** 비율 / 절대값
- **허브 노드 top 10** (degree, 문서·project 제외)
- **최근 활동 10건** (상대 시간)
- **30일 활동 타임라인** (일자별 승인 막대)
- **미연결 노드** (orphan, amber 강조)
- 모든 항목 클릭 → `/ontology/?node=<id>` 로 점프

#### `/ontology/relations` — 관계 분포
- **edge type 분포** (좌) — 클릭 toggle 필터
- **강한 관계 top 12** (evidence 풍부한 순) — from → type → to + cross chip + evidence count

### 지식 (Cloud — AI 영역 부분 비활성)

#### `/knowledge` — 대시보드
- 문서 통계 카드, 빠른 진입 액션
- vault 모드 활성 시 "vault summary" 카드 노출

#### `/knowledge/documents`
- 목록 + 검색 + 필터 (project / 문서 유형 / 상태 / 분석 상태)

#### `/knowledge/documents/new`
- 새 문서 등록 — 제목 / 마크다운 본문 / 프로젝트 다중 태깅
- **mode-aware projects**: vault 프로젝트도 picker 에 등장 (review M1)
- 템플릿 (명세 / 결정 기록), 입력 규칙 안내

#### `/knowledge/documents/view?id=...`
- 문서 상세 — 메타 / 마크다운 렌더 / 버전 이력 / 분석 결과 (AI 영역)
- "분석 시작" 버튼 — Cloud Functions 호출 (현재 비용 우려로 비활성)

#### `/review/knowledge` — 검수 워크스페이스
- AI 추출 결과를 골라 영구 그래프에 반영
- 좌(원본 마크다운) — 우(추출 결과) 분할
- 후보·근거·연결 chip + 일괄 승인 / 부분 승인 / 거절
- **local 모드 안내 banner** (T9): "vault frontmatter 자체가 자기-승인" + vault 열기 / 빌더 열기 → CTA

### 인증 / 계정

#### `/login`
- email + password
- Google OAuth (popup)
- 데모 로그인 (read-only 데모 워크스페이스)
- 비밀번호 재설정 link

#### `/signup`
- displayName + email + password (8자+) + 확인
- 회원가입 후 자동 로그인

#### `/reset-password`
- 이메일 → Firebase 비밀번호 재설정 메일 발송

#### `/account` (게스트는 `/login?next=/account` 로 redirect)
- **내 정보**: 이름 · 이메일 · 로그인 방식 (provider)
- **비밀번호 변경**: 현재 + 신규 + 확인 (Firebase email/password 사용자만)
- **비밀번호 재설정 메일** 재전송
- 로그아웃은 PublicAccountMenu 에서

### 운영 / 설정

#### `/diagnostics/insights` — 오늘 챙길 곳
- **stale 프로젝트** (30일+ 무수정)
- **orphan** (in/out edge 0)
- **promotion 후보** (fan-in 높은 비-허브)
- 각 항목 → 편집 / 상세 / 토폴로지 jump

#### `/settings` — 정리 허브
- iOS Settings 결의 grouped list, drill-in
- 그룹: 지도 정비 (categories · statuses · 가져오기 · ontology) · 오늘 점검 (insights)

#### `/settings/categories` — 카테고리
- 라벨 / 설명 / 톤 (indigo · amber · neutral) / 캔버스 영역 편집기

#### `/settings/statuses` — 상태
- lifecycle 라벨 / dot 색 / 정렬

#### `/settings/import` — 프로젝트 가져오기
- CSV 일괄 업로드 (mode-aware)

#### `/settings/ontology` — TBox 보기
- 활성 TBox 클래스 / 관계 read-only

#### `/settings/ontology/history` — TBox 버전 이력
- 스키마 snapshot list

---

## 3. 기능 그룹별 정리

### 3.1 Vault Local-First

| 기능 | 진입점 | 효과 |
|---|---|---|
| 폴더 선택 (FSA) | `/docs` LocalVaultPicker | OS 폴더 → manifest |
| Manifest 빌드 | 자동 (선택 시) | 프론트매터 · 백링크 · 헤딩 · excerpt |
| Fingerprint 변경 감지 | 자동 (탭 포커스 시) | IDE 편집 후 돌아오면 재스캔 (debounce 2s) |
| Handle 영속화 | IndexedDB (`local-fs-handle`) | 새로고침 후 재승인만 누르면 복원 |
| createDoc / saveDoc / deleteDoc / renameDoc | 명령 팔레트 / 인라인 편집 | mode-aware mutation |
| `updateFrontmatter` | useProjectMutations | 본문 보존 + frontmatter 패치 |
| Backlink rewrite | renameDoc 시 best-effort | 다른 파일의 `[[oldSlug]]`, `[text](old.md)` 자동 치환 |
| Scaffold | 명령 팔레트 | 빈 vault 에 README + projects/ + 샘플 |

### 3.2 Mode-Aware Adapters

| Hook | 책임 |
|---|---|
| `useDataSourceMode()` | local / cloud / static 결정 |
| `useProjects(accountId)` | mode 별 프로젝트 read (sync local / subscribe cloud) |
| `useProjectMutations()` | mode 별 CRUD (vault file write / Firestore upsert) |
| `TaxonomyProvider` | local/static 모드는 defaults, cloud 만 subscribe |
| `useLocalVault()` | manifest + handle + 명령들 |

**적용 surface**: HomePage / ProjectSelectorPage / ProjectDetailPage / ProjectForm / KnowledgeDocumentNewPage / MountedGlobalSearch / DependencyPicker (parent prop) / TaxonomyProvider

### 3.3 검색

| 종류 | 단축키 | 진입점 |
|---|---|---|
| 프로젝트 SearchPalette | `⌘K` (홈) | 토폴로지 / 프로젝트 화면 |
| 글로벌 검색 (ontology + 문서 + 프로젝트) | `⇧⌘K` | 모든 페이지 |

**기능**: 한·영 fuzzy match · kind 필터 칩 · project 필터 칩 · 키보드 nav (↑↓ Enter Esc) · 빈 query 시 source 별 샘플 표시.

### 3.4 Frontmatter 파서 (T16 으로 강화)

| 형식 | 예시 |
|---|---|
| Scalar | `name: foo` / `count: 42` / `active: true` |
| Quoted | `desc: "hello: world"` |
| Inline list | `tags: [a, b, c]` |
| Block list | `items:\n  - a\n  - b` |
| **Inline object** | `pos: { x: 1, y: 2 }` |
| **Block object** | `pos:\n  x: 1\n  y: 2` |

object value 안에서는 `'true'/'false'/숫자` 자동 typed. `applyFrontmatterUpdates()` 로 본문 보존하며 패치 (null = key 삭제).

scripts/build-docs-vault.mjs 와 src/shared/lib/parse-frontmatter.ts 가 capability 동기화 (review M2).

### 3.5 Vault Frontmatter → Ontology Stub

frontmatter 키:
- `kind:` (project / capability / element / domain / decision / workflow / ...)
- `title:` (또는 # 첫 헤딩 / 파일명 fallback)
- `domain:` (단일 domain 노드 후보)
- `capabilities: []` / `elements: []` (배열 노드)
- `relates: []` / `dependencies: []` (edge 후보)

→ 출력: `OntologyStubNode[]` + `OntologyStubEdge[]` + warnings. AI 추출 거치지 않은 fast-path. /docs 와 /ontology 에서 즉시 가시화.

### 3.6 권한

| 역할 | 동작 |
|---|---|
| 비로그인 / guest | 공개 surface (홈 토폴로지 read) + vault 모드 풀 사용 가능 |
| 데모 세션 | `/login` 데모 버튼 → read-only 데모 데이터 |
| Firebase 인증 사용자 | 자기 데이터 풀 권한 (1인 도구) |
| `admins/{email}` 화이트리스트 | 전역 카테고리 / 진단 / TBox 운영 — 일반 사용자는 자기 공간 풀권 |

`PermissionGate` 컴포넌트가 own-space / membership / admin 분기 처리.

### 3.7 모바일 / 반응형

| 기능 | 위치 | 동작 |
|---|---|---|
| **BottomTabBar** | `src/widgets/bottom-tab-bar/` | 모바일 (md 미만) 화면 하단 고정 탭바 — 지도 · 프로젝트 · 문서 · 정리. 데스크톱은 OperationsNav 가 같은 destination 제공 |
| **GestureHint** | `src/widgets/gesture-hint/` | 터치 디바이스에 토폴로지 첫 진입 시 swipe 제스처 안내 |
| **safe-area / 안전 영역** | OperationsNav 모바일 모드 | iOS 노치 + BottomTabBar 와 충돌 회피 |
| 모바일 detail sheet | `/ontology` 트리 | 데스크톱은 우측 panel, 모바일은 화면 하단 고정 sheet |

### 3.8 테마 / 접근성 / 알림

| 기능 | 위치 | 동작 |
|---|---|---|
| **ThemeToggle (Light/Dark)** | OperationsNav 우측 + `src/features/theme-toggle/` | `html[data-theme="light"]` toggle. 기본 다크. localStorage 영속 |
| **Toast** | `useToast()` (`src/shared/ui/toast.tsx`, sonner 기반) | 50+ 호출처. `show(message, tone)` API. success / error / warning / info |
| **LiveAnnouncer** | `src/shared/ui/live-announcer.tsx` | aria-live region — 토폴로지 노드 선택 / 검색 결과 변경 등을 스크린리더에 announce |
| **Tooltip** | `src/shared/ui` (Radix 기반) | 모든 아이콘 / 단축키 안내 |
| **prefers-reduced-motion** | globals.css base layer | 자동 존중 — Sigma pulse / framer-motion 모두 |

### 3.9 부가 위젯 (홈 / 빌더 보조)

| 위젯 | 진입점 | 역할 |
|---|---|---|
| **DocsQuickDrawer** | `/` 토폴로지 (📁 아이콘) | vault 문서 빠른 미리보기 drawer — pin 한 문서 / 최근 / 트리 inline |
| **WorkspaceOntologyStrip** | `/` `/projects` 헤더 | 현재 ontology 통계 strip — 매치 0 자동 숨김 |
| **ProjectKnowledgeTopologyScene** | `/` 노드 선택 시 | 해당 프로젝트의 knowledge graph 상세 scene |
| **OntologyOutputBadges** | `/review/knowledge` | 검수 후보의 출력 배지 (얼마나 신뢰 가능한지 등) |
| **CandidateOntologyMatch** | `/review/knowledge` | 추출 후보 ↔ 기존 ontology 노드 유사도 매칭 |
| **OntologyStubList** | `/review/knowledge` + `/ontology` | 미해결 stub 노드 list + 승격 / 폐기 액션 |

### 3.10 단축키

| 키 | 위치 | 효과 |
|---|---|---|
| `⌘K` / `Ctrl+K` | 어디서나 | 검색 팔레트 |
| `⇧⌘K` | 어디서나 | 글로벌 검색 (ontology + 문서) |
| `?` | 어디서나 | 단축키 시트 |
| `Esc` | 모달 / 빌더 | 닫기 / 선택 해제 |
| `N` | `/ontology/edit` | 새 project 노드 |
| `F` | `/ontology/edit` | 전체 화면 toggle |
| `Del` / `Backspace` | `/ontology/edit` | 선택 노드 삭제 |
| `↑` / `↓` | 검색 / 트리 | 항목 이동 |

---

## 4. 데이터 흐름 (Single source 원칙)

```
md 파일 (vault 또는 cloud)
  │
  ├─→ manifest (vault) / Firestore (cloud)
  │
  ├─→ Project[] ← useProjects (mode-aware)
  │
  ├─→ frontmatter → derive-ontology-from-vault → OntologyStub[] (local)
  │                       또는
  │   AI 추출 → knowledgeApprovedNodes/Edges (cloud, 비용 비활성 중)
  │
  └─→ topology (Sigma) / tree / builder (xyflow)
```

---

## 4-B. 프레임워크 / 빌드타임 surface

| 항목 | 위치 | 동작 |
|---|---|---|
| **app/layout.tsx** | root layout | TaxonomyProvider + ToastProvider + 글로벌 스타일 |
| **app/page.tsx** | `/` 진입 | RootEntryPage — 비로그인이면 LandingPage, 그 외 HomePage |
| **app/manifest.ts** | `/manifest.webmanifest` | PWA manifest (icon · theme color · display mode) |
| **app/sitemap.ts** | `/sitemap.xml` | 정적 export 시 빌드된 모든 라우트 노출 |
| **app/robots.ts** | `/robots.txt` | 검색엔진 크롤 정책 |
| **app/not-found.tsx** | 404 페이지 | "길을 잃은" 카피 + 홈 / 이전 화면으로 복귀 CTA |
| **app/error.tsx** | route-level error boundary | "예기치 않은 오류" 카드 + 재시도 / 토폴로지 홈 (commit "client-error 제거" 후 console.error 만) |
| **app/global-error.tsx** | layout-level error boundary | 최후 방어 — body 자체가 새로 렌더 |
| **app/project/[slug]/opengraph-image.tsx** | OG 이미지 생성 | 프로젝트 상세 공유 시 동적 카드 이미지 |
| **app/diagnostics/page.tsx** | redirect | `/diagnostics/insights` 로 client-side replace |
| **app/review/page.tsx** | redirect | `/review/knowledge` 로 client-side replace |
| **app/project/fallback/** | 정적 export 폴백 | Firebase Hosting rewrite 가 unknown slug 를 client-side Firestore 조회로 라우팅 |

## 4-A. demo 데이터 구조 (현재)

`src/shared/mocks/demo-blueprint.ts` 의 `CONTAINER_THEMES`:

- **21 컨테이너** (Demo · Demo IAM · Demo Reactor · ... · Demo Onboarding · Demo Support)
- 각 컨테이너 10–20 hub × 5–10 node = **~2250 flat projects**
- cross-container 의존 1건씩 명시 (system boundary 시각화)
- `knowledgeDocuments` 200+ 자동 생성 (각 hub/top-node 별 3–5 문서)
- `knowledgeApprovedNodes/Edges` 는 **현재 비어있음** (AI 추출 결과가 demo 에 없음)

⚠️ **알려진 정체성 문제**: commit 10 (HomePage Layer 0 컨테이너 drill-down 제거) 이후 컨테이너 layer 가 사라져 토폴로지에 2250 노드가 flat 으로 펼쳐짐. Sigma + ForceAtlas2 가 dense 하게 그려서 결과적으로 **고-degree 허브만 시각적으로 도드라져 보임**. `/ontology` 는 비어있어서 사용자에게 "토폴로지 서비스" 인상 만드는 원인. → 별도 문서 [`PRODUCT-DIRECTION.md`](./PRODUCT-DIRECTION.md) 참고.

---

## 5. 제약 / 의도된 부재

- **Multi-account**: 없음 — `accountId = null` 고정 (v2 협업 단계로 보류)
- **외부 IAM**: 없음 — Firebase Auth (email/password + Google OAuth) 만
- **HTTP push API**: 없음 (commit "api-keys + receive-doc cascade 제거")
- **share link**: 없음 (commit "share-doc cascade 제거" — v2 협업)
- **GitHub webhook 활동 이력**: 없음 (commit "docs-vault-activity 제거")
- **AI 추출 클라이언트**: 없음 (commit "ontology-extraction 클라이언트 제거")
- **AI Cloud Functions**: 잔재 (extract-gemini.js + ontology-extract.js) — 비용 우려로 비활성
- **dev-admin-bypass**: 없음 (commit "dev-admin-bypass 인프라 + 41 callsite + 의존 e2e 정리")
- **/admin/*** 라우트: 없음 (deprecated, /settings/* /review/* /diagnostics/* 로 이전)
- **legacy redirect** (/project/topology, /project/view): 없음 (canonical /project/[slug] 만)

---

## 6. 검증 (refactor/first-principles-slim-1 머지 시점)

- tsc 0 errors
- eslint 0 errors (warnings 83 — 거의 모두 기존)
- vitest **117 files / 842 tests pass**
- Playwright 21 routes + 13 edge cases = **34 시나리오 0 console error**
- Code review (superpowers:code-reviewer) — Critical 0 / Major 3 모두 즉시 반영

---

## 7. 어디서부터 손대야 할지 — 사용자 워크플로

```
1. 새 사용자 (로그인 없이):
   /docs → "내 PC 마크다운 폴더 열기"
   → vault 활성 → / 토폴로지 + /projects 자동 인지

2. 새 프로젝트 추가:
   (a) vault 직접:
       projects/my-project.md 작성
       ---
       kind: project
       title: 내 프로젝트
       category: in-progress
       status: developing
       dependencies: [auth, billing]
       ---
       → 자동으로 / 와 /projects 에 등장

   (b) UI 빠른 생성:
       /projects → "새 프로젝트" 클릭 → ProjectQuickCreatePanel
       → vault `.md` 자동 생성 (mode-aware)

3. 온톨로지 개념 추가:
   (a) frontmatter 기반:
       문서에 kind: capability + relates: [...] 추가
       → /ontology 에 stub 으로 자동 등장

   (b) 빌더 직접:
       /ontology/edit → palette → 노드 클릭 → 핸들 drag → 저장

4. 둘러보기:
   ⇧⌘K (글로벌 검색) → kind 필터 → 점프
   /ontology → 트리 + ego graph 탐색
   /ontology/insights → 활동 / 허브 / orphan
```
