# Vault migrations

> vault frontmatter 가 schema 다. 키 추가 / 이름 변경 / 값 정리 등은 사용자
> vault 의 N 파일을 일괄 수정해야 한다. 이 디렉토리는 그 마이그레이션
> 패턴의 단일 진실원.

## 사용

```bash
# 사용 가능한 마이그레이션 목록
pnpm vault:migrate --list

# dry-run (default)
pnpm vault:migrate <id>
pnpm vault:migrate <id> --vault /path/to/my/vault

# 실제 적용 (파일 수정)
pnpm vault:migrate <id> --write

# 의식적 강행 (uncommitted .md 가드 우회 — 위험)
pnpm vault:migrate <id> --write --force
```

## 안전망 (R11 #21)

`--write` 모드에서 vault 가 git repo + uncommitted .md 변경이 하나라도
있으면 마이그레이터가 거부한다. 마이그레이션 결과와 사용자 변경이 섞여
rollback 이 어려워지는 상황 방지. 먼저 commit / stash 후 재시도 하거나,
의식적으로 강행하려면 `--force` 추가.

`<id>` 는 파일 이름의 stem (e.g. `2026-05-04-trim-frontmatter-values`).

vault 경로 미지정 시 dogfood vault (`docs/ontology/`) 사용.

## 마이그레이션 작성

각 마이그레이션은 `migrations/<YYYY-MM-DD>-<slug>.mjs`. shape:

```js
export const id = "2026-05-04-trim-frontmatter-values";
export const description = "한 줄 설명 — 무엇을 바꾸는가, 왜.";

/**
 * @param {{ path: string; raw: string; relativePath: string }} file
 * @returns {{ raw: string } | null}  null = no-op (skip)
 */
export function migrate(file) {
  // 입력 raw 를 변형해 새 raw 를 돌려준다.
  // null 또는 raw 가 동일하면 변경 없음으로 카운트.
  return { raw: transformedRaw };
}
```

## 원칙

1. **Line 기반 변형 우선** — frontmatter parse → reserialize 라운드트립은
   주석 / 공백 / 정렬 등을 잃을 위험. 텍스트 패턴 기반 substitute 가 안전.
2. **idempotent** — 같은 마이그레이션을 두 번 돌려도 한 번 돌린 결과와 동일.
3. **dry-run 이 default** — 사용자가 `--write` 를 *명시적으로* 줘야 디스크에
   기록. AGENTS.md 의 "Risky actions warrant confirmation" 정책과 일치.
4. **rollback 은 git** — 마이그레이션 자체가 inverse 를 제공하지 않는다.
   사용자는 git 또는 vault 백업으로 복구.
