"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from "react";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Plus, SquareArrowOutUpRight, Trash2 } from "lucide-react";
import { PermissionGate } from "@/features/permissions";
import type { Status, StatusDotColor, StatusInput } from "@/entities/status";
import {
  deleteStatus,
  subscribeStatuses,
  upsertStatus,
} from "@/entities/status/api";
import { projectToInput, type Project } from "@/entities/project";
import { subscribeProjects, upsertProject } from "@/entities/project/api";
import { Button } from "@/shared/ui";
import { OperationsNav } from "@/widgets/operations-nav";
import { cn } from "@/shared/lib/cn";

const DEFAULT_RETURN_TO = "/settings/";

function normalizeReturnTo(returnTo?: string): string {
  if (!returnTo) return DEFAULT_RETURN_TO;
  if (!returnTo.startsWith("/projects") && !returnTo.startsWith("/settings/")) {
    return DEFAULT_RETURN_TO;
  }
  return returnTo;
}

function buildStatusesHref(
  selectedId: string | null,
  returnTo: string,
  accountId: string | null,
): string {
  const params = new URLSearchParams();

  if (accountId) {
    params.set("account", accountId);
  }
  if (selectedId) {
    params.set("selected", selectedId);
  }
  if (returnTo !== DEFAULT_RETURN_TO) {
    params.set("returnTo", returnTo);
  }

  const query = params.toString();
  return query ? `/settings/statuses/?${query}` : "/settings/statuses/";
}

function areDraftsEqual(a: StatusDraft, b: StatusDraft) {
  return JSON.stringify(a) === JSON.stringify(b);
}

type StatusDraft = {
  id: string;
  label: string;
  labelEn: string;
  order: string;
  dotColor: StatusDotColor;
};

// Round 9b T1-4: dotColor 라벨도 t() 로. value 는 enum 그대로, label 은
// 호출 시점에 useTranslations 으로 해소 (이전엔 영문 하드코딩 → ko UI 깨짐).
const DOT_COLOR_VALUES: ReadonlyArray<StatusDotColor> = [
  "neutral",
  "warning",
  "success",
  "paused",
];

const DOT_COLOR_PREVIEW_CLASS: Record<StatusDotColor, string> = {
  neutral: "bg-[color:var(--color-text-quaternary)]",
  warning: "bg-[color:var(--color-status-warning)]",
  success: "bg-[color:var(--color-status-success)]",
  paused: "bg-[color:var(--color-status-paused)]",
};

function createEmptyDraft(nextOrder: number): StatusDraft {
  return {
    id: "",
    label: "",
    labelEn: "",
    order: String(nextOrder),
    dotColor: "neutral",
  };
}

function toDraft(status: Status): StatusDraft {
  return {
    id: status.id,
    label: status.label,
    labelEn: status.labelEn ?? "",
    order: String(status.order),
    dotColor: status.dotColor,
  };
}

function toInput(draft: StatusDraft): StatusInput {
  return {
    id: draft.id.trim(),
    label: draft.label.trim(),
    labelEn: draft.labelEn.trim() || undefined,
    order: Number(draft.order),
    dotColor: draft.dotColor,
  };
}

function getNextOrder(statuses: Status[]) {
  return statuses.length === 0
    ? 0
    : Math.max(...statuses.map((status) => status.order)) + 1;
}

type ValidationKey =
  | "validationIdLocked"
  | "validationIdFormat"
  | "validationLabelRequired"
  | "validationOrderInvalid"
  | "validationDuplicate";

function validateDraft(
  draft: StatusDraft,
  editingId: string | null,
  statuses: Status[],
): ValidationKey | null {
  const id = draft.id.trim();
  if (editingId && id !== editingId) {
    return "validationIdLocked";
  }
  if (!/^[a-z0-9-]+$/.test(id)) {
    return "validationIdFormat";
  }
  if (!draft.label.trim()) return "validationLabelRequired";
  if (draft.order.trim() === "" || Number.isNaN(Number(draft.order))) {
    return "validationOrderInvalid";
  }
  const duplicated = statuses.find((status) => status.id === id);
  if (duplicated && duplicated.id !== editingId) {
    return "validationDuplicate";
  }
  return null;
}

