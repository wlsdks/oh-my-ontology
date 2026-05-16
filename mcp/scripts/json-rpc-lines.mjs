export function parseJsonRpcResponses(stdout) {
  return String(stdout || "")
    .split("\n")
    .filter(Boolean)
    .map((s) => {
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function expectedResponseIds(requests) {
  return new Set(
    requests
      .map((request) => request.id)
      .filter((id) => Number.isInteger(id)),
  );
}

export function hasAllResponses(stdout, expectedIds) {
  const receivedIds = new Set(parseJsonRpcResponses(stdout).map((response) => response.id));
  return [...expectedIds].every((id) => receivedIds.has(id));
}

export function hasAllResultResponses(stdout, expectedIds) {
  const receivedIds = new Set(
    parseJsonRpcResponses(stdout)
      .filter((response) => response?.result)
      .map((response) => response.id),
  );
  return [...expectedIds].every((id) => receivedIds.has(id));
}

export function hasAnyErrorResponse(stdout, expectedIds = null) {
  return parseJsonRpcResponses(stdout).some((response) => (
    response?.error && (!expectedIds || expectedIds.has(response.id))
  ));
}

export function missingResponseLabels(responses, labels) {
  const receivedIds = new Set(responses.map((response) => response.id));
  return [...labels]
    .filter(([id]) => !receivedIds.has(id))
    .map(([, label]) => label);
}
