# Vercel 배포 가이드

oh-my-ontology 의 hosted demo 는 Vercel 정적 호스팅이 디폴트다 — Next.js
`output: 'export'` 라 서버 런타임이 없어 무료 hobby plan 으로 충분.

## 1회 셋업 (사용자 직접)

1. https://vercel.com/new 에서 GitHub repo (`wlsdks/oh-my-ontology`) 연결
2. **Framework Preset**: `Other` (정적 export 라 Next.js 프리셋 안 씀 — `vercel.json` 의 `framework: null` 이 그대로 반영됨)
3. **Build Command**: 자동으로 `vercel.json` 의 `buildCommand` 사용 (pnpm install + pnpm build)
4. **Output Directory**: `out` (자동)
5. **Environment Variables**: 비워둠 — 정적 모드는 Firebase env 없어도 동작 (`docs/ontology/` dogfood 데이터 노출)
6. **Deploy** 클릭

## 도메인

기본 url: `oh-my-ontology.vercel.app` (또는 `oh-my-ontology-<hash>.vercel.app`).

custom domain 원하면:
- Vercel 프로젝트 → Settings → Domains
- `oh-my-ontology.dev` 또는 사용자 보유 도메인 연결

## CI 검증

push 마다 Vercel 자동 배포. PR 마다 preview URL 도 생성.
preview URL 에서 다음 surface smoke 확인:
- `/` LandingPage 카피
- `/topology` Sigma 1 노드 (oh-my-ontology dogfood project)
- `/ontology/insights` 약 130 노드 / 165 관계 표시

## 배포 후 README 갱신

1. README 의 *Hosted demo* 링크를 실제 url 로 수정
2. CLI (`cli/src/index.mjs`) 의 안내 문구 동일 url 사용

## 비용

Vercel hobby plan = $0. 정적 export 는 edge cdn 서빙만 — 트래픽이 천 단위 사용자/일 까지 무료. 그 이상은 pro plan ($20/m).

## 회귀 차단

`pnpm bundle:check` 가 vercel build 후에도 통과해야 firebase chunk 가 user-facing 라우트에 다시 들어가지 않는다. CI 에 추가하는 게 좋다 (현재는 로컬 호출만 등록됨 — 별도 PR 에서 GitHub Actions 추가).
