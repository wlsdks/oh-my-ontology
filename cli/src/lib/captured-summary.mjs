export function formatCapturedSummary(captured, label, colors) {
  const title = nonEmptyString(captured?.frontmatter?.title);
  const excerpt = typeof captured?.bodyExcerpt === 'string' ? captured.bodyExcerpt.trim() : '';
  if (!title && !excerpt) return '';

  let output = `  ${colors.dim}${label}${colors.reset}`;
  if (title) output += ` ${colors.cyan}${title}${colors.reset}`;
  output += '\n';
  if (excerpt) {
    output += `    ${colors.dim}${excerpt}${colors.reset}\n`;
  }
  return output;
}

function nonEmptyString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}
