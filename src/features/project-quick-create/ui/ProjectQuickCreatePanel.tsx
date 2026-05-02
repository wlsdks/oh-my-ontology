"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import type { Category } from "@/entities/category";
import { type Project } from "@/entities/project";
import type { Status } from "@/entities/status";
import { useProjectMutations } from "@/features/project-data-source";
import { slugify } from "@/shared/lib/slugify";
import { Button } from "@/shared/ui";

interface Props {
  accountId?: string | null;
  projects: Project[];
  categories: Category[];
  statuses: Status[];
  onCreated?: (project: { slug: string; name: string }) => void;
  initiallyOpen?: boolean;
  submitLabel?: string;
}

function buildUniqueSlug(name: string, existingSlugs: Set<string>) {
  const base = slugify(name) || `project-${Date.now().toString(36)}`;
  let next = base;
  let index = 2;

  while (existingSlugs.has(next)) {
    next = `${base}-${index}`;
    index += 1;
  }

  return next;
}

export function ProjectQuickCreatePanel({
  accountId,
  projects,
  categories,
  statuses,
  onCreated,
  initiallyOpen = false,
  submitLabel,
}: Props) {
  const t = useTranslations("settings.quickCreate");
  const effectiveSubmitLabel = submitLabel ?? t("defaultSubmit");
  const [open, setOpen] = useState(initiallyOpen);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createProject } = useProjectMutations();

  const existingSlugs = useMemo(
    () => new Set(projects.map((project) => project.slug)),
    [projects],
  );
  const derivedSlug = useMemo(
    () => buildUniqueSlug(name, existingSlugs),
    [existingSlugs, name],
  );

  const defaultCategoryId = categories[0]?.id ?? "in-progress";
  const defaultStatusId = statuses.find((status) => status.id === "planning")?.id
    ?? statuses[0]?.id
    ?? "planning";

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!trimmedName || !trimmedDescription) {
      setError(t("errorRequired"));
      return;
    }

    setPending(true);
    setError(null);

    try {
      const input = {
        accountId: accountId ?? undefined,
        slug: derivedSlug,
        name: trimmedName,
        category: defaultCategoryId,
        status: defaultStatusId,
        description: trimmedDescription,
        owner: owner.trim() || undefined,
        tags: [],
        stack: [],
        links: [],
        dependencies: [],
        screenshots: [],
        isHub: false,
        timeline: {},
        position: {
          x: 220 + projects.length * 36,
          y: 180 + projects.length * 28,
        },
      };
      await createProject(input);

      setName("");
      setDescription("");
      setOwner("");
      setOpen(false);
      onCreated?.({ slug: derivedSlug, name: trimmedName });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t("errorGeneric"),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      className={
        open || projects.length === 0
          ? "rounded-[22px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-overlay-1)] px-4 py-4"
          : "flex items-center justify-between gap-3 rounded-[18px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-overlay-1)] px-4 py-3"
      }
    >
      {!open && projects.length > 0 ? (
        <>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-indigo-accent)]">
              {t("newProjectEyebrow")}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setOpen(true)}
          >
            <Sparkles size={14} aria-hidden="true" />
            {t("openLabel")}
          </Button>
        </>
      ) : (
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-indigo-accent)]">
            {t("leadEyebrow")}
          </p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--color-text-secondary)]">
            {t("leadBody")}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={open ? "outline" : "ghost"}
          onClick={() => setOpen((current) => !current)}
        >
          <Sparkles size={14} aria-hidden="true" />
          {open ? t("closeLabel") : t("openLabel")}
        </Button>
      </div>
      )}

      {open ? (
        <div className="mt-4 border-t border-[color:var(--color-divider)] pt-4">
          <div className="space-y-4">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-quaternary)]">
                {t("fieldName")}
              </span>
              <input
                data-testid="quick-create-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("fieldNamePlaceholder")}
                className="mt-2 h-11 w-full rounded-xl border border-[color:var(--color-divider)] bg-[color:var(--color-overlay-1)] px-4 text-sm text-[color:var(--color-text-primary)] outline-none transition-colors placeholder:text-[color:var(--color-text-quaternary)] focus:border-[color:var(--color-indigo-accent)]"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-quaternary)]">
                {t("fieldDescription")}
              </span>
              <textarea
                data-testid="quick-create-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder={t("fieldDescriptionPlaceholder")}
                className="mt-2 w-full rounded-xl border border-[color:var(--color-divider)] bg-[color:var(--color-overlay-1)] px-4 py-3 text-sm leading-6 text-[color:var(--color-text-primary)] outline-none transition-colors placeholder:text-[color:var(--color-text-quaternary)] focus:border-[color:var(--color-indigo-accent)]"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-quaternary)]">
                {t("fieldOwner")}
              </span>
              <input
                data-testid="quick-create-owner"
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                placeholder={t("fieldOwnerPlaceholder")}
                className="mt-2 h-11 w-full rounded-xl border border-[color:var(--color-divider)] bg-[color:var(--color-overlay-1)] px-4 text-sm text-[color:var(--color-text-primary)] outline-none transition-colors placeholder:text-[color:var(--color-text-quaternary)] focus:border-[color:var(--color-indigo-accent)]"
              />
            </label>

            {error ? (
              <p className="text-sm text-[color:var(--color-status-danger)]">{error}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                data-testid="quick-create-submit"
                onClick={() => void handleSubmit()}
                disabled={pending}
              >
                {pending ? t("submitting") : effectiveSubmitLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
