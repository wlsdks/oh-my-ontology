import { describe, expect, it } from 'vitest';
import { buildGraphML, buildJsonLd } from './export-graph';
import type { EphemeralNode } from './use-ephemeral-nodes';
import type { EphemeralEdge } from './use-ephemeral-edges';

const nodes: EphemeralNode[] = [
  {
    id: 'n_abc123',
    title: 'Auth platform',
    kind: 'project',
    kindLabel: 'Project',
    x: 0,
    y: 0,
  },
  {
    id: 'n_def456',
    title: 'Login flow',
    kind: 'capability',
    kindLabel: 'Capability',
    x: 0,
    y: 0,
  },
];

const edges: EphemeralEdge[] = [
  {
    id: 'e_ghi789',
    source: 'n_abc123',
    target: 'n_def456',
    edgeType: 'related_to',
  },
];

describe('export-graph', () => {
  describe('buildJsonLd', () => {
    it('emits @context + @graph with kind classes + edge predicates', () => {
      const out = buildJsonLd({ ephemeralNodes: nodes, ephemeralEdges: edges, accountId: 'demo' });
      const doc = JSON.parse(out);
      expect(doc['@context']).toBeDefined();
      expect(doc['@context']['@vocab']).toBe('https://schema.org/');
      expect(doc['@graph']).toHaveLength(2);
      const project = doc['@graph'][0];
      expect(project['@type']).toBe('Project');
      expect(project.kind).toBe('project');
      expect(project.title).toBe('Auth platform');
      // related_to is the v1 edge type (single 'related_to' literal in schema).
      expect(project.related_to).toEqual({ '@id': expect.stringMatching(/capability:login/) });
    });

    it('includes account in URN', () => {
      const out = buildJsonLd({ ephemeralNodes: nodes, ephemeralEdges: [], accountId: 'demo' });
      expect(out).toContain('urn:omot:demo:project:auth-platform');
    });
  });

  describe('buildGraphML', () => {
    it('emits well-formed XML with kind/title/edgeType attributes', () => {
      const out = buildGraphML({ ephemeralNodes: nodes, ephemeralEdges: edges, accountId: 'demo' });
      expect(out).toContain('<?xml version="1.0"');
      expect(out).toContain('<graphml');
      expect(out).toContain('<key id="kind"');
      expect(out).toContain('<key id="title"');
      expect(out).toContain('<key id="edgeType"');
      expect(out).toContain('<data key="kind">project</data>');
      expect(out).toContain('<data key="title">Auth platform</data>');
      expect(out).toContain('<data key="edgeType">related_to</data>');
      expect(out).toMatch(/<edge id="e0" source="project_auth-platform_[^"]+" target="capability_login-flow_[^"]+">/);
    });

    it('escapes XML special chars in title', () => {
      const xss: EphemeralNode[] = [
        { id: 'n_x', title: '<script>&"alert"</script>', kind: 'project', kindLabel: 'Project', x: 0, y: 0 },
      ];
      const out = buildGraphML({ ephemeralNodes: xss, ephemeralEdges: [], accountId: 'demo' });
      expect(out).not.toContain('<script>');
      expect(out).toContain('&lt;script&gt;&amp;&quot;alert&quot;&lt;/script&gt;');
    });

    it('handles empty graph', () => {
      const out = buildGraphML({ ephemeralNodes: [], ephemeralEdges: [], accountId: 'demo' });
      expect(out).toContain('<graph id="demo" edgedefault="directed">');
      expect(out).toContain('</graph>');
    });
  });
});
