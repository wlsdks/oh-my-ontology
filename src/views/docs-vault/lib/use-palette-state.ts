'use client';

import { Dispatch, SetStateAction, useCallback, useState } from 'react';

/**
 * R12 #26 — DocsVaultPage 의 ⌘K palette state 추출.
 *
 * 캡슐화: paletteQuery state (string | null) + paletteOpen (derived) +
 * togglePalette (with optional seed) + closePalette.
 *
 * 사용:
 *   const { paletteQuery, setPaletteQuery, paletteOpen, togglePalette, closePalette } = usePaletteState();
 *
 * useTypingShortcuts callsite 에서 \`onFire: () => togglePalette()\` 또는
 * \`onFire: () => togglePalette('> ')\` 처럼 사용. setPaletteQuery 도 외부
 * 노출 — DocsVaultUnifiedPalette 의 onClose / 헤더 click 등 직접 setter
 * 호출 사이트 보존.
 *
 * setter 들은 useCallback wrap (useAdvancedMenu 와 동일 패턴) — destructured
 * method 의 ESLint stability 추적 위해.
 */
export function usePaletteState() {
  const [paletteQuery, setPaletteQueryInternal] = useState<string | null>(null);
  const paletteOpen = paletteQuery !== null;

  const setPaletteQuery = useCallback<Dispatch<SetStateAction<string | null>>>(
    (next) => setPaletteQueryInternal(next),
    [],
  );

  const togglePalette = useCallback((seed: string = '') => {
    setPaletteQueryInternal((q) => (q === null ? seed : null));
  }, []);

  const closePalette = useCallback(() => {
    setPaletteQueryInternal(null);
  }, []);

  return {
    paletteQuery,
    setPaletteQuery,
    paletteOpen,
    togglePalette,
    closePalette,
  };
}
