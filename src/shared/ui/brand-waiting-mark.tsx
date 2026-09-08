'use client';

import { useEffect, useRef } from 'react';
import { withBasePath } from '@/shared/lib/base-path';
import { usePrefersReducedMotion } from '@/shared/lib/use-prefers-reduced-motion';

/**
 * The character accompanies an actual pending operation. Its parent owns the
 * status words and cancellation; this decorative mark never claims READ or
 * SUCCESS. Only the first four native 64px walking poses participate in WAIT.
 */
export function BrandWaitingMark({
  active,
  initialVisibility = 'observed',
}: {
  active: boolean;
  /** Only full-screen pending fallbacks can know they are visible before hydration. */
  initialVisibility?: 'observed' | 'visible';
}) {
  return active ? <ActiveWaitingMark initialVisibility={initialVisibility} /> : null;
}

function ActiveWaitingMark({ initialVisibility }: { initialVisibility: 'observed' | 'visible' }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const mark = ref.current;
    if (!mark || reducedMotion) return;
    // Without a visibility observer, keep the same static character rather than
    // running a dance we cannot stop when its surface leaves the viewport.
    if (typeof IntersectionObserver === 'undefined') {
      mark.dataset.waitingMotion = 'still';
      return;
    }

    let intersecting = initialVisibility === 'visible';
    const update = () => {
      mark.dataset.waitingMotion = !document.hidden && intersecting ? 'running' : 'paused';
    };
    update();
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry?.isIntersecting === true;
      update();
    });
    observer.observe(mark);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, [initialVisibility, reducedMotion]);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-testid="brand-waiting-mark"
      data-waiting-motion={reducedMotion ? 'still' : initialVisibility === 'visible' ? 'running' : 'paused'}
      className="atlas-waiting-mark pointer-events-none inline-block size-16 shrink-0"
      style={{ backgroundImage: `url(${withBasePath('/brand/mascot-walk-row.png')})` }}
    />
  );
}
