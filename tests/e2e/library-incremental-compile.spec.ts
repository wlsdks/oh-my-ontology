import { createHash } from "node:crypto";

import { expect, test } from "@playwright/test";

import { seedFirstRunSeen } from "./first-run-seed";
import { installLibraryWorkHarness } from "./library-work-harness";

const SOURCE = "# Release decision\n\nRelease is September 22, approved by Mira on September 10.\n";
const HASH = createHash("sha256").update(SOURCE).digest("hex");
const answerPath = "wiki/answers/release-date.md";
const page = (title: string, hash: string, value: string) => `---\ntitle: ${title}\ncreated_by: agent:claude\ncompiled_at: 2026-09-01T00:00:00Z\nsources:\n  - sources/release.md\nsource_hash:\n  sources/release.md: ${hash}\nstatus: draft\nsummary: Release timing.\n---\n\n## Summary\n\n${value}\n\n## Facts\n\n- ${value} [[src:sources/release.md#p2]]\n\n## Decisions\n\n## Open questions\n\n## Not in sources\n`;
const call = (id: string, name: string, args: unknown) => JSON.stringify({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", content: "", tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] } }] });

test("a current source write-up cannot hide an outdated filed answer; approval updates its existing path", async ({ page: browser }) => {
  await seedFirstRunSeen(browser);
  const oldAnswer = page("When do we release?", "unmeasured", "Release is September 15.");
  const currentPage = page("Release decision", HASH, "Release is September 22.");
  const harness = await installLibraryWorkHarness(browser, {
    files: { "sources/release.md": SOURCE, "wiki/release.md": currentPage, [answerPath]: oldAnswer },
    localResponses: [
      call("r1", "read_source_text", { path: "sources/release.md" }),
      call("r2", "read_wiki_page", { slug: "wiki/answers/release-date" }),
      call("p1", "propose_wiki_page", { slug: "wiki/answers/release-date", title: "When do we release?", summary: "The updated release date.", overview: ["The dated approval moved the release."], facts: ["Release is September 22. [[src:sources/release.md#p2]]"], decisions: ["Mira approved it on September 10. [[src:sources/release.md#p2]]"], open_questions: [], not_in_sources: [] }),
      JSON.stringify({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Revised answer proposed." } }] }),
    ],
  });
  await browser.goto("/en/docs/?guides=off");
  await browser.getByRole("button", { name: /Open my folder/i }).click();
  await browser.goto("/en/library/?guides=off&e2e=1");
  await browser.getByTestId("library-index-segment-wiki").click();
  await expect(browser.getByText("1 existing page needs rechecking", { exact: false }).first()).toBeVisible();
  await expect(browser.getByTestId("library-compile")).toBeEnabled();
  // Begin from the old answer, where the local review used to remain hidden.
  await browser.getByRole("button", { name: /When do we release\?/ }).first().click();
  await browser.getByTestId("library-compile").click();
  const card = browser.getByTestId("library-local-compile-card");
  await expect(card).toBeVisible();
  await expect(browser.getByTestId("library-work-current")).toContainText("wiki/answers/release-date");
  await expect(card).toContainText(answerPath);
  await expect(card.getByTestId("library-local-compile-preview")).toContainText("Release is September 15.");
  await expect(card.getByTestId("library-local-compile-preview")).toContainText("Release is September 22.");
  expect((await harness.snapshot(browser)).files[answerPath]).toBe(oldAnswer);
  await browser.getByTestId("library-local-compile-allow").click();
  await expect(browser.getByTestId("library-local-compile-written")).toBeVisible();
  await expect(browser.getByText("1 existing page needs rechecking", { exact: false })).toHaveCount(0);
  const saved = await harness.snapshot(browser);
  const sourceResult = saved.calls.filter((entry) => entry.method === "llm_chat")
    .flatMap((entry) => JSON.parse(String((entry.params as { body: string }).body)).messages)
    .find((message: { role: string; content: string }) => message.role === "tool" && message.content.includes('"relatedPages"'));
  expect(sourceResult).toBeDefined();
  const related = JSON.parse(sourceResult.content).relatedPages;
  expect(related.searchedPages).toBe(2);
  expect(related.fullTextPages).toBe(2);
  expect(related.candidates.map((candidate: { slug: string }) => candidate.slug)).toContain("wiki/answers/release-date");
  expect(saved.files[answerPath]).toContain("Release is September 22.");
  expect(saved.files[answerPath]).toContain(HASH);
  expect(saved.files["wiki/release.md"]).toBe(currentPage);
  expect(saved.writes.filter((entry) => entry.relativePath === answerPath)).toHaveLength(1);
  expect(Object.keys(saved.files).filter((path) => path.startsWith("wiki/") && !path.includes("/_")).sort()).toEqual([answerPath, "wiki/release.md"]);
  await browser.getByRole("button", { name: /When do we release\?/ }).first().click();
  await expect(browser.getByText("Release is September 22.", { exact: false }).last()).toBeVisible();
});
