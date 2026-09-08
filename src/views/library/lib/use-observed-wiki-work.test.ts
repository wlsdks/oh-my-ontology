import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useObservedWikiWork } from "./use-observed-wiki-work";

describe("session-scoped wiki observations", () => {
  it("silently baselines first open and a different folder with the same page slug", () => {
    const onReset = vi.fn();
    const onReceipts = vi.fn();
    const { rerender } = renderHook(
      ({ scope, revisions }) => useObservedWikiWork(scope, revisions, onReset, onReceipts),
      { initialProps: { scope: "local:ontology#1", revisions: new Map([["wiki/plan", 10]]) } },
    );
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onReceipts).not.toHaveBeenCalled();
    rerender({ scope: "local:ontology#1", revisions: new Map([["wiki/plan", 11]]) });
    expect(onReceipts).toHaveBeenCalledTimes(1);
    expect(onReceipts.mock.calls[0][0][0]).toMatchObject({ kind: "write", target: { ref: "wiki/plan" } });
    rerender({ scope: "local:ontology#2", revisions: new Map([["wiki/plan", 99]]) });
    expect(onReset).toHaveBeenCalledTimes(2);
    expect(onReceipts).toHaveBeenCalledTimes(1);
    rerender({ scope: "local:ontology#2", revisions: new Map([["wiki/plan", 100]]) });
    expect(onReceipts).toHaveBeenCalledTimes(2);
  });
});
