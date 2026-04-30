import { describe, expect, it } from 'vitest';
import { buildDocsVaultHref } from './href';

describe('buildDocsVaultHref', () => {
  it('keeps account scope when building doc links', () => {
    expect(
      buildDocsVaultHref({
        accountId: 'demo-workspace',
        slug: 'ARCHITECTURE',
      }),
    ).toBe('/docs/?account=demo-workspace&slug=ARCHITECTURE');
  });

  it('appends hash after query params', () => {
    expect(
      buildDocsVaultHref({
        accountId: 'demo-workspace',
        slug: 'ARCHITECTURE',
        hash: '#section',
      }),
    ).toBe('/docs/?account=demo-workspace&slug=ARCHITECTURE#section');
  });
});
