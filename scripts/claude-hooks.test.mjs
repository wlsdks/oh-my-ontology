import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';

const PUBLISH_HOOK = '.claude/hooks/block-npm-publish.sh';
const SETTINGS_FILE = '.claude/settings.json';

describe('Claude Code hooks', () => {
  it('keeps configured hook commands present and executable', async () => {
    const settings = JSON.parse(await readFile(SETTINGS_FILE, 'utf8'));
    const commands = configuredHookCommands(settings);

    assert.deepEqual(commands.sort(), [
      '.claude/hooks/block-npm-publish.sh',
      '.claude/hooks/inject-ontology-summary.sh',
    ]);

    for (const command of commands) {
      await access(command, constants.X_OK);
    }
  });

  it('blocks publish commands at shell command boundaries', () => {
    for (const command of [
      'npm publish',
      'cd mcp && npm publish',
      'echo ok\nnpm publish',
      'pnpm publish --access public',
      'echo ok; yarn publish',
      'npm pack',
    ]) {
      const result = runPublishHook({ tool_name: 'Bash', tool_input: { command } });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /"permissionDecision": "deny"/, command);
      assert.match(result.stdout, /npm publish 가드/, command);
    }
  });

  it('allows read-only package commands and non-Bash tools', () => {
    for (const payload of [
      { tool_name: 'Bash', tool_input: { command: 'npm pack --dry-run' } },
      { tool_name: 'Bash', tool_input: { command: 'npm whoami && npm view oh-my-ontology-mcp' } },
      { tool_name: 'Bash', tool_input: { command: 'cat <<EOF\nnpm publish\nEOF' } },
      { tool_name: 'Read', tool_input: { command: 'npm publish' } },
    ]) {
      const result = runPublishHook(payload);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, '');
    }
  });
});

function configuredHookCommands(settings) {
  const commands = [];
  for (const event of Object.values(settings.hooks ?? {})) {
    for (const group of event) {
      for (const hook of group.hooks ?? []) {
        if (hook.type === 'command') commands.push(hook.command);
      }
    }
  }
  return commands;
}

function runPublishHook(payload) {
  return spawnSync('bash', [PUBLISH_HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
}
