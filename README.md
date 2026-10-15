# Kept

**One system for the work, the money and the proof.**

Kept is a multi-tenant operations platform (ERP) with a built-in public website for every organization on it. An organization picks its industry, Kept installs the apps that industry needs, and the organization gets two front doors on one account:

- a **public website** on its own domain, in its own brand, whose figures, stock and availability come straight from its records, and
- a **private staff dashboard**, reached from the website's *Staff login*, in the same brand, with a home screen that depends on the person's role.

Built by Sparks as an individual capstone project at Moringa School (Nairobi, 2026). The primary case study is **Timiza Youth Initiative**, a community-based organization in Kilifi County; four further case studies show the same platform serving a retail chain, a creative studio, a hotel group and a second community organization.

---

## Contents

1. [Quick start](#quick-start)
2. [Live preview](#live-preview)
3. [Demo accounts](#demo-accounts)
4. [What is in the box](#what-is-in-the-box)
5. [Architecture](#architecture)
6. [Repository layout](#repository-layout)
7. [Case studies](#case-studies)
8. [Roles](#roles)
9. [Tazama: field data and live tracking](#tazama-field-data-and-live-tracking)
10. [Design system](#design-system)
11. [Testing](#testing)
12. [Deployment](#deployment)
13. [Configuration](#configuration)
14. [Known limitations](#known-limitations)
15. [Further documentation](#further-documentation)

---

## Quick start

Requirements: Python 3.12, Node 20 or newer, PostgreSQL 15 or newer.

```bash
# 1. Database
createdb kept            # or: docker run -e POSTGRES_PASSWORD=kept -p 5432:5432 postgres:16

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # edit DATABASE_URL and JWT_SECRET
alembic upgrade head     # 10 migrations
python seed.py           # five demo organizations, all with data
KEPT_TODAY=2026-10-13 uvicorn app.main:app --reload    # http://localhost:8000/docs

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev              # http://localhost:5173
```

`KEPT_TODAY` freezes "today" at 13 October 2026 so the demo alerts, paces and calendars stay meaningful. Leave it unset in production.

To build the single-file offline preview (the whole app plus an in-browser copy of the API):

```bash
cd frontend && npm run build:preview      # writes kept-live-preview.html
```

---

## Live preview

`kept-live-preview.html` is a self-contained build that runs entirely in the browser. A JavaScript port of the API (`frontend/src/demo/engine.js`) answers every request and keeps data in `localStorage`, so the preview needs no server. Use **Reset** in the dashboard's top bar to restore the starting data.

| Start here | What it is |
|---|---|
| `/` | Kept's own website: Home, Product, Solutions, Customers, Pricing, Contact |
| `/site/timiza` | Timiza Youth Initiative's public website |
| `/site/hatua`, `/site/pwani`, `/site/mwangaza`, `/site/tumaini` | The other four organizations' websites |
| `/site/<slug>/login` | That organization's staff sign-in |
| `/login`, `/register` | Kept's platform sign-in and the three-step sign-up |
| `/app` | The dashboard (after signing in) |
| `/f/<form-id>` | A public Tazama form, for field teams without accounts |

In production each organization points its own domain (for example `timiza.or.ke`) at Kept, or uses `<slug>.kept.africa`. A single-tenant deployment can set `VITE_SITE_SLUG=timiza` so that organization's website is the home page.

---

## Demo accounts

Every password is `kept-demo-2026`. On each organization's staff login page the preview also shows one-click demo buttons.

| Organization | Name | Email | Role |
|---|---|---|---|
| Timiza Youth Initiative | Amani Charo | admin@timiza.example | Administrator |
| | Zawadi Kahindi | zawadi@timiza.example | Manager |
| | Baraka Katana, Neema Kazungu, Juma Mwangome | baraka@ / neema@ / juma@timiza.example | Field team |
| | Partner Observer | viewer@timiza.example | Board and partners (read only) |
| Hatua Apparel | Wanjiru Mbugua | wanjiru@hatua.example | Administrator |
| | Otis Kamau | otis@hatua.example | Manager |
| | Achola Were | achola@hatua.example | Field team (store and dispatch) |
| Pwani Hotels & Safaris | Rehema Salim | rehema@pwani.example | Administrator |
| | Omar Abdalla | omar@pwani.example | Manager |
| | Neema Charo | neema@pwani.example | Field team (reservations) |
| Mwangaza Creative Studio | Wairimu Kamau | wairimu@mwangaza.example | Administrator |
| | Otieno Were | otieno@mwangaza.example | Field team |
| Tumaini Community Network | Grace Nduta | admin@tumaini.example | Administrator |
| | Achieng Otieno | achieng@tumaini.example | Manager |
| | Kevin Kiprop, Faith Wanjiru, Brian Mutua | kevin@ / faith@ / brian@tumaini.example | Field team |
| | Board Observer | viewer@tumaini.example | Read only |

---

## What is in the box

- **20 installable apps** built from **40 spec-driven modules** (one JSON file describes fields, validation, workflow states, permissions and list views; the API, database tables and screens are generated from it).
- **6 industries**, each installing a different set of apps: community organization, retail chain, creative studio, hotels/dining/tours, school, clinic.
- **Programmes and M&E**: commitments with targets and deadlines, required evidence, daily pace, a frozen-snapshot report generator.
- **Alerts engine**: 11 rules (overdue, due soon, behind pace, missing proof, blocked, over budget, approval waiting, expiring document, low stock, report due, overdue invoice) with ownership, snooze, reassign and resolution notes.
- **Tazama**: KoboToolbox-style field data collection with GPS, photos, skip logic, offline queueing, a live tracker and Google Sheets import and sync.
- **Public websites** with live impact figures, donations (M-Pesa and card, sandbox by default), volunteer and contact forms, an online shop with order tracking, room, table and tour booking, and portfolios.
- **Role-based dashboards** with a sidebar, a top bar (search, notifications, account menu), light and dark themes, and each organization's own branding.
- **77 API endpoints**, 58 backend tests, 48 browser checks, Bandit, pip-audit and npm audit all clean.

---

## Architecture

| Layer | Technology |
|---|---|
| API | FastAPI 0.143, Pydantic 2, SQLAlchemy 2.1, Alembic |
| Database | PostgreSQL (JSONB for flexible fields) |
| Auth | JWT (HS256, 8-hour expiry, token-version revocation), bcrypt |
| Frontend | React 18.3, React Router 7, Vite 6, plain CSS design tokens, no UI library |
| Charts | Hand-written SVG components (`components/charts.jsx`) |
| Payments | Safaricom Daraja STK push (behind `PAYMENTS_MODE=mpesa`), sandbox simulator by default |
| Preview | The same React app built with `VITE_DEMO=1`, talking to `demo/engine.js` instead of HTTP |
| Hosting plan | Render (API and PostgreSQL), Vercel (frontend) |

Key ideas:

- **Multi-tenancy.** Every row carries `organization_id`; every query is scoped to the caller's organization; another organization's ids return 404.
- **Spec-driven modules.** `backend/app/modules.json` defines each module once. `app/erp.py` turns it into tables, validation, CRUD, workflow transitions, CSV export and grouped statistics; `pages/Module.jsx` renders the matching table, board and forms.
- **Apps and industries.** `backend/app/platform.json` lists apps (groups of modules) and which apps each industry installs. The API refuses requests to apps an organization has not installed.
- **One source of seed data.** `backend/seed_data/*.json` feeds both `seed.py` (PostgreSQL) and `frontend/src/demo/seed.js` (preview), so the two always match.

---

## Repository layout

```
kept/
├── backend/
│   ├── app/
│   │   ├── main.py            app, middleware, file serving, error handler
│   │   ├── config.py          settings and production safety checks
│   │   ├── models.py          core tables (organizations, users, projects, flags, forms ...)
│   │   ├── erp.py             spec-driven module engine
│   │   ├── modules.json       40 module definitions
│   │   ├── platform.json      apps, industries, palettes, event form template
│   │   ├── hardening.py       rate limits, password policy, upload checks, security headers
│   │   ├── routers/           auth, org, projects, activities, flags, erp (incl. public site APIs), forms (Tazama), apps
│   │   └── services/          pace, rules (alerts), reports, payments, audit
│   ├── migrations/            10 Alembic migrations
│   ├── seed.py, seed_data/    timiza.json, tenants.json
│   └── tests/                 58 pytest tests
├── frontend/
│   ├── src/
│   │   ├── App.jsx            routes
│   │   ├── components/        Shell (sidebar, top bar), charts, ui, ThemeToggle
│   │   ├── pages/             Landing (Kept website), Overview (role homes), Module, Forms (Tazama),
│   │   │                      PublicSite, CommunitySite (Timiza template), SiteKits (shop, rooms, dining, tours ...),
│   │   │                      Account, Apps, Attention (alerts), Approvals, Finance, Calendar, Projects, Reports ...
│   │   ├── field.js           offline queue, GPS capture, photo downscaling
│   │   ├── styles.css         design tokens and components (light and dark)
│   │   └── demo/              in-browser API engine and seeds for the preview
│   └── vercel.json            rewrites and security headers
├── tests-e2e/                 Playwright suites: core_flows.py, case_studies.py, tazama.py
├── assets/timiza/             Timiza's logo, photos and partner logos
├── kept-live-preview.html     single-file offline build
├── SECURITY.md                threat model and controls
├── AUDIT.md                   audit against the original brief
└── render.yaml                Render blueprint
```

---

## Case studies

| Organization | Industry | Its own tools | Website |
|---|---|---|---|
| Timiza Youth Initiative | Community organization (Kilifi) | Programmes and M&E, Tazama surveys, funding and donations, volunteers, participant registry, governance | Faithful rebuild of timiza.vercel.app plus live impact, programme pages, gallery, donations, volunteer form, map |
| Tumaini Community Network | Community organization (Machakos) | Programmes, participants, finance | Same community template in Tumaini's brand |
| Hatua Apparel | Retail chain, five branches | Branch takings against target, stock transfers, deliveries, rider tracking in Tazama, invoicing | Online shop with live stock, store locator, order tracking |
| Mwangaza Creative Studio | Photography, video, film, social media | Production pipeline, content calendar, studio and gear bookings, invoicing | Portfolio, services, "Book a shoot" brief form |
| Pwani Hotels & Safaris | Hotel, three restaurants, tours | Rooms and bookings, table reservations, tours, guides, invoicing | Availability search, room booking, table reservations, tour booking |

---

## Roles

| Role | Home screen | Can |
|---|---|---|
| Administrator | Manager home plus an Administration card | Everything, plus users and roles, apps, audit log, website |
| Manager | Industry operations home (programmes, branches, rooms or productions) | Plan, approve, build forms, issue reports, resolve alerts |
| Field team (member) | "Your day": own tasks, Tazama forms to collect, own alerts | Record work and evidence, collect data, raise requests |
| Board and partners (viewer) | Read-only overview of results, money and reports | Read and download only |

---

## Tazama: field data and live tracking

Swahili for "observe". Build a form with ten question types (including GPS and photo) and skip logic, then collect in the dashboard or through a public link. Responses made without signal are queued on the phone and sent on reconnect, each with a client id so retries never duplicate. Every form opens on a **Live tracker** that refreshes every five seconds: today, last 7 days, progress to target, responses per day, a collector league table, a map of locations, a breakdown by any choice question, and the latest responses. Existing spreadsheets come in by CSV import, or by connecting a published Google Sheet and pressing Sync (server only).

Timiza uses it for outreach surveys and event attendance; Hatua uses it for rider check-ins with photo proof of delivery.

---

## Design system

Six colour roles, defined as CSS variables in `styles.css`:

| Role | Kept | Derived for each organization | Used for |
|---|---|---|---|
| Night | `#22184F` | mixed from the organization's primary | sidebar, home banner, footer |
| Primary | Violet `#7C5CFF` | the organization's primary | buttons, active states, charts |
| Accent | Tangerine `#FF6B35` | the organization's accent | alert counts, highlights |
| Marigold | `#FFB627` | shared | positive emphasis, chart series |
| Sky | `#3BA7FF` | shared | information, chart series |
| Tint | Lilac | mixed from the primary | page background, soft fills |

Dark mode deepens the same colours into indigo or navy, never black. Kept's own pages always use Kept's palette; each organization's dashboard and website use its own. Timiza's website reproduces timiza.vercel.app: Inter, blue `#2563EB`, red Donate `#EF4444`, dark bar and footer `#020617`.

---

## Testing

```bash
cd backend && pytest -q                     # 58 tests: auth, permissions, isolation, business rules, ERP, apps, Tazama, security
cd frontend && npx vitest run               # unit tests
pip install playwright && playwright install chromium
python tests-e2e/core_flows.py              # 21 flows across the product
python tests-e2e/case_studies.py            # 17 flows across the five organizations and four roles
python tests-e2e/tazama.py                  # 10 flows: live updates, GPS, skip logic, offline, import
```

The Playwright suites run against `kept-live-preview.html` by default; set `KEPT_URL` to test a deployed frontend.

Security scans: `bandit -r backend/app`, `pip-audit -r backend/requirements.txt`, `npm audit` (all clean at the time of writing).

---

## Deployment

**API on Render** (`render.yaml` provisions the service and database):

```
Build:  pip install -r requirements.txt
Start:  alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**Frontend on Vercel**: root `frontend`, build `npm run build`, output `dist`, environment variable `VITE_API_URL=https://<your-render-service>`. `vercel.json` sets the SPA rewrite and security headers (CSP, HSTS, frame denial).

Then set `CORS_ORIGINS` on Render to the Vercel URL and run `python seed.py` once if you want the demo data.

---

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | local PostgreSQL | SQLAlchemy URL (`postgresql+psycopg://...`) |
| `JWT_SECRET` | development value | Must be 32+ random characters in production (the app refuses to start otherwise) |
| `JWT_EXPIRE_MINUTES` | 480 | Session length |
| `ENVIRONMENT` | development | `production` enables the safety checks |
| `CORS_ORIGINS` | http://localhost:5173 | Comma-separated frontend origins |
| `UPLOAD_DIR` | uploads | Where uploaded files are stored |
| `KEPT_TODAY` | unset | Freeze "today" for demos only |
| `PAYMENTS_MODE` | sandbox | `mpesa` to call Safaricom Daraja |
| `MPESA_*` | empty | Daraja keys, shortcode, passkey, callback URL and callback token |
| `VITE_API_URL` | same origin | Frontend: API base URL |
| `VITE_SITE_SLUG` | unset | Frontend: make one organization's website the home page |
| `VITE_DEMO` | unset | Frontend: build the offline preview |

---

## Known limitations

- Custom domains and subdomain routing are designed but not implemented; organizations are served at `/site/<slug>`.
- Payments run in sandbox. The Daraja integration is written but untested against Safaricom; card payments need a hosted provider (Pesapal, Flutterwave or Stripe).
- Google Sheets sync needs the server; the preview cannot reach Google. The preview also draws a stand-in map; production embeds Google Maps.
- Tazama forms must be opened once while online; installing them as an offline app (PWA) is the next step.
- Notifications are in-app only (no SMS, email or WhatsApp yet).
- No double-entry accounting, payroll or POS integration. Branch takings are entered daily, and stock is held centrally rather than per branch.
- Hotels: no channel manager (Booking.com, Airbnb), seasonal rates or housekeeping. Restaurants assume 40 covers per sitting.
- Studios: no time tracking, file proofing or direct posting to social networks.
- Uploaded files live on local disk (wiped on Render redeploys); move to object storage.
- The rate limiter is in memory (one instance); the session token is stored in `localStorage`.
- Timiza's photos and logo were cropped from screenshots of timiza.vercel.app and are lower resolution than the originals. Staff names and figures are illustrative; real data needs Timiza's permission.
- Pricing, customer domains and all figures in the demo are illustrative.

---

## Further documentation

- `SECURITY.md`: threat model, controls and the tests that prove them.
- `AUDIT.md`: requirement-by-requirement audit against the original capstone brief.
- `Kept_System_Description.docx`: the full product and system description (workflows, every dashboard, every case study, limitations).
