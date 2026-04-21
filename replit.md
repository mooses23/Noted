# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Email digest

The unread-notifications digest job lives at `POST /internal/digest/run`.
- Auth: requires `x-cron-secret` header matching `CRON_SECRET` env var.
- Sender: `lib/email.ts` posts to Resend's REST API when `RESEND_API_KEY` is set; otherwise it logs the email and still advances the watermark so dev runs converge.
- Per-user opt-out lives on `profiles.unread_digest_opt_out`; deduping uses `profiles.last_digest_emailed_at`.
- The Resend Replit connector was offered to the user and dismissed — set `RESEND_API_KEY` and `DIGEST_FROM_EMAIL` directly as secrets when ready to go live.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Product: Noted

The frontend artifact is **Noted** — a strictly human-made collaborative music platform. Songs evolve in two lifecycle phases:

1. **Structure phase** — drums, bass, harmony, melody. One winner per round (`mergeBehavior: "single"`).
2. **Accents phase** — signature moments (claps, one-shots, ad-libs). Multiple winners may stack into the next mix (`mergeBehavior: "multi"`).

Phase is enforced server-side: structure-phase songs reject accent rounds and vice versa. Curators advance the song between phases via `POST /admin/songs/:songId/advance-phase`.

### First-class domain fields

- `songs.phase` — `structure | accents`
- `rounds.kind` — `structure | accent`
- `rounds.mergeBehavior` — `single | multi`
- `commits.kind` — inherited from the round at submission time
- `commit_drafts` — Notes a user finished while no round was open. Tied to a song + contributor + chosen instrument label. Visible from the user's profile and promoted to a real commit via `POST /api/commits/drafts/:id/submit` once a matching round opens. Storage uploads with `purpose=commit-audio` accept missing `roundId` and land under `songs/{songId}/drafts/commits`.

### Demo seed (`pnpm --filter @workspace/scripts run seed:layerstack`)

Two songs are seeded so both phases are visible out of the box:

- **The Long Room** (`/songs/the-long-room`) — phase `structure`, with one merged bass round and an open drums round.
- **Ember & Iron** (`/songs/ember-and-iron`) — phase `accents`, with merged bass + drums history and an open accent round for claps & one-shots.

### Branding rule

The product name is "Noted". The previous name "LayerStack" only persists as the directory name `artifacts/layerstack`. Do **not** introduce AI-generated music or AI-vibe copy anywhere in the product.
