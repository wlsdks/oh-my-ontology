'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/shared/lib/cn';

import type { AtlasHandle } from '../lib/hero-atlas-scene';
import { echoFact } from '../lib/hero-echo';
import type { StageGraph } from '../lib/stage-graph';
import { HERO_SPLIT_MIN_WIDTH_REM, HeroObject } from './HeroObject';

const HERO_SPLIT_MEDIA = `(min-width: ${HERO_SPLIT_MIN_WIDTH_REM}rem)`;
const subscribeSplit = (onChange: () => void): (() => void) => {
  if (typeof matchMedia !== 'function') return () => {};
  const mq = matchMedia(HERO_SPLIT_MEDIA);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};
const readSplit = (): boolean => typeof matchMedia === 'function' && matchMedia(HERO_SPLIT_MEDIA).matches;

const HERO_PHONE_MEDIA = '(max-width: 40rem)';
const subscribePhone = (onChange: () => void): (() => void) => {
  if (typeof matchMedia !== 'function') return () => {};
  const mq = matchMedia(HERO_PHONE_MEDIA);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};
const readPhone = (): boolean => typeof matchMedia === 'function' && matchMedia(HERO_PHONE_MEDIA).matches;

/** True once a WebGL context can be made here; false hands the stage to the 2D engine. */
function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * The hero atlas — the real vault as a lit three.js object (`hero-atlas-scene.ts`), on the same
 * stage, with the same typing echo, hover caption and inspection window the 2D hero had. The
 * three.js chunk is loaded on demand so the gateway's first paint pays nothing for it; while it
 * loads, and wherever WebGL is unavailable, the 2D engine (`HeroObject`) draws the same graph,
 * so the stage is never empty and never lies.
 */
export function HeroAtlas({ graph, typed, total }: { graph: StageGraph; typed: number; total: number }) {
  const t = useTranslations('download');
  const tKinds = useTranslations('kinds');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<AtlasHandle | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [mode, setMode] = useState<'pending' | 'three' | 'fallback'>('pending');
  const typingRef = useRef({ typed, total });
  useEffect(() => {
    typingRef.current = { typed, total };
  });
  const wide = useSyncExternalStore(subscribeSplit, readSplit, () => false);
  const phone = useSyncExternalStore(subscribePhone, readPhone, () => false);

  useEffect(() => {
    let cancelled = false;
    // Decided off the effect body (a probe plus a chunk load), so the mode lands in a callback:
    // no WebGL, or a chunk that fails to load, hands the stage to the 2D engine.
    Promise.resolve()
      .then(() => (webglAvailable() ? import('../lib/hero-atlas-scene') : Promise.reject(new Error('no webgl'))))
      .then(
        () => {
          if (!cancelled) setMode('three');
        },
        () => {
          if (!cancelled) setMode('fallback');
        },
      );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== 'three') return;
    const canvas = canvasRef.current;
    if (!canvas || graph.nodes.length === 0) return;
    let disposed = false;
    let handle: AtlasHandle | null = null;
    const keep = (kind: StageGraph['nodes'][number]['kind']): boolean => !phone || kind !== 'element';
    const kept = new Set(graph.nodes.filter((node) => keep(node.kind)).map((node) => node.id));
    void import('../lib/hero-atlas-scene').then(({ mountHeroAtlas }) => {
      if (disposed) return;
      handle = mountHeroAtlas(
        canvas,
        {
          nodes: graph.nodes.filter((n) => kept.has(n.id)).map((n) => ({ s: n.id, k: n.kind, l: n.label })),
          edges: graph.edges
            .filter((e) => e.kind === 'contains' || e.kind === 'depends')
            .filter((e) => kept.has(e.source) && kept.has(e.target))
            .map((e) => ({ a: e.source, b: e.target, y: e.kind as 'contains' | 'depends' })),
        },
        {
          onHover: setHover,
          anchor: wide ? { x: 0.72, y: 0.56 } : { x: 0.5, y: 0.5 },
          dim: wide ? 0.85 : 1,
          distance: wide ? 5.6 : phone ? 5.8 : 5.2,
        },
      );
      if (!handle) {
        setMode('fallback');
        return;
      }
      handleRef.current = handle;
      if (typingRef.current.total > 0) handle.setTyping(typingRef.current.typed, typingRef.current.total);
      const inspect = new URLSearchParams(window.location.search).get('e2e') === '1';
      if (inspect) {
        (window as unknown as { __heroEcho?: unknown }).__heroEcho = {
          lit: () => handle!.litCount(),
          nodes: () => handle!.nodesOnScreen(),
          count: graph.nodes.length,
        };
      }
    });
    return () => {
      disposed = true;
      handleRef.current = null;
      if (new URLSearchParams(window.location.search).get('e2e') === '1') {
        delete (window as unknown as { __heroEcho?: unknown }).__heroEcho;
      }
      handle?.dispose();
    };
  }, [graph, wide, phone, mode]);

  useEffect(() => {
    if (total > 0) handleRef.current?.setTyping(typed, total);
  }, [typed, total]);

  if (mode === 'fallback') return <HeroObject graph={graph} typed={typed} total={total} />;

  const fact = hover !== null ? echoFact(graph, hover) : null;
  const hovered = hover !== null ? graph.nodes.find((n) => n.id === hover) : undefined;
  const factLine = fact
    ? fact.relation === 'contains'
      ? t('heroFactContains', { parent: fact.from, child: fact.to })
      : t('heroFactDepends', { from: fact.from, to: fact.to })
    : '';
  const caption = factLine && hovered ? `${tKinds(hovered.kind)} · ${factLine}` : factLine;

  return (
    <div aria-hidden="true" data-testid="gateway-hero-object" className="gateway-hero-stage absolute inset-0 min-w-0 overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-pan-y" />
      <p
        data-testid="gateway-hero-caption"
        className={cn(
          'gateway-hero-caption pointer-events-none absolute right-[var(--gateway-origin)] top-12 max-w-[40%] truncate text-right font-mono text-label leading-label text-[color:var(--color-text-tertiary)] md:top-16 min-[90rem]:top-auto min-[90rem]:bottom-[7.5rem]',
          caption ? 'is-on' : undefined,
        )}
      >
        {caption || ' '}
      </p>
    </div>
  );
}
