import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import koMessages from "../../../../messages/ko.json";
import { BackToTopButton } from "./BackToTopButton";

function renderButton(visible: boolean, onClick = vi.fn()) {
  return {
    onClick,
    ...render(
      <NextIntlClientProvider locale="ko" messages={koMessages}>
        <BackToTopButton visible={visible} onClick={onClick} />
      </NextIntlClientProvider>,
    ),
  };
}

describe("BackToTopButton", () => {
  it("renders the plain-language label and calls onClick", () => {
    const { onClick } = renderButton(true);

    const button = screen.getByRole("button", { name: "문서 맨 위로 이동" });
    expect(button).toHaveTextContent("맨 위로");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("fades out and becomes non-interactive when not visible", () => {
    renderButton(false);
    const button = screen.getByTestId("back-to-top-button");
    expect(button.className).toContain("opacity-0");
    expect(button.className).toContain("pointer-events-none");
    expect(button).toHaveAttribute("tabIndex", "-1");
  });

  /**
   * The inset is the number the pane's own reserve is derived from
   * (`--doc-reading-back-to-top-clearance`), and it is also what lifts this control above
   * the fixed bottom tab bar below `lg`. A literal `bottom-6` here would silently break
   * both: measured 2026-09-08, it put the last line of a wiki page 8px behind this pill at
   * 1400/1200/1040, and put this pill behind a tab-bar link at 768 and 390.
   */
  it("takes its bottom inset from the token the pane reserves against", () => {
    renderButton(true);
    const button = screen.getByTestId("back-to-top-button");
    expect(button.className).toContain("bottom-[var(--doc-reading-back-to-top-inset)]");
    expect(button.className).not.toContain("bottom-6");
  });

  it("is fully opaque and focusable when visible", () => {
    renderButton(true);
    const button = screen.getByTestId("back-to-top-button");
    expect(button.className).toContain("opacity-100");
    expect(button).toHaveAttribute("tabIndex", "0");
  });
});
