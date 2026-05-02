"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Upload } from "lucide-react";
import { PermissionGate } from "@/features/permissions";
import {
  parseProjectsCsv,
  type CsvParseError,
} from "@/features/project-import";
import type { ProjectInput } from "@/entities/project";
import { getProject, upsertProject } from "@/entities/project/api";
import { STARTER_SAMPLE_PROJECTS } from "@/shared/config/starter-samples";
import { Button, DetailCard, EmptyState, useToast } from "@/shared/ui";
import {
  ACCOUNT_QUERY_KEY,
} from "@/shared/lib/account-scope";
import { OperationsNav } from "@/widgets/operations-nav";

const CSV_PLACEHOLDER = [
  "slug,name,category,status,description,dependencies,tags,isHub",
  "iam-hub,통합 인증 허브,in-progress,developing,인증 전담 허브,,Auth|Hub,true",
  "checkout,결제 서비스,in-progress,developing,결제 처리,iam-hub,Commerce,false",
].join("\n");

type ImportStatus = "idle" | "importing" | "done";

interface ImportOutcome {
  succeeded: string[];
  failed: Array<{ slug: string; message: string }>;
}

function ImportContent() {
  const searchParams = useSearchParams();
  const t = useTranslations("settings.import");
  const accountId = null;
  const [csvText, setCsvText] = useState("");
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const { show: showToast } = useToast();

  const { valid, errors } = useMemo(() => {
    if (!csvText.trim()) {
      return { valid: [] as ProjectInput[], errors: [] as CsvParseError[] };
    }
    return parseProjectsCsv(csvText);
  }, [csvText]);

  const dashboardHref = "/projects/";
  const homeHref = "/";

  const writeProjects = async (projects: ProjectInput[]): Promise<ImportOutcome> => {
    const succeeded: string[] = [];
    const failed: Array<{ slug: string; message: string }> = [];
    for (const project of projects) {
      try {
        const input: ProjectInput = accountId
          ? { ...project, accountId }
          : project;
        const existing = await getProject(input.slug, input.accountId);
        if (existing) {
          throw new Error(t("errorDuplicateSlug"));
        }
        await upsertProject(input);
        succeeded.push(project.slug);
      } catch (err) {
        failed.push({
          slug: project.slug,
          message: err instanceof Error ? err.message : t("errorUnknown"),
        });
      }
    }
    return { succeeded, failed };
  };

  const handleImportCsv = async () => {
    if (valid.length === 0 || status === "importing") return;
    setStatus("importing");
    const result = await writeProjects(valid);
    setOutcome(result);
    setStatus("done");
    if (result.succeeded.length > 0) {
      showToast(
        result.failed.length > 0
          ? t("toastAddedFailed", {
              count: result.succeeded.length,
              failed: result.failed.length,
            })
          : t("toastAdded", { count: result.succeeded.length }),
        result.failed.length > 0 ? "info" : "success",
      );
    } else if (result.failed.length > 0) {
      showToast(t("toastAllFailed", { count: result.failed.length }), "error");
    }
  };

  const handleImportSample = async () => {
    if (status === "importing") return;
    setStatus("importing");
    const result = await writeProjects(STARTER_SAMPLE_PROJECTS);
    setOutcome(result);
    setStatus("done");
    if (result.succeeded.length > 0) {
      showToast(
        result.failed.length > 0
          ? t("toastSampleAddedFailed", {
              count: result.succeeded.length,
              failed: result.failed.length,
            })
          : t("toastSampleAdded", { count: result.succeeded.length }),
        result.failed.length > 0 ? "info" : "success",
      );
    }
  };

  return (
    <main className="min-h-screen bg-[color:var(--color-canvas)]">
      <h1 className="sr-only">{t("srTitle")}</h1>
      <OperationsNav />
      <div className="mx-auto max-w-4xl px-5 py-6 md:px-12 md:py-10">
        <Link
          href={dashboardHref}
          className="inline-flex items-center gap-1.5 break-keep text-[12px] text-[color:var(--color-text-tertiary)] transition-colors hover:text-[color:var(--color-text-primary)]"
        >
          <ArrowLeft size={14} />
          {t("back")}
        </Link>

        <header className="mt-8 flex flex-col gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-text-quaternary)]">
            {t("eyebrow")}
          </p>
          <h1 className="text-2xl font-[var(--font-weight-signature)] tracking-[var(--tracking-section)] text-[color:var(--color-text-primary)] md:text-3xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-sm text-[color:var(--color-text-tertiary)]">
            {t("subtitle")}
          </p>
          {accountId ? (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-quaternary)]">
              {t("scopeLabel", { accountId })}
            </p>
          ) : null}
        </header>

        <div className="mt-8 flex flex-col gap-6">
          <DetailCard
            eyebrow={t("sampleEyebrow")}
            title={t("sampleTitle")}
            description={t("sampleDescription")}
            headerAction={
              <Button
                data-testid="import-sample-button"
                type="button"
                size="sm"
                disabled={status === "importing"}
                onClick={() => void handleImportSample()}
              >
                {status === "importing" ? t("importing") : t("importSample")}
              </Button>
            }
          >
            <ul className="grid gap-2 sm:grid-cols-2">
              {STARTER_SAMPLE_PROJECTS.map((sample) => (
                <li
                  key={sample.slug}
                  className="rounded-md border border-[color:var(--color-border-soft)] bg-[color:var(--color-overlay-1)] px-3 py-2"
                >
                  <p className="truncate text-sm text-[color:var(--color-text-primary)]">
                    {sample.name}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-quaternary)]">
                    {sample.slug}
                    {sample.isHub ? " · HUB" : ""}
                  </p>
                </li>
              ))}
            </ul>
          </DetailCard>

          <DetailCard
            eyebrow={t("csvEyebrow")}
            title={t("csvTitle")}
            description={t("csvDescription")}
            headerAction={
              <Button
                data-testid="import-csv-button"
                type="button"
                size="sm"
                disabled={valid.length === 0 || status === "importing"}
                onClick={() => void handleImportCsv()}
              >
                <Upload size={14} className="mr-1" />
                {status === "importing"
                  ? t("importing")
                  : t("importCsv", { count: valid.length })}
              </Button>
            }
          >
            <textarea
              data-testid="import-csv-textarea"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={CSV_PLACEHOLDER}
              rows={10}
              className="w-full rounded-md border border-[color:var(--color-divider)] bg-[color:var(--color-elevated)] px-3 py-2 font-mono text-[12px] text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-quaternary)] focus:border-[color:rgba(139,151,255,0.5)] focus:outline-none"
              spellCheck={false}
            />

            {errors.length > 0 ? (
              <div
                role="status"
                aria-live="polite"
                className="mt-4 flex flex-col gap-1 rounded-md border border-[color:rgba(244,183,49,0.25)] bg-[color:rgba(244,183,49,0.08)] px-3 py-2.5"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-status-warning)]">
                  {t("parseIssues", { count: errors.length })}
                </p>
                <ul className="mt-1 flex flex-col gap-0.5 text-[12px] text-[color:var(--color-status-warning)]">
                  {errors.slice(0, 15).map((error, index) => (
                    <li key={`${error.line}-${index}`}>
                      <span className="font-mono text-[10px] text-[color:rgba(244,183,49,0.7)]">
                        {t("parseIssueLine", { line: error.line })}
                      </span>{" "}
                      · {error.message}
                    </li>
                  ))}
                  {errors.length > 15 ? (
                    <li className="font-mono text-[10px] text-[color:rgba(244,183,49,0.7)]">
                      {t("parseIssuesMore", { count: errors.length - 15 })}
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            {valid.length > 0 ? (
              <div className="mt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-text-quaternary)]">
                  {t("previewCount", { count: valid.length })}
                </p>
                <ul className="mt-2 flex max-h-60 flex-col divide-y divide-[color:var(--color-border-soft)] overflow-y-auto rounded-md border border-[color:var(--color-border-soft)]">
                  {valid.map((project) => (
                    <li
                      key={project.slug}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[color:var(--color-text-primary)]">
                          {project.name}
                        </p>
                        <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-quaternary)]">
                          {project.slug}
                          {project.isHub ? " · HUB" : ""}
                          {project.dependencies && project.dependencies.length > 0
                            ? ` · deps ${project.dependencies.length}`
                            : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {csvText.trim() && valid.length === 0 && errors.length === 0 ? (
              <EmptyState
                size="compact"
                className="mt-4"
                title={t("noRows")}
                description={t("noRowsHint")}
              />
            ) : null}
          </DetailCard>

          {outcome ? (
            <DetailCard eyebrow={t("resultEyebrow")} title={t("resultTitle")}>
              <div className="flex flex-col gap-2 text-sm">
                <p className="text-[color:var(--color-text-primary)]">
                  {t("resultSummary", {
                    succeeded: outcome.succeeded.length,
                    failed: outcome.failed.length,
                  })}
                </p>
                {outcome.failed.length > 0 ? (
                  <ul
                    role="alert"
                    aria-live="assertive"
                    className="flex flex-col gap-1 rounded-md border border-[color:rgba(244,183,49,0.25)] bg-[color:rgba(244,183,49,0.08)] px-3 py-2"
                  >
                    {outcome.failed.map((fail) => (
                      <li
                        key={fail.slug}
                        className="text-[12px] text-[color:var(--color-status-warning)]"
                      >
                        <span className="font-mono text-[10px]">{fail.slug}</span> · {fail.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {outcome.succeeded.length > 0 ? (
                  <div className="mt-2 flex gap-3">
                    <Link href={homeHref} className="inline-flex">
                      <Button type="button" size="sm">
                        {t("viewOnMap")}
                      </Button>
                    </Link>
                    <Link href={dashboardHref} className="inline-flex">
                      <Button type="button" size="sm" variant="outline">
                        {t("toDashboard")}
                      </Button>
                    </Link>
                  </div>
                ) : null}
              </div>
            </DetailCard>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export function ProjectImportPage() {
  return (
    <PermissionGate>
      <ImportContent />
    </PermissionGate>
  );
}
