import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseMcpToolResponse } from './mcp-call.mjs';

describe('mcp-call response parsing', () => {
  it('returns structuredContent when text JSON matches with different key order', () => {
    assert.deepEqual(
      parseMcpToolResponse({
        result: {
          content: [{ text: JSON.stringify({ source: 'structured', ok: true }) }],
          structuredContent: { ok: true, source: 'structured' },
        },
      }),
      { ok: true, source: 'structured' },
    );
  });

  it('rejects successful responses when structuredContent drifts from text JSON', () => {
    assert.throws(
      () =>
        parseMcpToolResponse({
          result: {
            content: [{ text: JSON.stringify({ ok: true, source: 'text' }) }],
            structuredContent: { ok: true, source: 'structured' },
          },
        }),
      /mcp tool structuredContent mismatch/,
    );
  });

  it('rejects successful structuredContent responses with non-JSON text content', () => {
    assert.throws(
      () =>
        parseMcpToolResponse({
          result: {
            content: [{ text: 'plain response' }],
            structuredContent: { ok: true, source: 'structured' },
          },
        }),
      /mcp tool structuredContent text is not JSON/,
    );
  });

  it('accepts successful structuredContent responses without text content', () => {
    assert.deepEqual(
      parseMcpToolResponse({
        result: {
          structuredContent: { ok: true, source: 'structured-only' },
        },
      }),
      { ok: true, source: 'structured-only' },
    );
  });

  it('falls back to text JSON when structuredContent is absent', () => {
    assert.deepEqual(
      parseMcpToolResponse({
        result: {
          content: [{ text: JSON.stringify({ ok: true, source: 'text' }) }],
        },
      }),
      { ok: true, source: 'text' },
    );
  });

  it('falls back to text JSON when structuredContent is null', () => {
    assert.deepEqual(
      parseMcpToolResponse({
        result: {
          content: [{ text: JSON.stringify({ ok: true, source: 'text' }) }],
          structuredContent: null,
        },
      }),
      { ok: true, source: 'text' },
    );
  });

  it('keeps plain text fallback and error handling stable', () => {
    assert.deepEqual(
      parseMcpToolResponse({ result: { content: [{ text: 'plain response' }] } }),
      { text: 'plain response' },
    );

    assert.throws(
      () => parseMcpToolResponse({ result: { isError: true, content: [{ text: 'bad input' }] } }),
      /bad input/,
    );
    assert.throws(
      () => parseMcpToolResponse({ error: { message: 'tool exploded' } }),
      /mcp tool error: tool exploded/,
    );
  });
});
