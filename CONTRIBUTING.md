# Contributing to UnClick

Thank you for your interest in contributing to UnClick! We welcome contributions from both human developers and AI coding agents.

This document provides essential guidelines to help you understand our project structure, local setup, testing conventions, and pull request rules. Please read through it before opening an issue or submitting a pull request.

## Repository Structure

UnClick is a monorepo managed with npm workspaces. The codebase is primarily organized into apps and packages. Here are the key directories you should know about:

- `packages/mcp-server/` - The main npm package (`@unclick/mcp-server`) published to the registry.
- `packages/mcp-server/src/memory/` - The built-in memory module featuring our 6-layer architecture.
- `src/` - The React website frontend, built with Vite and TypeScript.
- `api/` - Vercel serverless functions acting as our REST API endpoints.
- `apps/` and `packages/` - Standard workspace directories containing various internal dependencies and tools.

For specialized instructions guiding AI coding agents, you must read [AGENTS.md](./AGENTS.md) carefully. For general Claude desktop configuration instructions, check [CLAUDE.md](./CLAUDE.md).

## Local Setup

We use npm for package management and test execution. Please make sure you have Node.js and npm installed on your system before proceeding.

To set up the project locally, please follow these steps:

1. Clone the repository to your local machine:
   ```bash
   git clone https://github.com/unclick/unclick.git
   cd unclick
   ```

2. Install dependencies using npm:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Locate the `.env.local.example` file in the repository root. Copy it to a new file named `.env.local` and fill in the necessary API keys and configuration values required for local development.

## Testing Conventions

Our testing framework of choice is Vitest, and it is configured with a `jsdom` environment. Test files should follow the standard pattern of `src/**/*.{test,spec}.{ts,tsx}`.

To run the full test suite, always use the following command:
```bash
npm test
```

For workspace specific testing, you can run tests with workspace commands like:
```bash
npm run --workspace=@unclick/mcp-server test
```

When writing tests that interact with browser storage, you may need to mock `localStorage`. To do this in our testing environment, assign the mock implementation directly to `global.localStorage`.

## Pull Request Style and Rules

When you are ready to open a Pull Request, please strictly adhere to the following stylistic and procedural rules:

- **Plain English:** Write your PR description, documentation, and code comments in clear, straightforward English. It should be idiot-proof. Avoid jargon and keep sentences short and easy to understand.
- **No Em Dashes:** Do not use em dashes anywhere in your code, content, or PR descriptions. Use a regular dash, use a comma, or restructure the sentence entirely to avoid needing one.
- **AI-Coauthored PRs:** If an AI coding agent authored or coauthored the pull request, all the strict rules defined in `AGENTS.md` apply. This includes mandatory proof of delivery, strict scope discipline, and a strict prohibition on autonomous out-of-scope cleanups. Review the "Operating rules for cloud-async coding agents" section in `AGENTS.md` before starting any work.
- **No Self-Merging:** All PRs require human review before they can be merged. Do not merge your own PR, even if you have the permissions to do so.

## Adding a New Tool

If your contribution involves adding a new tool to the UnClick catalog, follow these three required steps:

1. Create a new handler in the `api/` directory (e.g., `api/my-new-tool.ts`) containing the Vercel serverless function and endpoint logic.
2. Wire up the new tool in `packages/mcp-server/src/tool-wiring.ts`. You will need to add the tool name, a description, the correct category, and the endpoint mapping.
3. Add a visual tile for the new tool in the website grid located at `src/pages/tools/Tools.tsx`.

## Where to File Issues

If you encounter a bug, have a feature request, or want to suggest an improvement, please file an issue directly on our GitHub repository.

When filing an issue, we ask that you include the following information to help us address it quickly:

- A clear, descriptive title summarizing the problem or request.
- Step-by-step instructions to reproduce the issue (if it is a bug).
- A description of the expected behavior versus the actual behavior you observed.
- Relevant details about your environment, such as your operating system, Node version, and npm version.

We appreciate all contributions that help improve UnClick. Thank you for reading and for following our guidelines!
