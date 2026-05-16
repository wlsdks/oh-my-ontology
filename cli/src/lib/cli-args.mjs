export function parseVaultFlag(value) {
  const path = String(value ?? '').trim();
  if (path.startsWith('--')) return false;
  return path ? path : false;
}

export function resolveExclusiveVaultArg({ vault, positional, defaultVault = '.' }) {
  if (vault === false) return { error: '--vault requires a path' };
  if (vault && positional.length > 0) {
    return { error: 'pass vault as either positional argument or --vault, not both' };
  }
  if (positional.length > 1) {
    return { error: `too many arguments: ${positional.slice(1).join(' ')}` };
  }
  return { vault: vault || positional[0] || defaultVault };
}

export function resolveTrailingVaultArg({
  vault,
  positional,
  vaultIndex,
  defaultVault = '.',
}) {
  if (vault === false) return { error: '--vault requires a path' };
  if (vault && positional.length > vaultIndex) {
    return { error: 'pass vault as either positional argument or --vault, not both' };
  }
  if (positional.length > vaultIndex + 1) {
    return { error: `too many arguments: ${positional.slice(vaultIndex + 1).join(' ')}` };
  }
  return { vault: vault || positional[vaultIndex] || defaultVault };
}
