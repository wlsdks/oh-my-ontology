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

const DEFAULT_SIMPLE_SCRIPT_NAMES = new Set(["benchmark", "build", "dev", "e2e", "lint", "test"]);

export function pnpmScriptsFromText(text) {
  return [...new Set([...String(text).matchAll(/pnpm ([\w:*-]+)/g)].map((match) => match[1]))].filter(
    (script) =>
      !DEFAULT_IGNORED_PNPM_COMMANDS.has(script) &&
      !script.includes("*") &&
      !script.endsWith(":") &&
      (script.includes(":") || DEFAULT_SIMPLE_SCRIPT_NAMES.has(script)),
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
