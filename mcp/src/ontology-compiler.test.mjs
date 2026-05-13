import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import { compileOntology } from './ontology-compiler.mjs';

function doc(slug, frontmatter = {}) {
  return {
    slug,
    frontmatter,
    body: '',
    mtime: 1,
  };
}

function timedDoc(slug, frontmatter = {}, mtime = 1) {
  return {
    slug,
    frontmatter,
    body: '',
    mtime,
  };
}

describe('compileOntology', () => {
  it('compiles nodes, canonical edges, aliases, and adjacency indexes', () => {
    const result = compileOntology(
      [
        doc('domains/auth', { slug: 'auth-domain', kind: 'domain', title: 'Auth' }),
        doc('capabilities/login', {
          kind: 'capability',
          title: 'Login',
          depends_on: ['auth-domain'],
          relates: ['missing'],
        }),
      ],
      { includeIndexes: true },
    );

    assert.equal(result.version, 1);
    assert.match(result.graphHash, /^[a-f0-9]{64}$/);
    assert.equal(result.maxMtime, 1);
    assert.equal(result.nodeCount, 2);
    assert.equal(result.edgeCount, 2);
    assert.equal(result.resolvedEdgeCount, 1);
    assert.equal(result.externalEdgeCount, 0);
    assert.equal(result.unresolvedEdgeCount, 1);
    assert.deepEqual(
      result.edges.map((edge) => ({
        from: edge.from,
        to: edge.to,
        via: edge.via,
        ref: edge.ref,
        resolved: edge.resolved,
        external: edge.external,
      })),
      [
        {
          from: 'capabilities/login',
          to: 'domains/auth',
          via: 'dependencies',
          ref: 'auth-domain',
          resolved: true,
          external: false,
        },
        {
          from: 'capabilities/login',
          to: 'missing',
          via: 'relates',
          ref: 'missing',
          resolved: false,
          external: false,
        },
      ],
    );
    assert.deepEqual(result.indexes.in['domains/auth'], [
      'capabilities/login->domains/auth:dependencies:auth-domain',
    ]);
    assert.deepEqual(result.indexes.byKind, {
      capability: ['capabilities/login'],
      domain: ['domains/auth'],
    });
    assert.deepEqual(result.indexes.byDomain, {});
    assert.equal(
      result.indexes.edgeById['capabilities/login->domains/auth:dependencies:auth-domain'].to,
      'domains/auth',
    );
    assert.equal(result.indexes.aliasToSlug['auth-domain'], 'domains/auth');
    assert.deepEqual(result.nodes.find((node) => node.slug === 'capabilities/login'), {
      slug: 'capabilities/login',
      kind: 'capability',
      title: 'Login',
      domain: undefined,
      mtime: 1,
      outDegree: 2,
      inDegree: 0,
    });
    assert.ok(result.aliases.some((alias) => alias.alias === 'auth-domain' && alias.slug === 'domains/auth'));
    assert.ok(result.issues.some((issue) => issue.code === 'dangling-graph-reference'));
  });

  it('reports ambiguous aliases without resolving them', () => {
    const result = compileOntology([
      doc('domains/auth', { kind: 'domain' }),
      doc('capabilities/auth', { kind: 'capability' }),
      doc('project', { kind: 'project', domains: ['auth'] }),
    ]);

    assert.deepEqual(result.ambiguousAliases, [
      { alias: 'auth', slugs: ['capabilities/auth', 'domains/auth'] },
    ]);
    assert.deepEqual(result.edges, [
      {
        id: 'project->auth:domains:auth',
        from: 'project',
        to: 'auth',
        via: 'domains',
        ref: 'auth',
        resolved: false,
        external: false,
      },
    ]);
    assert.ok(result.issues.some((issue) => issue.code === 'ambiguous-alias'));
  });

  it('classifies path-like element refs as external edges, not dangling issues', () => {
    const result = compileOntology([
      doc('capabilities/mcp-server', {
        kind: 'capability',
        elements: ['mcp/src/ontology-compiler.mjs'],
      }),
    ]);

    assert.equal(result.externalEdgeCount, 1);
    assert.equal(result.unresolvedEdgeCount, 0);
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.edges, [
      {
        id: 'capabilities/mcp-server->mcp/src/ontology-compiler.mjs:elements:mcp/src/ontology-compiler.mjs',
        from: 'capabilities/mcp-server',
        to: 'mcp/src/ontology-compiler.mjs',
        via: 'elements',
        ref: 'mcp/src/ontology-compiler.mjs',
        resolved: false,
        external: true,
      },
    ]);
  });

  it('keeps graphHash stable across mtime-only changes', () => {
    const first = compileOntology([
      timedDoc('domains/auth', { kind: 'domain', title: 'Auth' }, 10),
      timedDoc('capabilities/login', { kind: 'capability', domain: 'auth' }, 20),
    ]);
    const second = compileOntology([
      timedDoc('domains/auth', { kind: 'domain', title: 'Auth' }, 100),
      timedDoc('capabilities/login', { kind: 'capability', domain: 'auth' }, 200),
    ]);

    assert.equal(first.graphHash, second.graphHash);
    assert.equal(first.maxMtime, 20);
    assert.equal(second.maxMtime, 200);
  });

  it('reports graph array canonicalization actions outside graphHash', () => {
    const dirty = compileOntology([
      doc('project', {
        kind: 'project',
        capabilities: ['capabilities/z', 'capabilities/a', 'capabilities/z'],
      }),
      doc('capabilities/a', { kind: 'capability' }),
      doc('capabilities/z', { kind: 'capability' }),
    ]);
    const clean = compileOntology([
      doc('project', {
        kind: 'project',
        capabilities: ['capabilities/a', 'capabilities/z'],
      }),
      doc('capabilities/a', { kind: 'capability' }),
      doc('capabilities/z', { kind: 'capability' }),
    ]);

    assert.deepEqual(dirty.canonicalizationActions, [
      {
        slug: 'project',
        keys: ['capabilities'],
        frontmatter: {
          capabilities: ['capabilities/a', 'capabilities/z'],
        },
        expected_mtime: 1,
      },
    ]);
    assert.deepEqual(clean.canonicalizationActions, []);
    assert.equal(dirty.graphHash, clean.graphHash);
  });
});