function StatusesContent() {
  const searchParams = useSearchParams();
  const t = useTranslations("settings.statuses");
  const initialSelectedId = searchParams.get("selected");
  const accountId = searchParams.get("account")?.trim() || null;
  const safeReturnTo = normalizeReturnTo(
    searchParams.get("returnTo") ?? undefined,
  );
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId,
  );
  const [draft, setDraft] = useState<StatusDraft>(createEmptyDraft(0));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replacementStatusId, setReplacementStatusId] = useState("");

  useEffect(() => {
    const unsubStatuses = subscribeStatuses((list) => {
      setStatuses(list);
      setSelectedId((current) => {
        if (current === null) return current;
        return list.some((status) => status.id === current) ? current : null;
      });
    });
    const unsubProjects = subscribeProjects((list) => setProjects(list));
    return () => {
      unsubStatuses();
      unsubProjects();
    };
  }, []);

  useEffect(() => {
    if (selectedId === null) {
      queueMicrotask(() => {
        setDraft((current) => {
          if (current.id.trim() || current.label.trim()) {
            return current;
          }

          const nextOrder = getNextOrder(statuses);
          return current.order === String(nextOrder)
            ? current
            : createEmptyDraft(nextOrder);
        });
      });
      return;
    }
    const selected = statuses.find((status) => status.id === selectedId);
    if (selected) {
      queueMicrotask(() => setDraft(toDraft(selected)));
    }
  }, [selectedId, statuses]);

  const projectCountByStatus = useMemo(() => {
    const counts = new Map<string, number>();
    for (const project of projects) {
      counts.set(project.status, (counts.get(project.status) ?? 0) + 1);
    }
    return counts;
  }, [projects]);

  const handleNew = () => {
    if (!confirmDiscardChanges()) return;
    setSelectedId(null);
    setDraft(createEmptyDraft(getNextOrder(statuses)));
    setError(null);
    setMessage(null);
  };

  const handleSave = async () => {
    setError(null);
    setMessage(null);
    const validationError = validateDraft(draft, selectedId, statuses);
    if (validationError) {
      setError(t(validationError));
      return;
    }

    setSaving(true);
    try {
      const input = toInput(draft);
      await upsertStatus(input);
      setSelectedId(input.id);
      setMessage(selectedId ? t("messageSaved") : t("messageCreated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const refCount = projectCountByStatus.get(selectedId) ?? 0;
    if (refCount > 0) {
      setError(t("errorReferenced", { count: refCount }));
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await deleteStatus(selectedId);
      setSelectedId(null);
      setDraft(
        createEmptyDraft(
          getNextOrder(statuses.filter((status) => status.id !== selectedId)),
        ),
      );
      setMessage(t("messageDeleted"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorDeleteFailed"));
    } finally {
      setSaving(false);
    }
  };

  const selectedReferenceCount = selectedId
    ? (projectCountByStatus.get(selectedId) ?? 0)
    : 0;
  const replacementStatuses = useMemo(
    () => statuses.filter((status) => status.id !== selectedId),
    [selectedId, statuses],
  );
  const selectedProjects = useMemo(
    () =>
      selectedId
        ? projects
            .filter((project) => project.status === selectedId)
            .sort((a, b) => a.name.localeCompare(b.name))
        : [],
    [projects, selectedId],
  );

  useEffect(() => {
    queueMicrotask(() => {
      setReplacementStatusId((current) => {
        if (
          current &&
          current !== selectedId &&
          replacementStatuses.some((status) => status.id === current)
        ) {
          return current;
        }

        return replacementStatuses[0]?.id ?? "";
      });
    });
  }, [replacementStatuses, selectedId]);

  const statusesHref = useMemo(
    () => buildStatusesHref(selectedId, safeReturnTo, accountId),
    [accountId, safeReturnTo, selectedId],
  );
  const draftBaseline = useMemo(() => {
    if (selectedId) {
      const selected = statuses.find((status) => status.id === selectedId);
      return selected ? toDraft(selected) : createEmptyDraft(0);
    }

    return createEmptyDraft(getNextOrder(statuses));
  }, [selectedId, statuses]);
  const isDirty = useMemo(
    () => !areDraftsEqual(draft, draftBaseline),
    [draft, draftBaseline],
  );
  const confirmDiscardChanges = useCallback(() => {
    if (!isDirty) return true;
    return window.confirm(t("discardConfirm"));
  }, [isDirty, t]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.history.replaceState({}, "", statusesHref);
  }, [statusesHref]);

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleNavigateWithGuard = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    if (!confirmDiscardChanges()) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    window.location.assign(href);
  };

  const handleSelectStatus = (id: string) => {
    if (id === selectedId) return;
    if (!confirmDiscardChanges()) return;

    setSelectedId(id);
    setError(null);
    setMessage(null);
  };

  const handleReassignAndDelete = async () => {
    if (!selectedId) return;
    if (selectedProjects.length === 0) {
      await handleDelete();
      return;
    }
    if (!replacementStatusId || replacementStatusId === selectedId) {
      setError(t("errorPickReplacement"));
      return;
    }

    const targetStatus = statuses.find(
      (status) => status.id === replacementStatusId,
    );
    if (!targetStatus) {
      setError(t("errorReplacementMissing"));
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      for (const project of selectedProjects) {
        const updatedProject: Project = {
          ...project,
          status: replacementStatusId,
        };
        await upsertProject(projectToInput(updatedProject));
      }

      await deleteStatus(selectedId);
      setSelectedId(null);
      setDraft(
        createEmptyDraft(
          getNextOrder(statuses.filter((status) => status.id !== selectedId)),
        ),
      );
      setMessage(
        t("messageReassigned", {
          count: selectedProjects.length,
          name: targetStatus.label,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorReassignFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[color:var(--color-canvas)]">
      <h1 className="sr-only">{t("srTitle")}</h1>
      <OperationsNav />
      <div className="mx-auto max-w-5xl px-5 py-6 md:px-12 md:py-10">
        <Link
          href={safeReturnTo}
          data-testid="status-back-link"
          onClick={(event) => handleNavigateWithGuard(event, safeReturnTo)}
          className="inline-flex items-center gap-1.5 break-keep text-[12px] text-[color:var(--color-text-tertiary)] transition-colors hover:text-[color:var(--color-text-primary)]"
        >
          <ArrowLeft size={14} />
          {t("back")}
        </Link>

        <header className="mt-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="break-keep text-[28px] font-[var(--font-weight-signature)] tracking-[var(--tracking-section)] text-[color:var(--color-text-primary)] md:text-3xl">
              {t("title")}
            </h1>
            <p className="mt-2 break-keep text-sm text-[color:var(--color-text-tertiary)]">
              {t("subtitle")}
            </p>
          </div>
          <Button
            data-testid="status-new"
            type="button"
            size="sm"
            onClick={handleNew}
          >
            <Plus size={14} className="mr-1" />
            {t("newStatus")}
          </Button>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <section className="rounded-xl border border-[color:var(--color-divider)] bg-[color:var(--color-panel)] p-3">
            <div className="mb-3 flex items-center justify-between px-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-quaternary)]">
                {t("sectionStatuses")}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-quaternary)]">
                {statuses.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {statuses.map((status) => {
                const selected = status.id === selectedId;
                const refCount = projectCountByStatus.get(status.id) ?? 0;
                return (
                  <button
                    key={status.id}
                    data-testid={`status-item-${status.id}`}
                    type="button"
                    onClick={() => handleSelectStatus(status.id)}
                    className={cn(
                      "rounded-lg border px-3 py-3 text-left transition-colors",
                      selected
                        ? "border-[color:var(--color-indigo-brand)] bg-[color:rgba(94,106,210,0.12)]"
                        : "border-[color:var(--color-overlay-2)] hover:border-[color:var(--color-border-strong)]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-[var(--font-weight-signature)] text-[color:var(--color-text-primary)]">
                          {status.label}
                        </p>
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-text-quaternary)]">
                          {status.id}
                        </p>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-text-quaternary)]">
                        {t("refsBadge", { count: refCount })}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          DOT_COLOR_PREVIEW_CLASS[status.dotColor],
                        )}
                      />
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-text-quaternary)]">
                        {status.dotColor}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-[color:var(--color-divider)] bg-[color:var(--color-panel)] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-[var(--font-weight-signature)] text-[color:var(--color-text-primary)]">
                  {selectedId ? draft.label || selectedId : t("newStatusEmpty")}
                </h2>
                <p className="mt-1 text-sm text-[color:var(--color-text-tertiary)]">
                  {selectedId
                    ? t("refsCountText", { count: selectedReferenceCount })
                    : t("newStatusHelper")}
                </p>
              </div>
              {selectedId && (
                <div className="flex items-center gap-2">
                  <Link
                    href={`/project/new/?status=${encodeURIComponent(
                        selectedId,
                      )}&returnTo=${encodeURIComponent(statusesHref)}`}
                    data-testid="status-create-project"
                    onClick={(event) =>
                      handleNavigateWithGuard(
                        event,
                        `/project/new/?status=${encodeURIComponent(
                            selectedId,
                          )}&returnTo=${encodeURIComponent(statusesHref)}`,
                      )
                    }
                    className="inline-flex"
                  >
                    <Button type="button" size="sm" variant="ghost">
                      <SquareArrowOutUpRight size={14} className="mr-1" />
                      {t("createProject")}
                    </Button>
                  </Link>
                  <Button
                    data-testid="status-delete"
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleDelete()}
                    disabled={saving}
                  >
                    <Trash2 size={14} className="mr-1" />
                    {t("delete")}
                  </Button>
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label={t("fieldId")}>
                <input
                  data-testid="status-input-id"
                  value={draft.id}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      id: event.target.value,
                    }))
                  }
                  disabled={selectedId !== null}
                  className="w-full rounded-lg border border-[color:var(--color-divider)] bg-[color:var(--color-canvas)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] disabled:opacity-60"
                />
                {selectedId && (
                  <p
                    data-testid="status-id-locked-hint"
                    className="mt-1 text-[11px] text-[color:var(--color-text-quaternary)]"
                  >
                    {t("idLockedHint")}
                  </p>
                )}
              </Field>
              <Field label={t("fieldOrder")}>
                <input
                  data-testid="status-input-order"
                  type="number"
                  value={draft.order}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      order: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[color:var(--color-divider)] bg-[color:var(--color-canvas)] px-3 py-2 text-sm text-[color:var(--color-text-primary)]"
                />
              </Field>
              <Field label={t("fieldLabel")}>
                <input
                  data-testid="status-input-label"
                  value={draft.label}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[color:var(--color-divider)] bg-[color:var(--color-canvas)] px-3 py-2 text-sm text-[color:var(--color-text-primary)]"
                />
              </Field>
              <Field label={t("fieldLabelEn")}>
                <input
                  data-testid="status-input-label-en"
                  value={draft.labelEn}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      labelEn: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[color:var(--color-divider)] bg-[color:var(--color-canvas)] px-3 py-2 text-sm text-[color:var(--color-text-primary)]"
                />
              </Field>
              <Field label={t("fieldDotColor")}>
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "h-3 w-3 rounded-full",
                      DOT_COLOR_PREVIEW_CLASS[draft.dotColor],
                    )}
                  />
                  <select
                    data-testid="status-input-dot-color"
                    value={draft.dotColor}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        dotColor: event.target.value as StatusDotColor,
                      }))
                    }
                    className="w-full rounded-lg border border-[color:var(--color-divider)] bg-[color:var(--color-canvas)] px-3 py-2 text-sm text-[color:var(--color-text-primary)]"
                  >
                    {DOT_COLOR_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {t(`dotColor.${value}` as 'dotColor.neutral' | 'dotColor.warning' | 'dotColor.success' | 'dotColor.paused')}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>
            </div>

            {(error || message) && (
              <div
                role={error ? "alert" : "status"}
                aria-live={error ? "assertive" : "polite"}
                className={cn(
                  "mt-4 rounded-lg border px-3 py-2 text-sm",
                  error
                    ? "border-[color:rgba(229,72,77,0.32)] text-[color:var(--color-status-danger)]"
                    : "border-[color:rgba(94,106,210,0.28)] text-[color:var(--color-text-secondary)]",
                )}
              >
                {error ?? message}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end">
              <Button
                data-testid="status-save"
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? t("saving") : selectedId ? t("saveExisting") : t("saveCreate")}
              </Button>
            </div>

            {selectedId && (
              <section className="mt-6 border-t border-[color:var(--color-overlay-2)] pt-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-quaternary)]">
                    {t("sectionReferenced")}
                  </h3>
                  <span
                    data-testid="status-linked-project-count"
                    className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-text-quaternary)]"
                  >
                    {selectedProjects.length}
                  </span>
                </div>
                {selectedProjects.length === 0 ? (
                  <p className="mt-3 text-sm text-[color:var(--color-text-tertiary)]">
                    {t("noReferencedProjects")}
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedProjects.map((project) => (
                      <Link
                        key={project.slug}
                        href={`/project/${encodeURIComponent(project.slug)}/edit/?returnTo=${encodeURIComponent(statusesHref)}`}
                        data-testid={`status-linked-project-${project.slug}`}
                        onClick={(event) =>
                          handleNavigateWithGuard(
                            event,
                            `/project/${encodeURIComponent(project.slug)}/edit/?returnTo=${encodeURIComponent(statusesHref)}`,
                          )
                        }
                        className="rounded-md border border-[color:var(--color-divider)] px-3 py-1.5 text-sm text-[color:var(--color-text-secondary)] transition-colors hover:border-[color:var(--color-indigo-brand)] hover:text-[color:var(--color-text-primary)]"
                      >
                        {project.name}
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            )}

            {selectedId && selectedProjects.length > 0 && (
              <section className="mt-6 border-t border-[color:var(--color-overlay-2)] pt-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-quaternary)]">
                    {t("sectionReassign")}
                  </h3>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-text-quaternary)]">
                    {t("reassignProjectsBadge", { count: selectedProjects.length })}
                  </span>
                </div>

                {replacementStatuses.length === 0 ? (
                  <p className="mt-3 text-sm text-[color:var(--color-text-tertiary)]">
                    {t("needsAnotherStatus")}
                  </p>
                ) : (
                  <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                    <select
                      data-testid="status-reassign-target"
                      value={replacementStatusId}
                      onChange={(event) =>
                        setReplacementStatusId(event.target.value)
                      }
                      className="w-full rounded-lg border border-[color:var(--color-divider)] bg-[color:var(--color-canvas)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] md:max-w-xs"
                    >
                      {replacementStatuses.map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      data-testid="status-reassign-delete"
                      type="button"
                      variant="ghost"
                      onClick={() => void handleReassignAndDelete()}
                      disabled={saving}
                    >
                      {t("reassignAndDelete")}
                    </Button>
                  </div>
                )}
              </section>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-quaternary)]">
        {label}
      </span>
      {children}
    </label>
  );
}

export function StatusesPage() {
  return (
    <PermissionGate>
      <StatusesContent />
    </PermissionGate>
  );
}
