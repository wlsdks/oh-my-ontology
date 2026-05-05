/**
 * R14 #157 + #158 — vault polling 결과를 *added* / *modified* 두 부류로
 * 분류하는 pure helper. VaultDiffToaster 가 React 외 dependency 없이 호출.
 *
 * 입력: 이전 / 현재 manifest 의 (slug, mtime|null) Map.
 * 출력: 새로 등장한 slug + mtime 변화 slug.
 *
 * 정책:
 *   - prev 에 없는 slug → added.
 *   - 같은 slug 가 양쪽 다 mtime != null 이고 current > prev → modified.
 *   - 한쪽이라도 mtime == null (static manifest) → 비교 의미 없음. modified
 *     판정 skip (false-positive 차단).
 *   - removed 는 의도적으로 제외 — 사용자 명시 액션 (`delete_concept` 등)
 *     이 자체 toast 띄움. polling 결과로 다시 띄우면 noise.
 */
export function diffVaultManifest(
  prev: Map<string, number | null>,
  current: Map<string, number | null>,
): { added: string[]; modified: string[] } {
  const added: string[] = [];
  const modified: string[] = [];
  for (const [slug, mtime] of current) {
    const prevMtime = prev.get(slug);
    if (prevMtime === undefined) {
      added.push(slug);
      continue;
    }
    if (prevMtime !== null && mtime !== null && mtime > prevMtime) {
      modified.push(slug);
    }
  }
  return { added, modified };
}
