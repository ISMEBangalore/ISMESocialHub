# ISME Social Hub — Project Notes

A community platform for ISME Bangalore (a B-school): clubs/events/houses,
a member feed, a public submission→review pipeline, an admin dashboard, plus
two AI-driven broadcast features (Newsletter and Festivities). This file
merges the notes from two parallel working sessions — one on `main` building
out the core community platform, one on `claude/isme-ai-newsletter-pipeline-igw4pt`
building the AI features — so any future session shares one picture instead
of drifting into conflicting assumptions. It supersedes both prior partial
notes (the newsletter branch had its own `CLAUDE.md` commit that was never
merged into `main`; this file replaces it).

## Stack & architecture

- **Backend**: FastAPI + Motor (async MongoDB driver), single `backend/server.py`
  plus two feature modules: `backend/newsletter_agents.py`,
  `backend/festival_agents.py`. Auth is JWT (PyJWT) + bcrypt, roles are
  `member` / `co_admin` / `admin` (`ADMIN_ROLES = ("admin", "co_admin")` in
  `backend/server.py`, mirrored by `frontend/src/lib/roles.js`'s
  `isAdminRole()`/`roleLabel()` — `co_admin` has identical permissions to
  `admin`, it's a labeling distinction only, not a reduced-rights role).
- **Frontend**: Create React App (craco) + Tailwind + shadcn/radix UI, a
  brutalist black-border design system (`border-2 border-black`,
  `brutal-shadow` utility classes throughout). React Router, axios wrapper
  in `frontend/src/lib/api.js`.
- **Deploy**: Railway, **two separate services** (`backend`, `frontend`),
  each its own isolated build/container from its own repo subfolder.
  **A backend module can never reach `../frontend/...` at runtime** — any
  asset the backend needs (fonts, the ISME logo) must be bundled inside
  `backend/assets/`. This bit us once already (a hardcoded
  `../frontend/public/isme-mark.png` path crashed in production but worked
  locally) — don't reintroduce cross-service paths.
  - Project id `a50289b7-1b56-4b0d-a662-e9f59409c7d0`, env (production) id
    `79d4bd39-1510-430e-94a8-c850f440ada0`, `backend` service id
    `6eb62266-69fc-4de5-8e13-e2bf49d53b6e`, `frontend` service id
    `b8bc007e-b0af-4a62-b143-64f53956f30a`.
  - Frontend start command is `node server.js` — a ~50-line dependency-free
    static file server (`frontend/server.js`) that serves `build/` and falls
    back to `index.html` for unmatched routes (SPA routing). **Do not
    replace this with `npx -y serve -s build`** — see the outage writeup
    under Known gotchas below for why that's a landmine, not a convenience.
  - Railway's build effectively runs `yarn install --frozen-lockfile`
    regardless of what `buildCommand` says — any `package.json` dependency
    change MUST ship with a regenerated `yarn.lock` in the same commit, or
    the build fails outright with "lockfile needs to be updated".
- **Database**: MongoDB Atlas, cluster name `ISME`, project id
  `6a7d9b2755e1e8b7ca1a429c`, database `isme_social_hub`. Managed in most
  sessions via the MongoDB Atlas MCP server rather than the app's own API
  (useful when the sandbox can't reach the deployed backend directly).
  **That MCP server is flaky under load**: `insert-many`/`delete-many`/
  `aggregate` calls have reported client-side "session expired" or
  "timed out after 60s" errors while the operation actually *succeeded*
  server-side — and destructive calls (`delete-many`, `$out` aggregations)
  can also genuinely hang against a stuck permission gate. **Always verify
  with a `count`/`find` after any write before assuming success or retrying**;
  a retry-after-timeout has caused at least one accidental double-insert
  (72 calendar entries inserted twice, silently, because the first call's
  reported failure was a false negative) that had to be cleaned up later.
- **Repo**: `ISMEBangalore/ISMESocialHub` on GitHub, `main` is authoritative
  and already contains everything described in this file (the AI-newsletter
  branch's feature work was merged via PR #15 and earlier PRs #13/#14).

## Core community platform

Routes live directly on `backend/server.py`; pages in `frontend/src/pages/`.

- Auth: `/auth/register`, `/auth/login`, `/auth/me`, forgot/reset password
  (via Resend email if `RESEND_API_KEY` set). Seeding: `SEED_ADMIN_EMAILS`
  and `SEED_COADMIN_EMAILS` (comma-separated) create unclaimed accounts with
  `role: "admin"` / `role: "co_admin"` on startup; the first person to
  register with that email claims it and sets a password. Don't add a
  personal/test email to either seed list and forget to remove it — that's
  exactly how a personal Gmail account once ended up with admin rights.
- Clubs/events/houses: one `clubs` collection with a `type` field
  (`club`/`event`/`house`), CRUD under `/clubs`; frontend `Clubs.jsx` reused
  for all three via the `type` prop, routed at `/clubs`, `/events`, `/houses`
  (all public, no auth required to view). Current roster: 8 UG clubs, 4 PG
  clubs (suffixed `(PG)` — e.g. `CSR (PG)` — since several PG clubs share a
  name with a UG club but have different faculty in-charge), 15 events, and
  4 houses (Voyagers, Discoverers, Pioneers, Explorers — inaugurated 21 Aug
  2026 at Navatara Auditorium). `ClubIn` also carries `faculty_incharge`,
  `student_coordinator`, `social_media_coordinator`, and `brand_color`.
- Calendar: `/calendar` CRUD — the general SDC academic calendar (separate
  from the Festivities feature below), 72 entries for 2026-27 tagged by
  audience (`ALL`/`UG24`/`UG25`/`UG26`/`PG25`/`PG26`/`HOSTEL`/`FACULTY`).
  `CalendarPage.jsx`, public view, admin/co-admin can add/edit/delete.
- Public submissions → review queue → converted to posts: `PublicSubmit.jsx`
  (no auth) → `/submissions`, admin reviews at `/admin/submissions` and
  `ReviewQueue.jsx`, approved ones convert into `posts` (the member `Feed.jsx`).
- Admin dashboard: `/admin/dashboard` (API) / `/dashboard` (page),
  `Dashboard.jsx`. **Open to every logged-in user, not just admins** — it's
  a read-only view (a top overview row of Houses/Clubs/SDC Events/Posts
  Published counts, plus submission/post stats and charts below); the
  underlying admin actions it links to (Review Queue) stay admin/co-admin
  gated via `require_admin`, so visibility doesn't imply capability.

## Feature: Newsletter Pipeline (AI-driven, admin-gated)

Three chained Claude agents in `backend/newsletter_agents.py`, orchestrated
by `run_newsletter_pipeline()` in `server.py`:

1. **Research** — Claude with the `web_search_20260209` server tool, finds
   8-12 recent items relevant to B-school/MBA/PGDM audiences.
2. **Content** — turns research into a newsletter draft: subject line, a
   lead "ISME's Analysis" synthesis section citing across *all* research
   items, per-item blurbs, a skill takeaway, homepage highlights. Every
   section is explicitly framed for MBA/PGDM aspirant relevance (hiring
   trends, B-school moves, skills to focus on).
3. **Evaluation** — fact-checks the draft against the research input,
   flags overstated claims, gives a risk rating and recommendation.

Then: human approval gate (admin reviews/edits at `/admin/newsletter`,
`NewsletterPipeline.jsx`) → **Approve & Send** pushes an HTML email blast
(via Resend) and a WhatsApp text broadcast (Meta Graph API). Public view of
a sent issue: `/newsletter/:runId`, `NewsletterView.jsx`.

Structured outputs use `output_config={"effort": "high", "format":
{"type": "json_schema", ...}}` — **array `minItems`/`maxItems` in these
schemas only accept 0 or 1**, anything else 400s; rely on prompt wording
for count instead.

## Feature: Festivities (AI-driven, admin-gated)

`backend/festival_agents.py` + the `/festivals*` and `/admin/festivals*`
routes in `server.py`. Public calendar page at `/festivities`
(`Festivities.jsx`) lists every Indian festival in `FESTIVALS_2026`
(name/date/category/blurb/motif/palette) — visible to everyone, no auth.
Only admins/co-admins can trigger/review/send a greeting (every
`/admin/festivals*` route requires `Depends(require_admin)`).

Per festival, "Generate greeting" kicks off:

1. **Text** (Claude, structured output): a WhatsApp broadcast message plus
   a short image `tagline` (a subtle one-liner distinct from the headline).
2. **Image background** (optional, `OPENAI_API_KEY`): calls OpenAI's image
   API, trying `gpt-image-2` (current flagship) then falling back to
   `gpt-image-1` if unavailable — **never `dall-e-2`/`dall-e-3`, OpenAI shut
   those down 2026-05-12**. Fails soft to a local deterministic Pillow
   gradient/motif background on any error (no key, quota, content policy,
   network). Each motif has several scene/composition variants so festivals
   sharing a motif (e.g. "bloom", used by 16 of 38 festivals) don't render
   near-identical art; the prompt embeds that festival's own curated colour
   palette.
3. **Compositing** (always local, Pillow, `render_greeting_image()`): the
   ISME logo goes in whichever top corner of the art is visually calmer
   (sampled via pixel variance), the message card sits low with a muted
   eyebrow tagline + headline (alternates Poppins ExtraBold / Playfair
   Display Bold per festival) + subline, with a faint per-festival card
   tint. Deterministic per festival via a name-seeded RNG.

Then the same human-approval pattern as the newsletter: admin reviews/edits
(headline, tagline, message) → **Approve & Send** posts a WhatsApp image
broadcast (Meta Graph API `image` message type, image served from a public
unauthenticated URL since Meta fetches it directly) → **Reject**.

Fonts are bundled at `backend/assets/fonts/` (Poppins family + a Playfair
Display variable font, set to its Bold instance via
`set_variation_by_name("Bold")`), logo at
`backend/assets/images/isme-logo.png` — both there specifically because of
the Railway cross-service restriction above.

## Environment variables (backend service)

| Var | Used for |
|---|---|
| `MONGO_URL`, `DB_NAME` | Mongo connection |
| `JWT_SECRET`, `JWT_ALGORITHM` | Auth tokens |
| `SEED_ADMIN_EMAILS`, `SEED_COADMIN_EMAILS` | Bootstrap admin/co-admin accounts on startup |
| `CORS_ORIGINS` | CORS allowlist |
| `FRONTEND_URL`, `BACKEND_PUBLIC_URL` | Links in emails; public image URLs for WhatsApp to fetch |
| `RESEND_API_KEY`, `SENDER_EMAIL` | Email (password reset, newsletter blast) — optional, no-ops if unset |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID` | Claude agents (newsletter + festival text); key must be **workspace-scoped**, not org-level |
| `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BROADCAST_LIST` | Meta WhatsApp Cloud API — optional, no-ops if unset |
| `OPENAI_API_KEY` | Festival AI-illustrated backgrounds — optional, falls back to local rendering if unset |

All of the above are set as **Railway service variables**, never committed
to the repo or hardcoded — treat any API key as a secret to be stored there,
not in code, .env files that get committed, or chat/commit text.

## Known gotchas worth not re-learning

- **The `serve` / `path-to-regexp` production outage.** The frontend used
  to start via `npx -y serve -s build -l $PORT`. This crash-looped in
  production on *every single request* with `TypeError: pathToRegExp.compile
  is not a function` — `serve-handler`'s SPA-rewrite code needs a modern
  `path-to-regexp` (with `.compile()`), but this project's `resolutions`
  block globally pins `path-to-regexp` to `0.1.13` (an old, incompatible
  API — likely kept for a CVE fix, so don't just delete that pin). Yarn's
  resolutions mechanism would not honor a scoped exception for
  `serve-handler` specifically (kept collapsing back to `0.1.13` even with
  `"**/serve-handler/path-to-regexp": "2.2.1"` in `resolutions`). The fix
  was to drop `serve` entirely in favor of `frontend/server.js`, a small
  dependency-free static server with the same behavior (serve `build/`,
  fall back to `index.html`). **If a future change reintroduces `serve` (or
  any static-file server depending on `path-to-regexp` >= 1.x) while that
  `0.1.13` resolution pin still exists, expect the exact same outage.**
- Setting only `overflow-x-hidden` (no explicit `overflow-y`) makes the
  browser compute `overflow-y: auto`, silently creating a new scroll
  container that breaks `position: sticky` relative to the viewport. Use
  `overflow-x-clip` instead.
- FastAPI's sync `TestClient` doesn't reliably surface a fire-and-forget
  `asyncio.create_task` background job's completion across separate
  `client.get()` polls in tests. Use `httpx.AsyncClient` +
  `httpx.ASGITransport(app=...)` inside one `asyncio.run()` instead.
- Sandbox web egress is allowlisted — most single-vendor doc/blog domains
  (including `openai.com`, `developers.openai.com`) are blocked; WebSearch
  still works, WebFetch is limited to a small allowlist
  (`raw.githubusercontent.com` reliably works for pulling font/asset files).
  Similarly, a sandbox's own outbound network policy can block it from
  reaching the deployed Railway URL directly even while real users reach it
  fine — a failed `curl` to the production URL from inside a session is not
  proof the site is down; check Railway's own deploy/http logs instead.
- axe-core contrast failures are worth getting the *exact* `contrastData`
  (fgColor/bgColor/contrastRatio) from the violation rather than guessing
  from visual inspection — the obvious-looking culprit (e.g. a colored
  pill) is sometimes fine, while a muted heading color is what's actually
  failing.
