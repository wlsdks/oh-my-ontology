import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../messages/en.json";
import { LibraryConversationDoor } from "./LibraryConversationDoor";

function draw(activity: Parameters<typeof LibraryConversationDoor>[0]["activity"]) {
  const onOpen = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <LibraryConversationDoor activity={activity} agentLabel="Claude Agent" onOpen={onOpen} />
    </NextIntlClientProvider>,
  );
  return { onOpen, chip: screen.getByTestId("library-open-conversation") };
}

describe("the put-away conversation", () => {
  it("names the destination while nothing is running", () => {
    const { chip } = draw(null);
    expect(chip).toHaveTextContent("Conversation");
    expect(chip.getAttribute("data-agent-running")).toBeNull();
    expect(screen.queryByTestId("library-conversation-running-dot")).toBeNull();
  });

  it("says which step is running and what it is touching, not merely that something is", () => {
    const { chip } = draw({
      state: "editing",
      summary: "Write up the four sources",
      ontologySlug: null,
      toolName: "Write wiki/contractor-quotes.md",
    });
    expect(chip).toHaveTextContent("Editing · Write wiki/contractor-quotes.md");
    expect(screen.getByTestId("library-conversation-running-dot")).toBeInTheDocument();
  });

  it("falls back to the request when the turn has not named a tool yet", () => {
    const { chip } = draw({
      state: "planning",
      summary: "Check the wiki against its sources",
      ontologySlug: null,
      toolName: null,
    });
    expect(chip).toHaveTextContent("Planning · Check the wiki against its sources");
  });

  it("says a shut dock is holding a permission card — the one turn that waits forever", () => {
    const { chip } = draw({
      state: "blocked",
      summary: "Write up the four sources",
      ontologySlug: null,
      toolName: "Write /outside/notes.md",
    });
    expect(chip).toHaveTextContent("Waiting for approval");
    expect(chip.getAttribute("aria-label")).toBe(
      "Open the conversation. Claude Agent is still working: Waiting for approval.",
    );
  });

  it("is still the door back into the conversation while it runs", () => {
    const { onOpen, chip } = draw({
      state: "verifying",
      summary: null,
      ontologySlug: "contractor-quotes",
      toolName: null,
    });
    fireEvent.click(chip);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
