import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import koMessages from "../../../../messages/ko.json";
import { DocReadingPane } from "./DocReadingPane";

/**
 * **The reserve the scroll end owes the floating back-to-top pill.**
 *
 * The pixel proof lives in `tests/e2e/scroll-end-gap.spec.ts`, which scrolls the Library's
 * reader to its end and measures the last ink against the pill's rect — jsdom performs no
 * layout and can measure neither. What this file holds is the part e2e cannot reach: the
 * check-results page needs findings from an agent turn, so no harness can open it full, and
 * it is one of the three documents this one pane draws. Asserting the prescription here means
 * the report is covered by the same line the wiki reader is measured on.
 */
function renderPane(withBackToTop: boolean) {
  return render(
    <NextIntlClientProvider locale="ko" messages={koMessages}>
      <DocReadingPane
        scrollRef={createRef<HTMLDivElement>()}
        outline={null}
        backToTop={withBackToTop ? { visible: true, scrollToTop: vi.fn() } : null}
      >
        <p>Body</p>
      </DocReadingPane>
    </NextIntlClientProvider>,
  );
}

function scrollContainer(): HTMLElement {
  const pane = screen.getByTestId("doc-reading-pane");
  const scroller = pane.querySelector<HTMLElement>(".overflow-auto");
  if (!scroller) throw new Error("스크롤 컨테이너를 못 찾았다 — 이 파일의 아래 단언은 전부 무의미하다");
  return scroller;
}

describe("DocReadingPane bottom reserve", () => {
  it("reserves the back-to-top clearance when the pill is drawn", () => {
    renderPane(true);
    expect(scrollContainer().className).toContain(
      "pb-[var(--doc-reading-back-to-top-clearance)]",
    );
  });

  /**
   * The clearance token already steps above `--topology-mobile-bottom-tab-reserve` below
   * `lg`, so a second `max-lg:pb-*` beside it would be a merge contest rather than a
   * larger reserve. This asserts the branch is exclusive, not additive.
   */
  it("does not also apply the bare tab-bar reserve while the pill is drawn", () => {
    renderPane(true);
    expect(scrollContainer().className).not.toContain("--topology-mobile-bottom-tab-reserve");
  });

  it("still reserves the bottom tab bar when there is no pill — the Docs editor", () => {
    renderPane(false);
    const className = scrollContainer().className;
    expect(className).toContain(
      "max-lg:pb-[calc(var(--topology-mobile-bottom-tab-reserve)+12px)]",
    );
    expect(className).not.toContain("--doc-reading-back-to-top-clearance");
  });
});
