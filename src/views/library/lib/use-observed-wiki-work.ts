"use client";

import { useEffect, useRef } from "react";

import { observedWikiWriteEvents, type LibraryWorkEvent } from "@/features/library";

/** A session's first manifest is a baseline, never evidence that this session wrote it. */
export function useObservedWikiWork(
  vaultScope: string,
  revisions: ReadonlyMap<string, number>,
  onReset: () => void,
  onReceipts: (events: readonly LibraryWorkEvent[]) => void,
): void {
  const previousRef = useRef<{ scope: string; revisions: ReadonlyMap<string, number> } | null>(null);
  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = { scope: vaultScope, revisions };
    if (!previous || previous.scope !== vaultScope) {
      onReset();
      return;
    }
    const receipts = observedWikiWriteEvents(previous.revisions, revisions, Date.now());
    if (receipts.length > 0) onReceipts(receipts);
  }, [vaultScope, revisions, onReset, onReceipts]);
}
