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

export type VaultDiffToast = {
  message: string;
  variant: 'info' | 'success';
};

export function planVaultDiffToasts(
  diff: { added: string[]; modified: string[] },
  previewLimit = 3,
): VaultDiffToast[] {
  const limit = Math.max(0, previewLimit);
  const planned: VaultDiffToast[] = [];
  let shown = 0;

  for (const slug of diff.added) {
    if (shown >= limit) break;
    planned.push({ message: `Added: ${slug}`, variant: 'info' });
    shown += 1;
  }

  for (const slug of diff.modified) {
    if (shown >= limit) break;
    planned.push({ message: `Edited: ${slug}`, variant: 'success' });
    shown += 1;
  }

  const overflow = Math.max(0, diff.added.length + diff.modified.length - limit);
  if (overflow > 0) {
    planned.push({ message: `+${overflow} more node(s)`, variant: 'info' });
  }

  return planned;
}
