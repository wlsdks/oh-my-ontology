const DEFAULT_IGNORED_PNPM_COMMANDS = new Set([
  "add",
  "audit",
  "config",
  "dlx",
  "exec",
  "install",
  "link",
  "publish",
  "run",
  "setup",
]);

function collectPnpmCommandCandidates(text) {
  const source = String(text);
  const candidates = [];
  const commandPattern =
    /(?:^|\n|`|&&|\|\|)\s*(?:[$>]\s*)?(?:[A-Z_][A-Z0-9_]*=\S+\s+)*pnpm\s+([\w:*-]+)/g;
  for (const match of source.matchAll(commandPattern)) {
    candidates.push(match[1]);
  }
  return candidates;
}

export function pnpmScriptsFromText(text) {
  return [...new Set(collectPnpmCommandCandidates(text))].filter(
    (script) => !DEFAULT_IGNORED_PNPM_COMMANDS.has(script) && !script.includes("*") && !script.endsWith(":"),
  );
}

export function missingPnpmScripts(text, scripts = {}) {
  return pnpmScriptsFromText(text).filter((script) => typeof scripts?.[script] !== "string");
}

export function assertPnpmScriptsExist(text, scripts = {}) {
  const missing = missingPnpmScripts(text, scripts);
  if (missing.length > 0) {
    throw new Error(`Missing package.json scripts: ${missing.join(", ")}`);
  }
}
