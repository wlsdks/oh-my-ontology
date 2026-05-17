export function assertAnalyzeRepoStructureResult(payload, context = 'analyze_repo_structure') {
  assertObject(payload, context);
  if ('project' in payload && payload.project != null) {
    assertCandidate(payload.project, `${context}.project`);
  }
  assertCandidateArray(payload.domains, `${context}.domains`, { optional: true });
  assertCandidateArray(payload.capabilities, `${context}.capabilities`, { optional: true });
  assertCandidateArray(payload.elements, `${context}.elements`, { optional: true });
  assertRelationArray(payload.suggestedRelations, `${context}.suggestedRelations`, { optional: true });
}

function assertCandidateArray(value, path, options = {}) {
  if (value === undefined && options.optional) return;
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }
  value.forEach((row, index) => assertCandidate(row, `${path}[${index}]`));
}

function assertRelationArray(value, path, options = {}) {
  if (value === undefined && options.optional) return;
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }
  value.forEach((row, index) => {
    const rowPath = `${path}[${index}]`;
    assertObject(row, rowPath);
    assertNonEmptyString(row.from, `${rowPath}.from`);
    assertNonEmptyString(row.to, `${rowPath}.to`);
    assertNonEmptyString(row.type, `${rowPath}.type`);
  });
}

function assertCandidate(row, path) {
  assertObject(row, path);
  assertNonEmptyString(row.slug, `${path}.slug`);
  assertNonEmptyString(row.title, `${path}.title`);
  if ('domain' in row && row.domain !== undefined) {
    assertNonEmptyString(row.domain, `${path}.domain`);
  }
}

function assertObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
}

function assertNonEmptyString(value, path) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
}
