import { BrandWaitingMark } from './brand-waiting-mark';

export interface MapEntryLoadingVisualProps {
  title: string;
  description: string;
  /** Product description for static HTML and crawlers. On screen, the loader is the protagonist. */
  headline?: string;
  lede?: string;
}

/** Map cold boot keeps one centered status and a native waiting character. */
export function MapEntryLoadingVisual({
  title,
  description,
  headline,
  lede,
}: MapEntryLoadingVisualProps) {
  return (
    <main
      id="main"
      tabIndex={-1}
      data-route-loading="true"
      data-testid="map-entry-fallback"
      aria-busy="true"
      className="flex h-full min-h-full flex-1 items-center justify-center bg-[color:var(--color-canvas)] px-6 py-10"
    >
      {headline || lede ? (
        <div className="sr-only">
          {headline ? <h1>{headline}</h1> : null}
          {lede ? <p>{lede}</p> : null}
        </div>
      ) : null}
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        data-map-loading-layout="centered"
        className="flex max-w-md flex-col items-center text-center"
      >
        <div className="relative grid size-16 place-items-center" aria-hidden="true">
          <BrandWaitingMark active initialVisibility="visible" />
        </div>
        <p className="mt-5 text-title font-[var(--font-weight-signature)] text-[color:var(--color-text-primary)]">
          {title}
        </p>
        <p className="mt-2 break-keep text-body leading-body text-[color:var(--color-text-tertiary)]">
          {description}
        </p>
      </div>
    </main>
  );
}
