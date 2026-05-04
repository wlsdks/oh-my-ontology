'use client';

import { useEffect, useRef } from 'react';
import { useToast } from '@/shared/ui/toast';
import { useLocalVault } from './LocalVaultProvider';

/**
 * R13 #71 + #72 — vault polling 결과 *시각적 알림*. polling 으로 detect 한
 * 변화를 어떤 페이지에서든 toast 로 알림.
 *
 * #71 added detection: 새로운 slug 등장 → "Added: <slug>" info toast.
 * #72 modified detection: slug 같지만 mtime 변화 → "Edited: <slug>"
 *   success toast. 사용자 / AI agent 가 IDE 에서 .md 편집한 경우.
 *
 * 동작:
 *   - LocalVaultProvider 안에 mount, manifest.docs 의 (slug, mtime) Map 추적
 *   - 첫 mount 는 baseline 만 (false-positive 방지)
 *   - 이후 diff:
 *     · slug 신규 → added
 *     · slug 동일 + mtime 새로움 → modified
 *   - added/modified 합쳐 처음 3 명시 + "+N more"
 *
 * 삭제 detection 은 일단 제외 — 사용자 명시 액션 후 toast 가 더 가치 있음
 * (delete_concept 같은 명령 자체가 toast 띄우면 됨, polling 결과로 다시
 * toast 띄우면 noise).
 */
export function VaultDiffToaster() {
  const { status, manifest } = useLocalVault();
  const toast = useToast();
  const prevMapRef = useRef<Map<string, number | null> | null>(null);

  useEffect(() => {
    if (status !== 'loaded' || !manifest) return;

    type DocLite = { slug: string; mtime?: number };
    const currentMap = new Map<string, number | null>(
      manifest.docs.map((d: DocLite) => [d.slug, d.mtime ?? null]),
    );

    // 첫 load — baseline 저장만 하고 끝
    if (prevMapRef.current === null) {
      prevMapRef.current = currentMap;
      return;
    }

    const prev = prevMapRef.current;
    const added: string[] = [];
    const modified: string[] = [];
    for (const [slug, mtime] of currentMap) {
      const prevMtime = prev.get(slug);
      if (prevMtime === undefined) {
        added.push(slug);
        continue;
      }
      // mtime 비교: 둘 중 하나가 null (static manifest) 이면 비교 의미 없으니 skip
      if (prevMtime !== null && mtime !== null && mtime > prevMtime) {
        modified.push(slug);
      }
    }
    prevMapRef.current = currentMap;

    if (added.length === 0 && modified.length === 0) return;

    const PREVIEW = 3;
    const overflow = Math.max(0, added.length + modified.length - PREVIEW);

    let shown = 0;
    for (const slug of added) {
      if (shown >= PREVIEW) break;
      toast.show(`Added: ${slug}`, 'info');
      shown += 1;
    }
    for (const slug of modified) {
      if (shown >= PREVIEW) break;
      toast.show(`Edited: ${slug}`, 'success');
      shown += 1;
    }
    if (overflow > 0) {
      toast.show(`+${overflow} more node(s)`, 'info');
    }
  }, [status, manifest, toast]);

  return null;
}
