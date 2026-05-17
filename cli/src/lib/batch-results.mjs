export function assertConceptBatchResult(payload, context = 'add_concepts', options = {}) {
  assertObject(payload, context);
  assertArray(payload.concepts, `${context}.concepts`);
  assertExpectedCount(payload.concepts, `${context}.concepts`, options.expectedCount);
  payload.concepts.forEach((row, index) => {
    const rowPath = `${context}.concepts[${index}]`;
    assertObject(row, rowPath);
    assertBoolean(row.ok, `${rowPath}.ok`);
    if ('slug' in row) assertNonEmptyString(row.slug, `${rowPath}.slug`);
    if (row.ok === true) {
      assertNonEmptyString(row.slug, `${rowPath}.slug`);
      if ('filePath' in row) assertNonEmptyString(row.filePath, `${rowPath}.filePath`);
      if ('changed' in row) assertBoolean(row.changed, `${rowPath}.changed`);
      if ('warnings' in row) assertStringArray(row.warnings, `${rowPath}.warnings`);
    } else {
      assertNonEmptyString(row.error, `${rowPath}.error`);
    }
  });
}

export function assertRelationBatchResult(payload, context = 'add_relations', options = {}) {
  assertObject(payload, context);
  assertArray(payload.relations, `${context}.relations`);
  assertExpectedCount(payload.relations, `${context}.relations`, options.expectedCount);
  payload.relations.forEach((row, index) => {
    const rowPath = `${context}.relations[${index}]`;
    assertObject(row, rowPath);
    assertBoolean(row.ok, `${rowPath}.ok`);
    if ('from' in row) assertNonEmptyString(row.from, `${rowPath}.from`);
    if ('to' in row) assertNonEmptyString(row.to, `${rowPath}.to`);
    if ('type' in row) assertNonEmptyString(row.type, `${rowPath}.type`);
    if (row.ok === true) {
      assertNonEmptyString(row.from, `${rowPath}.from`);
      assertNonEmptyString(row.to, `${rowPath}.to`);
      assertNonEmptyString(row.type, `${rowPath}.type`);
      if ('alreadyExists' in row) assertBoolean(row.alreadyExists, `${rowPath}.alreadyExists`);
      if ('changed' in row) assertBoolean(row.changed, `${rowPath}.changed`);
    } else {
      assertNonEmptyString(row.error, `${rowPath}.error`);
    }
  });
}

function assertObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
}

function assertArray(value, path) {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }
}

function assertBoolean(value, path) {
  if (typeof value !== 'boolean') {
    throw new Error(`${path} must be a boolean`);
  }
}

function assertNonEmptyString(value, path) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
}

function assertStringArray(value, path) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${path} must be a string array`);
  }
}

function assertExpectedCount(rows, path, expectedCount) {
  if (expectedCount === undefined) return;
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 0) {
    throw new Error(`${path} expectedCount must be a non-negative safe integer`);
  }
  if (rows.length !== expectedCount) {
    throw new Error(`${path} row count mismatch: expected ${expectedCount}, got ${rows.length}`);
  }
}
