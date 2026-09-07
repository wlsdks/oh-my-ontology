import type { LintFinding } from "./lint-brief";

/**
 * One turn that repairs one finding of the last check. Owner direction 2026-09-07: a
 * check that only reports leaves the work to the person; each finding now carries a door.
 * The brief names the pages and the finding, and holds the writer to the page contract
 * and to the rule the compile brief already carries for a disagreement: both pages, both
 * citations, the later document named — never a silent choice of one value.
 */
export function buildFixBrief({ finding, locale, vaultRoot }: { finding: LintFinding; locale: string; vaultRoot: string }): string {
  const pages = finding.pages.map((slug) => `${slug}.md`).join(", ");
  if (locale === "ko") {
    const what = { disagreement: "두 문서의 값이 어긋납니다", superseded: "나중 문서가 바꿔 놓은 주장이 옛 값으로 남아 있습니다", "missing-link": "같은 주제나 원문을 다루는데 서로 링크가 없습니다" }[finding.code];
    return [
      `폴더: ${vaultRoot}`,
      `고칠 문서: ${pages}`,
      `점검이 찾은 것: ${what}. ${finding.summary}`,
      "",
      "할 일:",
      "- 그 문서들과 인용된 원문을 먼저 읽어. 원문이 말하지 않는 것은 쓰지 마.",
      "- 어긋남이면 한쪽을 고르지 말고 양쪽 문서 모두에 두 값을 각자 인용과 함께 적고, 어느 원문이 나중인지 밝혀.",
      "- 대체된 주장이면 현재 값을 앞에, 옛 값을 \"이전\"으로 남기고 둘 다 인용해.",
      "- 빠진 링크면 양쪽 문서에 `[[wiki/<슬러그>]]` 링크를 서로 걸어.",
      "- 서식(wiki/_template.md)을 지켜. 그 문서들 밖의 파일은 건드리지 마.",
      "- 끝에 무엇을 바꿨는지 문서별로 한 줄씩 적어.",
    ].join("\n");
  }
  const what = { disagreement: "two pages disagree on a value", superseded: "a claim a later document replaced still stands as the old value", "missing-link": "pages share a topic or a source and do not link each other" }[finding.code];
  return [
    `Folder: ${vaultRoot}`,
    `Pages to fix: ${pages}`,
    `What the check found: ${what}. ${finding.summary}`,
    "",
    "Do:",
    "- Read those pages and the originals they cite first. Write nothing the originals do not say.",
    "- For a disagreement, do not pick a side: put both values on both pages, each with its citation, and name which original is later.",
    "- For a superseded claim, lead with the current value, keep the old one marked as earlier, and cite both.",
    "- For a missing link, add `[[wiki/<slug>]]` links both ways.",
    "- Keep the page contract (wiki/_template.md). Touch no file outside those pages.",
    "- End with one line per page saying what changed.",
  ].join("\n");
}
