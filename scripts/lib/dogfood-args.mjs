export function stripLeadingPnpmSeparator(argv = []) {
  return argv[0] === '--' ? argv.slice(1) : argv;
}

export function closestDogfoodOption(arg, allowed, { maxDistance = 2 } = {}) {
  if (!arg || !String(arg).startsWith('-')) return null;
  let best = null;
  for (const option of allowed) {
    const distance = levenshteinDistance(String(arg), option);
    if (!best || distance < best.distance) {
      best = { option, distance };
    }
  }
  return best && best.distance <= maxDistance ? best.option : null;
}

function levenshteinDistance(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }
  return previous[b.length];
}
