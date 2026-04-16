# Dockerfile for @unclick/mcp-server
# Used by Glama to build, test, and score the MCP server.
# Does not need to be used in production; serverless /api/mcp is the
# primary runtime path.

# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy monorepo root files needed for workspace install
COPY package.json package-lock.json* ./
COPY packages/mcp-server/package.json ./packages/mcp-server/

# Install all dependencies (including dev) for the mcp-server workspace
RUN npm install --workspace=@unclick/mcp-server --include-workspace-root

# Copy source for the mcp-server package
COPY packages/mcp-server ./packages/mcp-server

# Build TypeScript
RUN npm run build --workspace=@unclick/mcp-server

# Prune dev dependencies for the runtime copy
RUN npm prune --production --workspace=@unclick/mcp-server

# ---- Runtime stage ----
FROM node:20-alpine

# Create a non-root user for the MCP server process
RUN addgroup -S unclick && adduser -S unclick -G unclick

WORKDIR /app

# Copy built package and pruned dependencies
COPY --from=builder --chown=unclick:unclick /app/packages/mcp-server/dist ./dist
COPY --from=builder --chown=unclick:unclick /app/packages/mcp-server/package.json ./
COPY --from=builder --chown=unclick:unclick /app/packages/mcp-server/node_modules ./node_modules
COPY --from=builder --chown=unclick:unclick /app/packages/mcp-server/README.md ./
COPY --from=builder --chown=unclick:unclick /app/packages/mcp-server/server.json ./

# Minimal environment
ENV NODE_ENV=production

USER unclick

# Stdio MCP server entrypoint
ENTRYPOINT ["node", "dist/index.js"]
