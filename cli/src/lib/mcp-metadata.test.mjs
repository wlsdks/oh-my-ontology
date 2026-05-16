import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseMcpToolMetadataFromDescription } from './mcp-metadata.mjs';

describe('mcp-metadata', () => {
  it('parses tool count and read/write split from package descriptions', () => {
    const metadata = parseMcpToolMetadataFromDescription(
      'MCP server. Current surface: 23 tools (15 read + 8 write).',
    );

    assert.deepEqual(
      {
        toolCount: metadata?.toolCount,
        readCount: metadata?.readCount,
        writeCount: metadata?.writeCount,
        splitText: metadata?.splitText,
      },
      {
        toolCount: '23',
        readCount: '15',
        writeCount: '8',
        splitText: '15 read + 8 write',
      },
    );
    assert.match('init prints (15 read + 8 write)', metadata?.splitPattern);
  });

  it('returns null for descriptions without the tool inventory shape', () => {
    assert.equal(parseMcpToolMetadataFromDescription('MCP server without counts'), null);
    assert.equal(parseMcpToolMetadataFromDescription('23 tools, 15 read, 8 write'), null);
    assert.equal(parseMcpToolMetadataFromDescription(null), null);
  });
});
