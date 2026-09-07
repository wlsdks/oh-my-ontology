import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../messages/en.json";
import { SelectionAsk } from "./SelectionAsk";

type OnAsk = Parameters<typeof SelectionAsk>[0]["onAsk"];

function Harness({ onAsk, disabled = false }: { onAsk: OnAsk; disabled?: boolean }) {
  const t = useTranslations("library");
  const ref = useRef<HTMLDivElement | null>(null);
  return (
    // The same shape as LibraryPage: the chip lives inside the positioned body box.
    <div ref={ref} data-testid="body" className="relative">
      <p data-testid="passage">The budget becomes 221,400 after the change request.</p>
      <SelectionAsk containerRef={ref} onAsk={onAsk} disabled={disabled} t={t} />
    </div>
  );
}

function mount(onAsk: OnAsk, disabled = false) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <Harness onAsk={onAsk} disabled={disabled} />
    </NextIntlClientProvider>,
  );
}

async function selectPassage() {
  const node = screen.getByTestId("passage").firstChild as Text;
  const range = document.createRange();
  range.setStart(node, 4);
  range.setEnd(node, 30);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  await act(async () => {
    fireEvent.mouseUp(screen.getByTestId("body"));
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}

describe("select a passage, ask the agent about it", () => {
  it("shows nothing until a passage is selected, then one chip", async () => {
    mount(vi.fn());
    expect(screen.queryByTestId("library-selection-ask")).toBeNull();
    await selectPassage();
    expect(screen.getByTestId("library-selection-ask-chip")).toBeInTheDocument();
  });

  it("hangs the chip from the selection, measured from the body box itself", async () => {
    mount(vi.fn());
    const body = screen.getByTestId("body");
    vi.spyOn(body, "getBoundingClientRect").mockReturnValue({
      top: 400, left: 300, bottom: 1400, right: 1300, width: 1000, height: 1000, x: 300, y: 400, toJSON: () => ({}),
    });
    const rangeRect = { top: 580, left: 340, bottom: 604, right: 900, width: 560, height: 24, x: 340, y: 580, toJSON: () => ({}) };
    // jsdom ranges carry no layout; give this one the rectangle a browser would report.
    (Range.prototype as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () => rangeRect;
    try {
      await selectPassage();
    } finally {
      delete (Range.prototype as unknown as { getBoundingClientRect?: () => DOMRect }).getBoundingClientRect;
    }
    const box = screen.getByTestId("library-selection-ask");
    // 604 - 400 + 6: just under the selected line, not a pane height below it.
    expect(box.style.top).toBe("210px");
    expect(box.style.left).toBe("40px");
  });

  it("opens a named list beside the text and sends the chosen question with the exact passage", async () => {
    const onAsk = vi.fn();
    mount(onAsk);
    await selectPassage();
    fireEvent.click(screen.getByTestId("library-selection-ask-chip"));
    expect(screen.getByRole("complementary", { name: "Ask the agent about the selected passage" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("library-ask-disagreement"));
    expect(onAsk).toHaveBeenCalledWith("budget becomes 221,400 aft", "disagreement", undefined);
  });

  it("sends the person's own words on Enter, and closes on Escape", async () => {
    const onAsk = vi.fn();
    mount(onAsk);
    await selectPassage();
    fireEvent.click(screen.getByTestId("library-selection-ask-chip"));
    const input = screen.getByTestId("library-ask-custom");
    fireEvent.change(input, { target: { value: "Is this figure final?" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAsk).toHaveBeenCalledWith("budget becomes 221,400 aft", "custom", "Is this figure final?");
    await selectPassage();
    fireEvent.click(screen.getByTestId("library-selection-ask-chip"));
    fireEvent.keyDown(window, { key: "Escape" });
    // The surface keeps its exit window before it unmounts, so the assertion waits for it.
    await waitFor(() => expect(screen.queryByRole("complementary")).toBeNull(), { timeout: 1500 });
  });
});
