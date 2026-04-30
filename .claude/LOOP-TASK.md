# Loop Task — oh-my-ontology 자율 진화 루프

> 이 문서는 `/loop 15m` 으로 호출되는 매 iteration 의 **단일 진실원**이다.
> 매 iteration:
> 1. 이 문서 전체를 읽는다.
> 2. **현재 phase / 다음 atomic task** 를 결정한다.
> 3. 단 하나의 atomic task 만 수행한다 (작게, 안전하게).
> 4. **Progress log** 에 한 줄 추가한다 (날짜·iter#·결과·다음 후보).
> 5. 끝.

---

## Mission

이 프로젝트는 **markdown 문서에서 키우는 오픈소스 온톨로지 워크벤치**다.
단순 트리/태그가 아니라 *진짜 온톨로지* 를 표현·진화시키는 도구가 되어야 한다.

루프의 목표는 **세 갈래**:

- **A. Task E 완료** — File System Access 실구현 (local-first 의 척추).
- **B. 일원리 사고로 제거 가능한 cruft 식별 → 제거** — "온톨로지 워크벤치" 가 아닌 모든 군더더기 정리.
- **C. 더 나은 온톨로지 표현법 도입** — 단순 트리 너머. Palantir Foundry / OWL / RDF / Property Graph / Schema.org 공개 자료 학습 후, 우리만의 표현 모델 설계.

세 트랙을 매 iteration **하나씩만** 전진시킨다 (병렬 X — context 가 흐려진다).

---

## 불변 규칙 (매 iteration 이걸 위반하지 말 것)

1. **AGENTS.md / `.claude/rules/*.md` 의 모든 규율 준수**. 특히:
   - FSD import 방향
   - 디자인 헌장 (인디고 + 무채색, glassmorphism · neon · scale hover 금지)
   - 영문 conventional prefix + 한국어 본문 커밋
   - `--no-verify` 금지, main force push 금지
   - docs-first (스키마 변경은 `docs/DATA-MODEL.md` 먼저)
2. **한 iteration = 한 atomic commit**. 빌드·타입·lint·test 가 모두 통과한 상태에서만 commit. 통과 못 하면 commit 하지 말고 다음 iter 로.
3. **검증 명령**: `pnpm exec tsc --noEmit && pnpm lint && pnpm test:run` — 영향받는 영역에 한해서만 돌려도 됨 (단, build 깨뜨릴 변경은 풀 verify).
4. **Palantir 직접 코드 차용 금지** — 공개 자료 (블로그, 컨퍼런스 발표, 백서, 공식 문서 페이지) 의 *아이디어와 모델링 패턴* 은 학습 가능. 사실/아이디어는 copyright 없음. 단, 그들의 UI 카피·proprietary 스키마 그대로 베끼기·trademark (Foundry, AIP) 를 우리 식별자에 박기 금지.
5. **파괴적 액션 금지 without 명시 승인** — 컬렉션 drop, 대규모 파일 삭제 (>10 files), git reset --hard, force push. 의심되면 다음 iter 로 미루고 user 승인 대기 표시.
6. **루프 자체를 수정하지 말 것** — 이 문서를 lyrics 만 갱신, 프로토콜 (Mission / 불변 규칙) 은 user 만 바꾼다.
7. **확신 없으면 진행하지 말 것** — Track C 의 모델 설계 같은 큰 결정은 *제안 PR* 만 만들고 user 승인 대기. 절대 main 에 직접 머지 금지.

---

## Track A — File System Access 실구현

### 목표 정의

Notion 처럼: 사용자가 로컬 markdown 폴더를 picker 로 골라 0 마찰로 토폴로지·트리·검수 흐름에 진입. 로그인은 옵션. 데이터는 디스크 + IndexedDB. 로그인 후엔 Firebase 와 sync (선택).

### 현재 상태 (2026-05-01 기준)

- `src/features/docs-vault-local/` 존재 — `model/use-local-vault.ts`, `ui/LocalVaultPicker.tsx`, `apply-frontmatter-updates.test.ts`.
- 진입점이지만 **handle 영속화 / IndexedDB 기반 store / 충돌 해결 / sync 정책** 은 아직 미구현 또는 부분구현으로 추정. 매 iter 시작 시 이 파일들 read 해서 현재 상태 확인.
- 새 entity `LocalFileSystemHandle` 미존재 (entities/ 목록에 없음).

### Atomic 분해 (의존 순서)

A0. **현황 정확히 캡처** — `src/features/docs-vault-local/` 전체 read · 무엇이 이미 있고 무엇이 부족한지 한 줄씩 정리해서 이 문서 "Track A 현황 메모" 에 추가.
A1. **타입 정의** — `src/entities/local-fs-handle/model/types.ts` 신설. `LocalFileSystemHandle` (id, name, kind, permissionState, createdAt, lastAccessedAt). 단위 test 1개 (타입 가드).
A2. **IndexedDB 어댑터** — `src/entities/local-fs-handle/api/indexeddb-store.ts`. handle put/get/list/delete. SSR-safe 가드 (`typeof window === 'undefined'` 가드). test: in-memory mock 으로 라운드트립.
A3. **권한 재요청 유틸** — `verifyPermission(handle, mode)` — `requestPermission` wrapper. test.
A4. **Picker UI 통합** — `LocalVaultPicker.tsx` 가 picker 결과를 IndexedDB 에 저장. 이미 등록된 vault 목록 보여주기 + "다시 권한 요청" 버튼. design 토큰 준수.
A5. **Document store 어댑터** — IndexedDB 가 아닌 **파일시스템이 진실원** 이 됨. `src/entities/knowledge-document/api/local-fs-source.ts` — `listDocuments(handle)`, `readDocument(handle, path)`, `writeDocument(handle, path, content)`, `watchDocuments(handle)` (polling). frontmatter 파싱 재사용.
A6. **Vault 활성화 상태** — `useLocalVault` hook 이 IndexedDB 기반 multi-vault 지원. 활성 vault 가 있으면 docs-vault 가 자동으로 그쪽 source 로 fall through.
A7. **충돌/동기화 정책 문서화** — `docs/LOCAL-FIRST-SYNC.md` 신설. "로컬 = 진실원, Firebase = optional 백업/공유" 단계별 정책. 충돌 = "로컬 우선, sync 시 last-write-wins per file 단, mtime 신뢰" 로 시작.
A8. **Offline-first UX 흐름** — 비로그인 사용자 라우팅: `/` 진입 시 활성 vault 없으면 `LocalVaultPicker` 우선 노출, 활성 vault 있으면 그걸 source 로 한 토폴로지. 로그인 옵션 표시 (강요 X).
A9. **회귀 차단 e2e** — Playwright e2e 1개: 폴더 picker → 문서 1개 보임 → 토폴로지 노드 1개 visible. (브라우저가 picker 막는 환경이면 mock).

### Track A 현황 메모

- (아직 채워지지 않음 — 첫 iter A0 에서 채울 것)

---

## Track B — 일원리 cruft 분석 → 제거

### 사고 프레임

매 iter 한 번에 *한 가지 질문*만:

> "X 가 없어도 사용자가 '온톨로지를 markdown 으로 키운다' 라는 mission 을 수행할 수 있는가?"

YES → **제거 후보**. NO → **유지 (다만 단순화 가능?)**.

### 제거 후보 식별 우선순위

B1. **사용자 모드 군더더기** — multi-account, workspace, member-management 가 v0.x (1인 도구) 단계에서 남아있나? 이미 정리 commit 들 (recent log 에 "drop AccountScopeSelector ui + useAccountScope hook" 등) 진행중. 남은 잔재 grep.
B2. **Admin 네임스페이스 잔재** — `src/entities/admin/`, `src/views/admin*` (있으면). `.claude/rules/forbidden.md` 가 "/admin/* 폐기" 라고 명시. 존재 시 제거 후보.
B3. **사용 안 되는 권한 게이트** — `permissions/`, `account-scope/` feature 가 default 흐름을 막지 않는데 코드만 남아있나?
B4. **중복 storage 어댑터** — Firebase Storage / IndexedDB / inline 의 중복 path. 단일 진실원 원칙 위반?
B5. **"공유" 흐름** — `share-doc/`, `project-share/` 가 v0.x 에 필요한가? mission 핵심은 *온톨로지 표현* 이지 공유 아님.
B6. **landing page** — 토폴로지 자체가 진입점이 더 좋다면 landing 은 제거 가능?
B7. **knowledge-version, knowledge-job, knowledge-output 의 분기** — 한 컬렉션에 합칠 수 있는가?
B8. **client-error entity** — 별도 entity 가 필요한가, shared/lib/log 로 충분한가?
B9. **dev-login view** — 개발자 편의용. local-first 면 진짜 비로그인 흐름이 default 인데 dev-login 이 따로 필요?
B10. **Dependencies** — `framer-motion`, `usehooks-ts`, `cmdk`, `react-hook-form`, `@hookform/resolvers` 중 인디고+무채색 단순 디자인에 과한 게 있나? (확인만 — 의존성 제거는 신중)

### Track B 현황 메모

- (첫 iter B1 에서 시작)

---

## Track C — 더 나은 온톨로지 표현법

### 학습 대상 (legal-safe 공개 자료)

- **Palantir Foundry / AIP** — 공식 docs 페이지 (palantir.com), 컨퍼런스 발표 (YouTube), 엔지니어링 블로그. 그들의 *Object-Type / Link-Type / Action-Type* 모델, *Ontology SDK* concept 가 우리 mission 과 가장 가까움.
  - 합법성 체크: 공개된 marketing/docs 페이지의 모델링 *아이디어* 학습은 fair use. 코드/UI 카피 / Foundry/AIP 등록 trademark 식별자 사용 금지. 의심되면 출처 명시 후 일반화.
- **OWL 2 / RDF / SKOS / SHACL** — W3C 표준. 공개. 우리는 light-weight subset 만 차용 (full OWL 은 과함).
- **Schema.org** — Google 표준. 공개. property graph 풍 표현법 참고.
- **Wikidata 모델** — items, properties, statements, qualifiers, references. 공개.
- **Neo4j Property Graph Model** — 공개 docs.
- **Notion Database / Obsidian Dataview** — 사용자 멘탈 모델 참고.

### 현재 모델 (추정)

`docs/DATA-MODEL.md` read 후 채울 것 (C0 에서).

### 가설 (검증 대상)

> **단순 tree 는 부족하다. Property graph + lightweight schema (object types + link types) 가 더 적합하다.**
> Trees 는 *분류* 만 표현. Real ontology 는 *concept ↔ concept 관계, qualified statements (with evidence), inheritance, equivalence* 가 필요. 우리 도메인 특성상 Property Graph + 가벼운 OWL-like class hierarchy 의 조합이 sweet spot 일 가능성.

### Atomic 분해

C0. **현재 model 캡처** — `docs/DATA-MODEL.md` 와 `src/entities/ontology-class/`, `src/entities/ontology-relation/`, `src/entities/ontology-tbox/` read · 우리가 이미 가진 표현력 정리.
C1. **외부 모델 1개 학습** — Palantir Object Type 모델 공개 docs (web search) 1번. 우리 모델과 차이/공통점 한 단락 (≤ 200 자).
C2. **외부 모델 N개** — C1 반복 (RDF/SKOS, Property Graph, Wikidata 순). 매 iter 한 모델만.
C3. **합성 제안** — 우리 도메인 + 학습 종합. `docs/superpowers/specs/ONTOLOGY-MODEL-V2.md` 초안 (단, **제안 단계** — main merge 안 함, user 승인 대기).
C4. **점진 마이그레이션 plan** — 기존 데이터 호환성 유지하며 V2 도입 단계 분해.

### Track C 현황 메모

- (첫 iter C0 에서 시작)

---

## Iteration protocol (매 iter 정확히 이대로)

```
1. 이 문서 read (LOOP-TASK.md 전체).
2. Progress log 의 마지막 entry 확인.
3. 다음 atomic 결정 규칙:
   - log 가 비어있으면 → A0.
   - 마지막이 Track A 였으면 → 다음은 Track B 의 다음 미완료 atomic.
   - 마지막이 Track B 였으면 → Track C 의 다음 미완료 atomic.
   - 마지막이 Track C 였으면 → Track A 의 다음 미완료 atomic.
   - (라운드로빈으로 세 트랙 균등 진전)
4. 해당 atomic 만 수행. 다른 거 손대지 말 것. 충동 억제.
5. 변경 발생 시: 검증 실행 → 통과 시 commit (영문 prefix + 한국어 본문) → log entry 기록.
   변경 없는 iter (예: C1 외부 학습 read-only) 는 commit 없이 log 만 갱신.
6. log entry 형식: `- YYYY-MM-DD iter#N — TrackX/Atomic_id — 한 줄 결과. 다음 후보: …`
7. 끝. (다음 atomic 으로 자동 진행 금지 — 다음 iter 까지 대기)
```

---

## Progress log

(매 iter 마지막에 한 줄씩 추가. 신규 entry 는 **맨 위**에)

- 2026-05-01 iter#0 — bootstrap — 이 문서 생성, /loop 15m 시작. 다음 후보: A0 (docs-vault-local 현황 캡처).

---

## Open questions for user (필요 시 여기 적고 user 답 대기)

- (없음)

---

## Stop conditions (자동 종료 조건)

루프는 다음 중 하나를 만나면 user 승인 없이 진전 중단하고 Open questions 에 기록:

- 어떤 atomic 도 수행할 수 없음 (모든 트랙 blocked).
- 검증이 3 iter 연속 실패.
- Track C 의 main merge 가 가까운데 user 승인 미수령.
- 파괴적 액션이 필요해 보임.
- AGENTS.md / .claude/rules/ 와 모순되는 결정이 필요한 상황.
