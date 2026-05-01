type KnowledgeHrefOptions = {
  /** knowledge 내부 "project" 라벨. */
  projectId?: string | null;
  returnTo?: string | null;
  versionId?: string | null;
  jobStatus?: string | null;
  title?: string | null;
};

function appendKnowledgeParams(path: string, options?: KnowledgeHrefOptions): string {
  if (!options) return path;

  const url = new URL(path, "http://local.test");

  if (options.projectId) {
    url.searchParams.set("project", options.projectId);
  }
  if (options.returnTo) {
    url.searchParams.set("returnTo", options.returnTo);
  }
  if (options.versionId) {
    url.searchParams.set("version", options.versionId);
  }
  if (options.jobStatus) {
    url.searchParams.set("jobStatus", options.jobStatus);
  }
  if (options.title) {
    url.searchParams.set("title", options.title);
  }

  return `${url.pathname}?${url.searchParams.toString()}`;
}

function decorate(
  path: string,
  _accountId?: string | null,
  options?: KnowledgeHrefOptions,
): string {
  return appendKnowledgeParams(path, options);
}

export function getKnowledgeDocumentDetailHref(
  documentId: string,
  accountId?: string | null,
  options?: KnowledgeHrefOptions,
): string {
  return decorate(
    `/knowledge/documents/view/?id=${encodeURIComponent(documentId)}`,
    accountId,
    options,
  );
}

export function getKnowledgeDocumentListHref(
  accountId?: string | null,
  options?: KnowledgeHrefOptions,
): string {
  return decorate("/knowledge/documents/", accountId, options);
}

export function getKnowledgeDocumentNewHref(
  accountId?: string | null,
  options?: KnowledgeHrefOptions,
): string {
  return decorate("/knowledge/documents/new/", accountId, options);
}

