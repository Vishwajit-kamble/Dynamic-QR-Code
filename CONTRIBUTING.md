# Contributing to QR Studio

Thank you for contributing to **QR Studio**. Follow the guidelines below to keep changes clean, verified, and consistent with the codebase.

## Local Development

```bash
bun install
bun run dev
```

By default, local development persists workspace data to `.data/qr-workspace.json` so no external database is required to run or test changes.

## Quality Checks

Run the full verification suite before committing:

```bash
bun run test
bun run lint
bun run format
```

- **Tests**: Unit and component tests live under `src/test/` and run with Vitest (`jsdom`).
- **Formatting**: Prettier enforces double quotes, trailing commas, semicolons, and a 100-character print width (`.prettierrc`).
- **Routing**: `src/routeTree.gen.ts` is generated automatically by TanStack Router — avoid editing it manually.
