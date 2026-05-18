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
  "...",
  "…",
]);

const PNPM_OPTIONS_WITH_VALUE = new Set([
  "-C",
  "-F",
  "--dir",
  "--filter",
  "--workspace-concurrency",
]);

function scriptFromPnpmArgs(argsText) {
  const args = String(argsText).trim().split(/\s+/).filter(Boolean);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith("--") || /^-[A-Za-z]$/.test(arg)) {
      if (!arg.includes("=") && PNPM_OPTIONS_WITH_VALUE.has(arg)) {
        index += 1;
      }
      continue;
    }
    return arg;
  }
  return null;
}

function collectPnpmCommandCandidates(text) {
  const source = String(text);
  const candidates = [];
  const commandPattern =
    /(?:^|\n|`|&&|\|\|)\s*(?:[$>]\s*)?(?:[A-Z_][A-Z0-9_]*=\S+\s+)*pnpm\s+([^\n`&|;]+)/g;
  for (const match of source.matchAll(commandPattern)) {
    const script = scriptFromPnpmArgs(match[1]);
    if (script) {
      candidates.push(script);
    }
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
