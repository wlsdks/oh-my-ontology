# CLAUDE.md — oh-my-ontology 작업 가이드

> Claude · Codex · 기타 AI 에이전트가 이 코드베이스에서 작업할 때 읽어야 하는 공통 지침. 작업 시작 전 한번 훑어볼 것.

## 1. 무엇인가

`oh-my-ontology` 는 markdown 문서에서 지식 그래프를 자동으로 키우는 오픈소스 온톨로지 워크벤치다. 자세한 소개·설계 의도는 [`README.md`](README.md).

핵심 흐름 4단계:

```
사용자가 글을 적는다 (md)
  ↓
글에서 개념(node) + 관계(edge) + 근거(provenance) 추출
  ↓
사람이 검수해 승인
  ↓
승인된 그래프가 토폴로지 / 트리 / ERD view 로 노출 + 외부 발행
```

> "토폴로지는 출구 중 하나, 진짜 척추는 md 문서 → 온톨로지." — 본 프로젝트의 1원칙.

## 2. 단일 진실원

문서와 코드가 충돌하면 코드가 1차다. 프레임워크 / 빌드 / 라우팅 사실 관계는 다음 3 개로 확인:

- [`package.json`](package.json)
- [`next.config.ts`](next.config.ts)
- [`app/layout.tsx`](app/layout.tsx)

## 3. 기술 기준

- **Framework**: Next.js 16 · App Router · `output: 'export'`
- **Language**: TypeScript 5
- **Style**: Tailwind CSS 4 (`@theme`)
- **Visualization**: Sigma.js (WebGL) · Graphology · ForceAtlas2 · d3-force · xyflow · Framer Motion
- **Backend**: Firebase (Firestore · Storage · Auth · Hosting · Functions 2nd gen)
- **State**: Firestore `onSnapshot` + React local state · URL state
- **Architecture**: Feature-Sliced Design (ESLint boundaries 로 import 방향 강제)
- **Test**: Vitest + Testing Library + jsdom · Playwright (E2E)
- **Lint**: ESLint 9 flat config
- **Package**: pnpm

## 4. 라우트 지도

```
/                          토폴로지 view (전체 그래프)
/projects                  프로젝트 목록 (권한 시 인라인 새 프로젝트)
/project/[slug]            프로젝트 상세 (권한 시 인라인 편집)
/knowledge · /knowledge/*  문서 등록 / 분석 / 목록
/review/knowledge          검수 큐
/ontology                  승인된 트리 view
/ontology/edit             ERD 캔버스 편집기
/ontology/insights         그래프 인사이트
/ontology/relations        관계 분포
/settings/*                카테고리 / 상태 / API 키 / 임포트
/diagnostics/*             운영 인사이트
/account · /login · /signup · /reset-password   인증 surface
```

## 5. 폴더 구조

```
app/                       Next.js 라우팅 (얇은 래퍼)
src/                       FSD 레이어
  ├── app/                 providers · 초기화
  ├── views/               페이지 컴포넌트
  ├── widgets/             복합 UI
  ├── features/            인터랙션 단위
  ├── entities/            비즈니스 엔티티
  └── shared/              UI · lib · config · api 재사용 기반
docs/                      ARCHITECTURE / DATA-MODEL / DESIGN-SYSTEM / DEPLOYMENT / rules
functions/                 Cloud Functions (2nd gen)
tests/                     Vitest 단위 + Playwright E2E
scripts/                   시드 / 배포 / 검증 보조
```

**Import 방향**: `app → views → widgets → features → entities → shared`

## 6. 작업 원칙

1. **이미 Next.js 정적 export** — "Next.js 로 옮긴다" 같은 마이그레이션 시도하지 말 것. 서버 런타임 전제 깔지 않음.
2. **App Router 만 사용** — `pages/` 라우터 도입 금지. 라우트는 `app/` 아래에만.
3. **공개 / 운영 데이터 경계는 데이터 모델로** — URL 네임스페이스로 갈리지 않는다. 권한은 Firestore rules 가 1차 게이트.
4. **source of truth 는 하나** — 동일 개념을 두 컬렉션 / 두 화면에서 동시 진실원으로 두지 말 것.
5. **스키마 / 라우트 / 운영 모델 변경은 docs-first** — `docs/` 의 관련 문서를 같이 갱신.
6. **TDD 우선** — `shared/lib`, `entities/*/model` 순수 로직부터 테스트.
7. **작업 단위마다 커밋** — 한 번에 너무 큰 PR 만들지 말 것.
8. **커밋 메시지** — 영문 conventional prefix + 한국어 본문 (예: `feat: 검색 팔레트 모바일 시트로 분리`). 기여자가 영어권이면 본문도 영어로 OK.

## 7. 디자인 헌장

- **Linear 베이스, 무채색 + 단일 인디고 (`#5e6ad2`)** 라는 극단적 제약으로 AI 클리셰 차단.
- **금지**: 보라→핑크 그라디언트 · glassmorphism · glow pulse · 움직이는 그라디언트 배경 · scale 호버 · 둘 이상의 채색 시스템.
- **신호 톤만 예외**: 경고 amber `rgba(255,179,71,*)`, 에러 red `rgba(229,72,77,*)`. 인디고 정책과 별개로 UI 신호에만.
- 자세한 토큰 / 모션 / 모범 / 금지 규칙: [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md).

## 8. 자주 쓰는 명령

```bash
pnpm dev                              # 개발 서버
pnpm build                            # 정적 export 빌드 → out/
pnpm test                             # vitest watch
pnpm test:run                         # vitest 1회
pnpm lint
pnpm exec tsc --noEmit
pnpm dev:firestore-emulator           # 별도 터미널
pnpm seed:emulator
```

## 9. AGENTS / CLAUDE 동기화

`AGENTS.md` 와 `CLAUDE.md` 는 같은 작업 기준을 공유한다. 한쪽을 바꾸면 다른 쪽도 같은 내용으로 맞출 것.
