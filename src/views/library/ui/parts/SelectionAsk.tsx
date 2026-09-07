"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { MessageCircleQuestion } from "lucide-react";

import type { AskQuestionId } from "@/features/library";
import { Chip, Surface } from "@/shared/ui";
import { ICON_SIZE } from "@/shared/ui/icon-size";
import { Input } from "@/shared/ui/input";
import { transientSurface } from "@/shared/ui/transient-surface";
import type { useTranslations } from "next-intl";

type Translator = ReturnType<typeof useTranslations<"library">>;

/**
 * Select a passage in a wiki page, ask the agent about it.
 *
 * Owner direction 2026-09-07: dragging over text should offer a question at once, with the
 * question chosen rather than typed from scratch. One chip appears under the selection;
 * pressing it opens a short list beside the text — where this comes from, what disagrees,
 * explain it — and a line for the person's own words. Nothing is sent until one of them is
 * pressed, and the passage is quoted into the conversation so the answer is about exactly
 * those words.
 *
 * The list is `transientSurface('anchored')` on the shared `Surface`, the same shape as the
 * Library's shelf popover: beside what opened it, closes on Escape or an outside press, no
 * scrim. The chip and the list are placed inside `containerRef`'s positioned ancestor from
 * the selection's own rectangle, so they follow the text at every width.
 */
export function SelectionAsk({
  containerRef,
  onAsk,
  disabled,
  t,
}: {
  containerRef: RefObject<HTMLElement | null>;
  onAsk: (selection: string, question: AskQuestionId, customQuestion?: string) => void;
  disabled: boolean;
  t: Translator;
}) {
  const [selection, setSelection] = useState<{ text: string; top: number; left: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const listRef = useRef<HTMLElement | null>(null);

  const readSelection = useCallback(() => {
    const container = containerRef.current;
    const live = typeof window !== "undefined" ? window.getSelection() : null;
    if (!container || !live || live.rangeCount === 0 || live.isCollapsed) {
      if (!open) setSelection(null);
      return;
    }
    const range = live.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      if (!open) setSelection(null);
      return;
    }
    const text = live.toString().trim();
    if (text.length < 8) {
      if (!open) setSelection(null);
      return;
    }
    // The chip is absolutely positioned inside `container`, which is the positioned box, so
    // its offsets are measured from that box's own rectangle. Measuring from the scroll
    // pane's positioned ancestor instead placed the chip a whole pane height too low in the
    // installed app (2026-09-07): present in the accessibility tree, never on screen.
    // A range without a rectangle (a DOM without layout) still gets the chip, at the top.
    const rect =
      typeof range.getBoundingClientRect === "function" ? range.getBoundingClientRect() : { bottom: 0, left: 0 };
    const hostRect = container.getBoundingClientRect();
    setSelection({
      text,
      top: rect.bottom - hostRect.top + 6,
      left: Math.max(8, Math.min(rect.left - hostRect.left, hostRect.width - 200)),
    });
  }, [containerRef, open]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onUp = () => window.setTimeout(readSelection, 0);
    container.addEventListener("mouseup", onUp);
    container.addEventListener("keyup", onUp);
    return () => {
      container.removeEventListener("mouseup", onUp);
      container.removeEventListener("keyup", onUp);
    };
  }, [containerRef, readSelection]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    const onDown = (event: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  if (!selection) return null;
  const ask = (question: AskQuestionId, customQuestion?: string) => {
    onAsk(selection.text, question, customQuestion);
    setOpen(false);
    setSelection(null);
    setCustom("");
    window.getSelection()?.removeAllRanges();
  };
  const questions: ReadonlyArray<Exclude<AskQuestionId, "custom">> = ["evidence", "disagreement", "explain"];

  return (
    <div data-testid="library-selection-ask" className="absolute z-30" style={{ top: selection.top, left: selection.left }}>
      <Surface
        open={open}
        as="aside"
        ref={listRef}
        motion="chrome"
        origin="top left"
        {...transientSurface("anchored")}
        aria-label={t("ask.title")}
        className="flex w-[min(320px,calc(100vw-2rem))] flex-col overflow-hidden rounded-panel border border-[color:var(--color-border-soft)] bg-[color:var(--color-elevated)] shadow-[var(--shadow-elevation-2)]"
      >
        <div className="flex flex-col gap-1.5 p-[var(--card-pad)]">
          <p className="text-caption text-[color:var(--color-text-quaternary)] [word-break:keep-all]">{t("ask.title")}</p>
          {questions.map((question) => (
            <Chip
              key={question}
              data-testid={`library-ask-${question}`}
              tone="muted"
              disabled={disabled}
              onClick={() => ask(question)}
              className="justify-start text-left"
            >
              {t(`ask.${question}`)}
            </Chip>
          ))}
          <div className="flex items-center gap-1">
            <Input
              data-testid="library-ask-custom"
              size="sm"
              aria-label={t("ask.placeholder")}
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && custom.trim()) ask("custom", custom);
              }}
              placeholder={t("ask.placeholder")}
              className="min-w-0 flex-1"
            />
            <Chip
              data-testid="library-ask-send"
              tone="muted"
              disabled={disabled || custom.trim() === ""}
              onClick={() => ask("custom", custom)}
            >
              {t("ask.send")}
            </Chip>
          </div>
        </div>
      </Surface>
      {!open ? (
        <Chip
          data-testid="library-selection-ask-chip"
          tone="muted"
          disabled={disabled}
          onClick={() => setOpen(true)}
          aria-label={t("ask.chip")}
        >
          <MessageCircleQuestion size={ICON_SIZE.sm} aria-hidden />
          <span>{t("ask.chip")}</span>
        </Chip>
      ) : null}
    </div>
  );
}
