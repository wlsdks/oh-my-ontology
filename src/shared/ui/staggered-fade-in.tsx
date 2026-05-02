'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';

interface StaggeredFadeInProps {
  /** 자식들. `as` 가 list-style 이면 li 들의 배열. */
  children: React.ReactNode;
  /** 한 자식 사이의 stagger 간격 (ms). default 60ms — 디자인 시스템 권장. */
  stagger?: number;
  /** 트랜지션 길이 (ms). default 200ms. */
  duration?: number;
  /** 컨테이너 element 종류 — 의미 있는 wrapper 면 div 가 아닐 수도. */
  as?: 'div' | 'ul' | 'ol' | 'section';
  /** 추가 className — 컨테이너에 적용. */
  className?: string;
  /** Y 이동량 (px). default 8 — Toss/Apple 톤 살짝. */
  translateY?: number;
}

/**
 * Stagger fade-in — `opacity 0 → 1` + `translateY {y}px → 0` 을 자식들에
 * 순차 적용. 디자인 시스템이 약속한 motion 패턴을 단일 컴포넌트로 통일
 * (eval Aesthetic agent 의 P1 finding — landing 의 3 카드, insights 의
 * 4 panels 등에 stagger 가 약속됐는데 미구현이었음).
 *
 * 동작:
 * - mount 후 1 tick 뒤에 `opacity` + `transform` 활성화 (initial paint
 *   에서 hidden 상태가 보이지 않게 setTimeout 0).
 * - 각 자식에 `transition-delay = i * stagger` 적용.
 * - `prefers-reduced-motion` 사용자는 즉시 표시 (transition 0).
 *
 * 사용:
 * ```tsx
 * <StaggeredFadeIn as="ol" className="grid gap-3 md:grid-cols-3">
 *   <li>...</li>
 *   <li>...</li>
 *   <li>...</li>
 * </StaggeredFadeIn>
 * ```
 */
export function StaggeredFadeIn({
  children,
  stagger = 60,
  duration = 200,
  as: Tag = 'div',
  className,
  translateY = 8,
}: StaggeredFadeInProps) {
  const [mounted, setMounted] = useState(false);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    reducedMotionRef.current =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    // 0ms timeout — first paint 에 hidden 상태가 박혀야 transition 이 의미
    // 있게 동작. requestAnimationFrame 으로 guarantee.
    const handle = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(handle);
  }, []);

  const items = Array.isArray(children) ? children : [children];
  const reduced = reducedMotionRef.current;

  return (
    <Tag className={className}>
      {items.map((child, i) => (
        <span
          // eslint-disable-next-line react/no-array-index-key -- stable order, no reorder semantics
          key={i}
          // motion-safe: prefers-reduced-motion 사용자는 transition 0,
          // initial 상태도 즉시 visible.
          style={{
            display: 'contents',
            // 자식 `<li>` 등이 own block 이라 inline-block 으로 wrapping
            // 안 함 — 대신 child 자체에 inline style 주입을 위해 React.cloneElement
            // 처럼 동작하려면 cloneElement 사용. 여기선 자식이 inline style
            // 받게 children 을 cloneElement 로 감싼다.
          }}
        >
          {applyTransitionStyle(child, {
            mounted: reduced || mounted,
            duration: reduced ? 0 : duration,
            delay: reduced ? 0 : i * stagger,
            translateY,
          })}
        </span>
      ))}
    </Tag>
  );
}

interface ApplyOptions {
  mounted: boolean;
  duration: number;
  delay: number;
  translateY: number;
}

function applyTransitionStyle(
  child: React.ReactNode,
  { mounted, duration, delay, translateY }: ApplyOptions,
): React.ReactNode {
  if (!isReactElement(child)) return child;
  const existing = child.props.style ?? {};
  const inlineTransition: React.CSSProperties = {
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : `translateY(${translateY}px)`,
    transition: `opacity ${duration}ms ease-out ${delay}ms, transform ${duration}ms ease-out ${delay}ms`,
    willChange: mounted ? undefined : 'opacity, transform',
  };
  return cloneWithStyle(child, { ...existing, ...inlineTransition });
}

function isReactElement(node: React.ReactNode): node is React.ReactElement<{ style?: React.CSSProperties; className?: string }> {
  return (
    node !== null &&
    typeof node === 'object' &&
    'props' in (node as object)
  );
}

function cloneWithStyle(
  el: React.ReactElement<{ style?: React.CSSProperties; className?: string }>,
  style: React.CSSProperties,
) {
  return {
    ...el,
    props: {
      ...el.props,
      style,
      // motion-reduce: 클래스 보존 (prefers-reduced-motion CSS rules 와 호환).
      className: cn(el.props.className, 'motion-reduce:!transform-none motion-reduce:!opacity-100 motion-reduce:!transition-none'),
    },
  };
}
