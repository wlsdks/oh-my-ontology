# Troubleshooting

Common issues users hit when starting with `oh-my-ontology`. If your case isn't here, open an issue: https://github.com/wlsdks/oh-my-ontology/issues

---

## Vault scaffold (`npx oh-my-ontology init`, web `/docs` button)

### `npx oh-my-ontology` runs an old version

npm caches the package locally. Force a fresh fetch:

```bash
npx --yes oh-my-ontology@latest init my-vault
# or clear the npx cache
rm -rf ~/.npm/_npx
```

### "no new files written — target already has matching files"

The target folder already has `README.md` / `project.md` / etc. — the CLI never overwrites existing files. Either:

- Delete the conflicting files, or
- Use a fresh folder: `npx oh-my-ontology init another-folder`

### Web scaffold button stays grayed out

The button only enables when:

1. You picked a folder via "Open my markdown folder" *and*
2. The picked handle has read+write permission.

If the browser asked only for "view files" permission, click the picker again and approve "edit files."

### Browser refuses to write to the picked folder

The File System Access API requires:

- A user gesture (click) that called `showDirectoryPicker` — refresh and click again.
- HTTPS or `localhost`. Some browsers block on plain HTTP.
- A non-system folder. Try a folder under `~/Documents` or `~/Desktop`.

---

## MCP server (Claude Code, Cursor, etc.)

### Agent doesn't see `oh-my-ontology__list_concepts` etc.

1. Confirm the package is reachable: `npx -y oh-my-ontology-mcp` (it should start a stdio server and wait — Ctrl+C to exit).
2. Check the agent's MCP config — `command` should be `npx`, `args: ["-y", "oh-my-ontology-mcp"]`.
3. Set `env.OMOT_VAULT` to the **absolute path** of the vault folder (the browser app's `.mcp.json.example` ships a placeholder; you must replace it).
4. Restart the agent (Claude Code / Cursor pickup MCP config at start).

### "Vault path does not exist" / `EACCES`

`OMOT_VAULT` must be:

- An absolute path, not relative or `~/...`. Expand `~` yourself.
- Readable and writable by the user running the agent.
- A directory (not a file).

### Agent reads but can't write (`add_concept` fails)

Check the directory's write permission with `ls -ld $OMOT_VAULT`. The agent runs under your shell user; if a parent dir is read-only, writes fail.

### MCP server starts then exits immediately

Usually a Node version mismatch. The server requires Node 20+:

```bash
node --version            # must print v20.x or higher
```

If you use `nvm`, set the agent to invoke `npx` from a v20+ shim.

---

## Web workbench (dev / prod)

### `pnpm dev` 500 error after `pnpm build`

`pnpm build` produces a static `out/` folder, but it can leave `.next/` in an incompatible state. Reset:

```bash
rm -rf .next
pnpm dev
```

### Topology view is blank

The vault may have no edges yet. Add a relation:

```yaml
# in some capability's frontmatter
depends_on:
  - capabilities/login
```

…or use the builder canvas (`/ontology/edit`) and connect two nodes with a drag.

### Search palette returns "no results" for everything

Check your vault has at least one `.md` with frontmatter `slug:` and `kind:`. The search index ignores files without frontmatter.

---

## npm publish (maintainer-only)

> If you are *using* the package, you don't need to publish. This section is for project maintainers.

### `403 Forbidden` on `npm publish`

- 2FA OTP wrong or expired — re-run with a fresh OTP.
- Your account doesn't own the package name — try `--access=public` for scoped packages, or use a different name.

### `npm publish` says nothing happened

Likely you forgot to bump the version. npm rejects republishing the same version. Bump first:

```bash
cd mcp
npm version patch                    # 0.5.0 → 0.5.1
npm publish --access=public
```

### "I published the wrong thing"

- Within 24h of publish: `npm unpublish oh-my-ontology-mcp@<version>` removes it.
- After 24h: `npm deprecate oh-my-ontology-mcp@<version> "reason"` — installers see a warning but the version stays.

### Why doesn't Claude Code just run `npm publish` for me?

It can't. `.claude/settings.json` ships a PreToolUse hook that blocks `npm publish` / `pnpm publish` / `yarn publish` until you explicitly type "publish it" in chat. This is intentional — npm publishes are permanent (after 24h) and tied to *your* npm account. See `CLAUDE.md` and `.claude/rules/forbidden.md` for the full rule.

---

## Build / test / lint

### `pnpm exec tsc --noEmit` fails after a vault change

Vault is `.md` only — TypeScript shouldn't care. If it errors, you probably changed `src/features/docs-vault-local/lib/ontology-starter.ts` (the in-app scaffold mirror). Make sure the strings match `cli/templates/vault/`.

### `pnpm lint` complains about FSD boundaries

Don't import `widgets/*` from `entities/*` or `features/*`. Direction is one-way: `app → views → widgets → features → entities → shared`. See `.claude/rules/architecture.md`.

### Vitest hangs on `pnpm test`

Use `pnpm test:run` for one-shot mode. `pnpm test` is watch mode.

---

## Firebase (optional)

Local-first works without Firebase. If you opted into cloud sync:

### "Permission denied" reading `knowledgeApprovedNodes`

Firestore rules require auth + project membership. Sign in (`/login`) first.

### Hosted demo at oh-my-ontology.web.app shows your old data

The hosted demo serves *our* dogfood vault (the project's own `docs/ontology/`). Your data only appears when you self-host or run the workbench locally pointed at your own folder.

---

## Still stuck?

- Open an issue: https://github.com/wlsdks/oh-my-ontology/issues
- Discussions: https://github.com/wlsdks/oh-my-ontology/discussions
- Include: OS, Node version (`node --version`), pnpm version, browser (for web issues), exact error message.
