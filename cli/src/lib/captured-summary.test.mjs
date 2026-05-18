import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatCapturedSummary } from './captured-summary.mjs';

const COLORS = {
  cyan: '<cyan>',
  dim: '<dim>',
  reset: '</>',
};

describe('captured-summary', () => {
  it('formats captured title and body excerpt', () => {
    assert.equal(
      formatCapturedSummary(
        {
          frontmatter: { title: 'Foo' },
          bodyExcerpt: '  # Foo  ',
        },
        'deleted node',
        COLORS,
      ),
      '  <dim>deleted node</> <cyan>Foo</>\n    <dim># Foo</>\n',
    );
  });

  it('formats title-only captures', () => {
    assert.equal(
      formatCapturedSummary({ frontmatter: { title: 'Foo' }, bodyExcerpt: '   ' }, 'deleted source', COLORS),
      '  <dim>deleted source</> <cyan>Foo</>\n',
    );
  });

  it('formats excerpt-only captures', () => {
    assert.equal(
      formatCapturedSummary({ frontmatter: {}, bodyExcerpt: '# Foo' }, 'deleted node', COLORS),
      '  <dim>deleted node</>\n    <dim># Foo</>\n',
    );
  });

  it('returns an empty string when no summary fields are available', () => {
    assert.equal(formatCapturedSummary(null, 'deleted node', COLORS), '');
    assert.equal(formatCapturedSummary({ frontmatter: {}, bodyExcerpt: '   ' }, 'deleted node', COLORS), '');
  });
});
