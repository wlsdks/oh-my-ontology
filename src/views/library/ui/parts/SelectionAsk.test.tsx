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
    <div className="relative">
      <div ref={ref} data-testid="body">
        <p data-testid="passage">The budget becomes 221,400 after the change request.</p>
      </div>
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
