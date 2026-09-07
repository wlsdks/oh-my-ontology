/**
 * The `created_by` and `status` values a wiki page carries are contract vocabulary
 * (`agent:claude`, `model:llama3.1`, `human`; `draft`, `reviewed`). On the surface they are
 * words a person reads, so the identifier form stays in the file and a readable form goes on
 * the row: the runtime's name, the model's name, or "a person". An unknown value is shown as
 * written rather than guessed at.
 */
export type LibraryLabelT = (key: string, values?: Record<string, string | number>) => string;

const RUNTIME_NAMES: Record<string, string> = { claude: "Claude", codex: "Codex", gemini: "Gemini" };

export function writerLabel(createdBy: string | null | undefined, t: LibraryLabelT): string {
  if (!createdBy) return t("wiki.unknownAuthor");
  if (createdBy === "human") return t("wiki.writer.human");
  const agent = /^agent:(.+)$/.exec(createdBy);
  if (agent) {
    // `agent:claude-acp`, `agent:claude-code`, `agent:codex-acp`: the runtime id carries a
    // suffix the greeting adds; the person knows the tool by its first word.
    const id = agent[1];
    const known = Object.keys(RUNTIME_NAMES).find((key) => id === key || id.startsWith(`${key}-`));
    return t("wiki.writer.agent", { name: known ? RUNTIME_NAMES[known] : id });
  }
  const model = /^model:(.+)$/.exec(createdBy);
  if (model) return t("wiki.writer.model", { name: model[1] });
  return createdBy;
}

export function wikiStatusLabel(status: string | null | undefined, t: LibraryLabelT): string | null {
  if (!status) return null;
  if (status === "draft" || status === "reviewed") return t(`wiki.status.${status}`);
  return status;
}
