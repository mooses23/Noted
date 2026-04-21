# LayerStack

LayerStack is a collaborative, human-made music platform. The community starts
with a "seed" song — a base mix plus a click track and a few stems — and then
contributes new instrument layers ("commits") to it, one open round at a time.
Each round targets a specific instrument (bass, drums, etc.). Listeners vote
on submitted commits, and admins merge the best one into the next version of
the song. Strictly human-made: no AI-generated audio.

This repo is a pnpm monorepo containing the web app, the API, the shared
libraries that connect them, the seed/demo content, and a UI mockup sandbox.

## Artifacts

- **`artifacts/layerstack`** — the LayerStack web app (React + Vite + Tailwind).
  This is the user-facing site: songs, commits feed, voting, profile, admin.
- **`artifacts/api-server`** — the Express 5 + TypeScript API. Talks to
  PostgreSQL through Drizzle, validates with Zod, and authenticates with Clerk.
- **`artifacts/mockup-sandbox`** — an isolated Vite preview server for
  prototyping individual UI components and showing them on the workspace
  canvas. Not part of the shipped product.

## Features shipped so far

- **Seed song + versioned releases.** Every song has an ordered list of
  versions. v1 is the original seed mix; later versions are produced by
  merging community commits.
- **Stems and click track.** Each song exposes its stems and a click track
  for download so contributors can record against them.
- **Rounds.** A song progresses one round at a time. A round opens against a
  specific base version, targets one instrument, has open/closed/merged
  states, and pins the song version a commit is layered against (so the
  "what was the song when I recorded?" question has a deterministic answer).
- **Commits.** Contributors submit a stem with a title, note, and the
  required human-made / rights-grant attestations. Statuses: pending,
  rejected, merged.
- **Three-player A/B/C commit cards.** Every commit card on the feed, home,
  song, and admin pages shows three independent audio players: the
  contributor's solo stem, the same stem layered over the round's base
  version, and that base version on its own. Only one plays at a time per
  card. Layered preview audio is currently seeded; an automatic mixing
  pipeline is tracked as a separate task.
- **Voting.** Logged-in users can upvote commits.
- **Public song page.** Plays the latest version, lists previous versions,
  shows the open round and its commits with the comparator, and shows the
  song's per-track music credits.
- **Per-song third-party music credits.** Each song carries an ordered list
  of attribution rows (title, author, source URL, license name + URL,
  optional role tag). They render on the song page and on the global
  Licenses page.
- **Global `/licenses` page.** Pulls every song's credits from the database
  (grouped by song, with a link back to each song page) and also lists
  static site-wide assets like icons and fonts.
- **Admin credits management.** Admins can add, inline-edit, reorder
  (up/down), and delete a song's credits from the admin song page. Every
  mutation is recorded in the `admin_actions` audit log.
- **Other admin tools.** Admin dashboard, song list, and song detail page
  with tabs for versions, commits review, and music credits.
- **Authentication.** Clerk handles sign-in / sign-up, with an admin gate
  driven off the user's profile. The API uses Clerk's Express middleware
  and a proxy route so the browser can talk to Clerk through the same
  origin as the app.
- **Object storage.** Audio files (versions, stems, click tracks, commit
  stems, layered previews) and song artwork live in object storage. The
  frontend renders them via a small `storageUrl()` / `<CoverImage />`
  helper so the API can keep returning raw `/objects/...` paths.
- **Demo seed.** `scripts/src/seed-layerstack.ts` populates a complete
  example: profiles (including an admin), the demo song "The Long Room"
  with two versions, stems and click track, two rounds, several commits,
  votes, and the song's third-party credits — all wired to real CC BY 3.0
  audio synced into object storage.

## Tech stack

- **Monorepo:** pnpm workspaces, TypeScript 5.9
- **Frontend:** React 19 + Vite 7, Tailwind CSS v4, wouter, TanStack Query,
  Framer Motion, lucide-react
- **Backend:** Node.js 24, Express 5, pino logging
- **Database:** PostgreSQL + Drizzle ORM (schemas in `lib/db`)
- **Validation:** Zod (`zod/v4`) and `drizzle-zod`
- **API contract:** OpenAPI spec in `lib/api-spec`, with Orval generating
  typed React Query hooks (`lib/api-client-react`) and Zod request/response
  schemas (`lib/api-zod`)
- **Auth:** Clerk (Express middleware on the API, React provider on the web)
- **Storage:** object storage accessed through `lib/object-storage-web`

## Repo layout

```
artifacts/
  layerstack/         # Web app (React + Vite)
  api-server/         # Express 5 API
  mockup-sandbox/     # UI prototyping sandbox (not shipped)
lib/
  api-spec/           # OpenAPI source of truth + codegen
  api-client-react/   # Generated TanStack Query hooks
  api-zod/            # Generated Zod schemas
  db/                 # Drizzle schema, client, migrations
  object-storage-web/ # Object storage helpers
  seed-content/       # Static demo content + asset registry
scripts/
  src/
    seed-layerstack.ts  # End-to-end demo seeder
    lib/                # Seed audio sync + attribution notes
```

## Pages (web app routes)

- `/` — home
- `/songs`, `/songs/:slug`, `/songs/:slug/versions`, `/songs/:slug/stems`,
  `/songs/:slug/submit`
- `/commits`, `/commits/:commitId`
- `/profile`
- `/admin`, `/admin/songs`, `/admin/songs/:songId`
- `/credits` — community credits wall
- `/licenses` — third-party music credits + site-wide assets
- `/manifesto`, `/rules`, `/rights`, `/privacy`, `/terms`
- `/sign-in`, `/sign-up`

## API surface

All routes are mounted under `/api` (see
`artifacts/api-server/src/routes/index.ts`):

- `health` — service health probe
- `storage` — object storage upload helpers
- `me` — the current user's profile
- `songs` — public song listing + song-by-slug detail
- `rounds` — round listing and detail
- `commits` — commit listing, detail, and submission
- `votes` — upvote / clear-vote on commits
- `versions` — song version detail
- `credits` — public per-song credits + the global `/credits` listing
- `stats` — site-wide stats used on the home page
- `admin/*` — admin-only mutations (songs, versions, commits review,
  credits CRUD + reorder), gated by a `requireAdmin` middleware and
  audited via `admin_actions`

## Work in flight

These are queued or in-progress and not yet shipped:

- Generate real layered preview mixes when commits are submitted (so the
  A/B/C comparator's middle player is mixed automatically instead of
  seeded).
- Let admins pick which song version a round is layered against.
- Set up Supabase + Vercel production deployment.

## Run it locally

The full command reference lives in [`replit.md`](./replit.md). The most
common ones:

```bash
pnpm install
pnpm run typecheck                                # full typecheck
pnpm --filter @workspace/db run push              # apply schema (dev)
pnpm --filter @workspace/api-server run dev       # API server
pnpm --filter @workspace/layerstack run dev       # web app
pnpm --filter @workspace/api-spec run codegen     # regenerate API hooks + Zod
pnpm --filter @workspace/scripts exec tsx \
  ./src/seed-layerstack.ts                        # populate the demo data
```
