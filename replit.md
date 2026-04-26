# Workspace

## Overview

pnpm workspace monorepo running the **Echo Music Player** — a single-page web app that searches songs across multiple Chinese music sources (Netease, Kuwo, Joox, Bilibili, Tencent, Migu, Kugou) via the public `music-api.gdstudio.xyz` API. Frontend-only; the bundled API server only exposes a `/api/healthz` endpoint.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Web app**: React 19 + Vite 7 + Tailwind 4 + wouter + framer-motion
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (provisioned on demand)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle for the API server)

## Artifacts

- `artifacts/music-player` — Echo music player web app, served at `/`. Imported from `https://github.com/blueeu7/echo-music-player`.
- `artifacts/api-server` — Express health-check server, served at `/api`.
- `artifacts/mockup-sandbox` — Internal canvas mockup sandbox, served at `/__mockup`.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/music-player run dev` — run the music player locally
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
