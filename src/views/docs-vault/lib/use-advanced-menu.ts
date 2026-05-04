'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * R11 #16 step 2 — DocsVaultPage 의 advanced dropdown menu state machine 추출.
 * - open / setOpen state
 * - 외부 영역 ref (containment check 용)
 * - outside-click 시 close (pointerdown 이벤트, 자기 영역 안 클릭은 무시)
 * - Escape 키 close
 * - cleanup (effect close 시 listener 제거)
 *
 * 이전엔 view 안 25 LOC 의 useEffect + state + ref 가 cross-cutting 으로
 * 흩어져 있었음. 한 hook 으로 캡슐화해 view 가 \`useAdvancedMenu()\` 한 줄로
 * 사용. 다른 dropdown / popover 가 있는 view 에서 재사용 가능 시점에
 * shared/lib 로 승격 (현재는 사용처 1, over-engineering 회피).
 */
export function useAdvancedMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && ref.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return { open, setOpen, ref };
}
