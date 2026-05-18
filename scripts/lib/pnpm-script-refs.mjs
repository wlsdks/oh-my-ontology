export function pnpmScriptsFromText(text) {
  return [...new Set([...String(text).matchAll(/pnpm ([\w:-]+)/g)].map((match) => match[1]))];
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
