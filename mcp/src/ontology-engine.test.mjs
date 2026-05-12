import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import { compileOntology } from './ontology-compiler.mjs';
import { queryCompiledOntology } from './ontology-engine.mjs';

function doc(slug, frontmatter = {}) {
  return {
    slug,
    frontmatter,
    body: '',
    mtime: 1,
  };
}

function artifact() {
  return compileOntology(
    [
      doc('domains/auth', { slug: 'auth-domain', kind: 'domain', title: 'Auth' }),
      doc('capabilities/login', {
        kind: 'capability',
        title: 'Login',
        domain: 'auth',
        depends_on: ['auth-domain'],
        elements: ['src/auth/login.ts'],
      }),
      doc('capabilities/session', {
        kind: 'capability',
        title: 'Session',
        depends_on: ['capabilities/login'],
      }),
    ],
    { includeIndexes: true },
  );
}

describe('queryCompiledOntology', () => {
  it('returns deterministic neighbors with alias resolution', () => {
    const result = queryCompiledOntology(artifact(), {
      operation: 'neighbors',
      slug: 'auth-domain',
      direction: 'incoming',
      types: ['dependencies'],
    });

    assert.equal(result.center, 'domains/auth');
    assert.deepEqual(result.nodes.map((node) => node.slug), ['capabilities/login']);
    assert.deepEqual(
      result.edges.map((edge) => ({
        direction: edge.direction,
        from: edge.from,
        to: edge.to,
        via: edge.via,
      })),
      [
        {
          direction: 'incoming',
          from: 'capabilities/login',
          to: 'domains/auth',
          via: 'dependencies',
        },
      ],
    );
  });

  it('finds graph paths over resolved compiled edges', () => {
    const result = queryCompiledOntology(artifact(), {
      operation: 'path',
      from: 'capabilities/session',
      to: 'auth-domain',
      maxHops: 3,
    });

    assert.equal(result.found, true);
    assert.equal(result.hopCount, 2);
    assert.deepEqual(result.hops, [
      'capabilities/session',
      'capabilities/login',
      'domains/auth',
    ]);
    assert.deepEqual(result.edges.map((edge) => edge.via), ['dependencies', 'dependencies']);
  });

  it('returns incoming change impact by default', () => {
    const result = queryCompiledOntology(artifact(), {
      operation: 'impact',
      slug: 'domains/auth',
      depth: 2,
    });

    assert.equal(result.center, 'domains/auth');
    assert.equal(result.direction, 'incoming');
    assert.deepEqual(
      result.nodes.map((row) => ({ slug: row.slug, distance: row.distance })),
      [
        { slug: 'capabilities/login', distance: 1 },
        { slug: 'capabilities/session', distance: 2 },
      ],
    );
  });

  it('returns a bounded resolved subgraph around a seed', () => {
    const result = queryCompiledOntology(artifact(), {
      operation: 'subgraph',
      slug: 'auth-domain',
      depth: 2,
      direction: 'incoming',
    });

    assert.equal(result.seed, 'domains/auth');
    assert.equal(result.totalNodes, 3);
    assert.deepEqual(
      result.nodes.map((row) => ({ slug: row.slug, distance: row.distance })),
      [
        { slug: 'domains/auth', distance: 0 },
        { slug: 'capabilities/login', distance: 1 },
        { slug: 'capabilities/session', distance: 2 },
      ],
    );
    assert.deepEqual(result.edges.map((edge) => edge.via), [
      'dependencies',
      'domain',
      'dependencies',
    ]);

    const limited = queryCompiledOntology(artifact(), {
      operation: 'subgraph',
      slug: 'auth-domain',
      depth: 2,
      direction: 'incoming',
      limit: 2,
    });
    assert.equal(limited.totalNodes, 2);
    assert.equal(limited.limited, true);
  });

  it('returns graph overview aggregates for dashboard-style use', () => {
    const result = queryCompiledOntology(artifact(), {
      operation: 'overview',
      limit: 2,
    });

    assert.equal(result.graph.nodes, 3);
    assert.equal(result.graph.resolvedEdges, 3);
    assert.equal(result.graph.externalEdges, 1);
    assert.match(result.graph.graphHash, /^[a-f0-9]{64}$/);
    assert.deepEqual(result.byKind, { capability: 2, domain: 1 });
    assert.deepEqual(result.byDomain, { auth: 1 });
    assert.deepEqual(result.byRelation, {
      dependencies: 2,
      domain: 1,
      elements: 1,
    });
    assert.deepEqual(result.hubs.map((hub) => hub.slug), [
      'capabilities/login',
      'domains/auth',
    ]);
  });

  it('returns relation schema patterns by node kind', () => {
    const result = queryCompiledOntology(artifact(), {
      operation: 'schema',
    });

    assert.equal(result.operation, 'schema');
    assert.equal(result.totalPatterns, 4);
    assert.deepEqual(
      result.patterns.map(({ fromKind, relation, toKind, count, resolved, external }) => ({
        fromKind,
        relation,
        toKind,
        count,
        resolved,
        external,
      })),
      [
        {
          fromKind: 'capability',
          relation: 'dependencies',
          toKind: 'capability',
          count: 1,
          resolved: 1,
          external: 0,
        },
        {
          fromKind: 'capability',
          relation: 'dependencies',
          toKind: 'domain',
          count: 1,
          resolved: 1,
          external: 0,
        },
        {
          fromKind: 'capability',
          relation: 'domain',
          toKind: 'domain',
          count: 1,
          resolved: 1,
          external: 0,
        },
        {
          fromKind: 'capability',
          relation: 'elements',
          toKind: 'external',
          count: 1,
          resolved: 0,
          external: 1,
        },
      ],
    );
  });

  it('checks a proposed relation against existing edges and schema patterns', () => {
    const existing = queryCompiledOntology(artifact(), {
      operation: 'relation_check',
      from: 'capabilities/login',
      to: 'auth-domain',
      type: 'depends_on',
    });
    assert.equal(existing.relation, 'dependencies');
    assert.equal(existing.exists, true);
    assert.equal(existing.verdict, 'already_exists');
    assert.equal(existing.schemaPattern.count, 1);
    assert.equal(existing.matchingEdges.length, 1);

    const schemaMatch = queryCompiledOntology(artifact(), {
      operation: 'relation_check',
      from: 'capabilities/session',
      to: 'auth-domain',
      type: 'depends_on',
    });
    assert.equal(schemaMatch.exists, false);
    assert.equal(schemaMatch.verdict, 'matches_existing_schema');
    assert.equal(schemaMatch.schemaPattern.toKind, 'domain');

    const newPattern = queryCompiledOntology(artifact(), {
      operation: 'relation_check',
      from: 'domains/auth',
      to: 'capabilities/session',
      type: 'relates',
    });
    assert.equal(newPattern.exists, false);
    assert.equal(newPattern.verdict, 'new_schema_pattern');
    assert.equal(newPattern.schemaPattern, null);
  });

  it('returns deterministic connected components over resolved graph edges', () => {
    const disconnected = compileOntology(
      [
        doc('domains/auth', { slug: 'auth-domain', kind: 'domain', title: 'Auth' }),
        doc('capabilities/login', {
          kind: 'capability',
          title: 'Login',
          domain: 'auth-domain',
        }),
        doc('domains/billing', { kind: 'domain', title: 'Billing' }),
        doc('capabilities/payments', {
          kind: 'capability',
          title: 'Payments',
          domain: 'billing',
        }),
        doc('capabilities/orphan', { kind: 'capability', title: 'Orphan' }),
      ],
      { includeIndexes: true },
    );

    const result = queryCompiledOntology(disconnected, {
      operation: 'components',
      limit: 2,
      nodeLimit: 1,
    });

    assert.equal(result.operation, 'components');
    assert.equal(result.totalComponents, 3);
    assert.equal(result.largestSize, 2);
    assert.equal(result.singletonCount, 1);
    assert.equal(result.limited, true);
    assert.deepEqual(
      result.components.map((component) => ({
        size: component.size,
        kinds: component.kinds,
        nodeLimited: component.nodeLimited,
        firstNode: component.nodes[0].slug,
      })),
      [
        {
          size: 2,
          kinds: { capability: 1, domain: 1 },
          nodeLimited: true,
          firstNode: 'capabilities/login',
        },
        {
          size: 2,
          kinds: { capability: 1, domain: 1 },
          nodeLimited: true,
          firstNode: 'capabilities/payments',
        },
      ],
    );
  });

  it('returns containment lineage across parent arrays and inline domain refs', () => {
    const contained = compileOntology(
      [
        doc('project', {
          kind: 'project',
          title: 'Project',
          domains: ['auth-domain'],
        }),
        doc('domains/auth', {
          slug: 'auth-domain',
          kind: 'domain',
          title: 'Auth',
          capabilities: ['capabilities/login'],
        }),
        doc('capabilities/login', {
          kind: 'capability',
          title: 'Login',
          domain: 'auth-domain',
          elements: ['elements/token'],
        }),
        doc('capabilities/session', {
          kind: 'capability',
          title: 'Session',
          domain: 'auth-domain',
        }),
        doc('elements/token', {
          kind: 'element',
          title: 'Token',
        }),
      ],
      { includeIndexes: true },
    );

    const result = queryCompiledOntology(contained, {
      operation: 'lineage',
      slug: 'capabilities/login',
    });

    assert.equal(result.operation, 'lineage');
    assert.equal(result.center, 'capabilities/login');
    assert.deepEqual(
      result.ancestors.nodes.map((row) => ({ slug: row.slug, distance: row.distance, via: row.via })),
      [
        { slug: 'domains/auth', distance: 1, via: 'domain' },
        { slug: 'project', distance: 2, via: 'domains' },
      ],
    );
    assert.deepEqual(
      result.descendants.nodes.map((row) => ({
        slug: row.slug,
        distance: row.distance,
        via: row.via,
      })),
      [{ slug: 'elements/token', distance: 1, via: 'elements' }],
    );

    const domain = queryCompiledOntology(contained, {
      operation: 'lineage',
      slug: 'auth-domain',
      depth: 1,
    });

    assert.deepEqual(domain.ancestors.nodes.map((row) => row.slug), ['project']);
    assert.deepEqual(domain.descendants.nodes.map((row) => row.slug), [
      'capabilities/login',
      'capabilities/session',
    ]);
  });

  it('detects directed dependency cycles deterministically', () => {
    const cyclic = compileOntology(
      [
        doc('capabilities/a', {
          kind: 'capability',
          title: 'A',
          depends_on: ['capabilities/b'],
        }),
        doc('capabilities/b', {
          kind: 'capability',
          title: 'B',
          depends_on: ['capabilities/c'],
        }),
        doc('capabilities/c', {
          kind: 'capability',
          title: 'C',
          depends_on: ['capabilities/a'],
        }),
        doc('capabilities/d', {
          kind: 'capability',
          title: 'D',
          depends_on: ['capabilities/e'],
        }),
        doc('capabilities/e', {
          kind: 'capability',
          title: 'E',
        }),
      ],
      { includeIndexes: true },
    );

    const result = queryCompiledOntology(cyclic, {
      operation: 'cycles',
    });

    assert.equal(result.operation, 'cycles');
    assert.deepEqual(result.relationTypes, ['dependencies']);
    assert.equal(result.totalCycles, 1);
    assert.equal(result.limited, false);
    assert.deepEqual(result.cycles[0].nodes, [
      'capabilities/a',
      'capabilities/b',
      'capabilities/c',
      'capabilities/a',
    ]);
    assert.deepEqual(result.cycles[0].edges.map((edge) => edge.via), [
      'dependencies',
      'dependencies',
      'dependencies',
    ]);

    const shortDepth = queryCompiledOntology(cyclic, {
      operation: 'cycles',
      maxHops: 2,
    });
    assert.equal(shortDepth.totalCycles, 0);
  });
});
