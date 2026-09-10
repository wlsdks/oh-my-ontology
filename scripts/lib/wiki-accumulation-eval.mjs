/** Fixture-specific textual obligations, not a semantic judge or a production write gate. */
export function evaluateAccumulation(fixture, { candidates, page = '', applied = false }) {
  const { gold, existing } = fixture;
  const section = (name) => page.match(new RegExp(`^## ${name}\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'))?.[1] ?? '';
  const prose = page.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
  const cited = ({ pattern, citation }) => prose.split(/\r?\n/).some((line) => new RegExp(pattern, 'iu').test(line) && line.includes(citation));
  const revised = applied && page !== existing.raw;
  const checks = {
    retrievalHitAt3: candidates.slice(0, 3).some((candidate) => candidate.slug === existing.slug),
    revisedExistingPage: revised,
    priorClaimWithCitation: revised && cited(gold.prior),
    incomingClaimWithCitation: revised && cited(gold.incoming),
    humanNoteRetained: revised && prose.normalize('NFKC').replace(/\s+/g, ' ').includes(gold.note.normalize('NFKC').replace(/\s+/g, ' ')),
    summaryObligation: revised && new RegExp(gold.summaryPattern, 'iu').test(section('Summary')),
    disagreementRecorded: revised && new RegExp(gold.openQuestionPattern, 'iu').test(section('Open questions'))
      && section('Open questions').includes(gold.prior.citation) && section('Open questions').includes(gold.incoming.citation),
  };
  return { id: fixture.id, checks, failed: Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key) };
}

export function summarizeAccumulation(results) {
  const names = Object.keys(results[0]?.checks ?? {});
  return Object.fromEntries(names.map((name) => [name, {
    passed: results.filter((result) => result.checks[name]).length, total: results.length,
  }]));
}
