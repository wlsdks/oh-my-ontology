# The MCP server as a container image — the second npm-free distribution channel.
#
# Two consumers, one file:
#
#   1. The official MCP Registry accepts `registryType: "oci"`, verifying ownership
#      through the `io.modelcontextprotocol.server.name` label below. It must match
#      the `name` in `server.json` exactly.
#   2. Glama's directory builds a server from its Dockerfile, starts it, and
#      indexes the tools it advertises. Authoring this file is what keeps that
#      inspection from guessing at the project structure.
#
# The server speaks stdio, so a client runs it with the vault mounted:
#
#   docker run --rm -i -v /path/to/atlas:/vault ghcr.io/wlsdks/ontology-atlas-mcp:latest
#
# `OATLAS_VAULT` defaults to /vault, and the server treats a folder with no nodes
# as empty rather than failing — an inspector with nothing mounted still gets a
# complete `tools/list`.
FROM node:24-alpine

LABEL io.modelcontextprotocol.server.name="io.github.wlsdks/ontology-atlas"
LABEL org.opencontainers.image.title="Ontology Atlas MCP server"
LABEL org.opencontainers.image.description="Read and write one codebase ontology kept as Markdown in the repository."
LABEL org.opencontainers.image.source="https://github.com/wlsdks/ontology-atlas"
LABEL org.opencontainers.image.url="https://ontologyatlas.com"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# The lockfile is copied first so a source-only change reuses the install layer.
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

COPY src ./src
COPY scripts ./scripts
COPY README.md CHANGELOG.md ./

ENV OATLAS_VAULT=/vault
VOLUME ["/vault"]

# stdio, not a port: the client owns the process lifetime. No EXPOSE, no daemon.
ENTRYPOINT ["node", "/app/src/index.js"]
