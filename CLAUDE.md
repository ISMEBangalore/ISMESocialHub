# ISME Social Hub — Project Notes

A community platform for ISME Bangalore (a B-school): clubs/events/houses,
a member feed, a public submission→review pipeline, plus two AI-driven
broadcast features (Newsletter and Festivities). This file exists so
different working sessions on this app share one picture of it instead of
drifting into conflicting assumptions.

## Stack & architecture

- **Backend**: FastAPI + Motor (async MongoDB driver), single `backend/server.py`
  plus two feature modules: `backend/newsletter_agents.py`,
  `backend/festival_agents.py`. Auth is JWT (PyJWT) + bcrypt, roles are
  `member` / `co_admin` / `admin` (`ADMIN_ROLES` in `frontend/src/lib/roles.js`).
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
- **Repo**: `ISMEBangalore/ISMESocialHub` on GitHub. Working branch used for
  AI-assisted feature work: `claude/isme-ai-newsletter-pipeline-igw4pt`
  (rebase onto `main` before new work if that branch's last PR already
  merged — its history ends up fully contained in `main`).

## Core community platform (pre-existing, not AI-driven)

Routes live directly on `backend/server.py`; pages in `frontend/src/pages/`.

- Auth: `/auth/register`, `/auth/login`, `/auth/me`, forgot/reset password
  (via Resend email if `RESEND_API_KEY` set).
- Clubs/events/houses: one `clubs` collection with a `type` field
  (`club`/`event`/`house`), CRUD under `/clubs`; frontend `Clubs.jsx` reused
  for all three via the `type` prop, routed at `/clubs`, `/events`, `/houses`.
- Calendar: `/calendar` CRUD — general SDC calendar (separate from the
  Festivities feature below). `CalendarPage.jsx`.
- Public submissions → review queue → converted to posts: `PublicSubmit.jsx`
  (no auth) → `/submissions`, admin reviews at `/admin/submissions` and
  `ReviewQueue.jsx`, approved ones convert into `posts` (the member `Feed.jsx`).
- Admin dashboard: `/admin/dashboard`, `Dashboard.jsx`.

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
Only admins can trigger/review/send a greeting (every `/admin/festivals*`
route requires `Depends(require_admin)`).

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
