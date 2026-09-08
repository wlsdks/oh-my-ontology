'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/shared/lib/cn';

import { MASCOT_ASCII_COMPACT } from '../lib/mascot-ascii.generated';

/** One row per beat: the whole figure lands in about half a second, a finite entrance. */
const ROW_MS = 38;

/**
 * The mascot, typed in characters (2026-09-08, owner: *"our own icon or character should be
 * the ASCII one"*). The rows are generated from the committed pixel masters
 * (`scripts/build-mascot-ascii.mjs`), so this is the same character the chrome shows, in the
 * gateway's own medium. It is monochrome: the chartreuse signal pixels are `*`, never a colour
 * (`docs/BRAND.md`, palette boundary). The entrance is finite and state-free — rows arrive top
 * to bottom once `start` is true, and under reduced motion the figure is simply there.
 */
export function AsciiMascot({ start, className }: { start: boolean; className?: string }) {
  const rows = MASCOT_ASCII_COMPACT;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!start) return;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      const id = window.setTimeout(() => setShown(rows.length), 0);
      return () => window.clearTimeout(id);
    }
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= rows.length) window.clearInterval(id);
    }, ROW_MS);
    return () => window.clearInterval(id);
  }, [start, rows.length]);

  return (
    <pre
      aria-hidden="true"
      data-testid="gateway-mascot-ascii"
      data-rows-shown={shown}
      className={cn(
        'pointer-events-none select-none whitespace-pre font-mono text-body leading-body text-[color:var(--color-text-tertiary)]',
        className,
      )}
    >
      {rows.map((row, i) => `${i < shown ? row : ''}${i < rows.length - 1 ? '\n' : ''}`).join('')}
    </pre>
  );
}
