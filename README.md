# Kept

Kept turns the promises an organization makes to funders, clients and partners into tracked work, and builds the proof and the report from the work itself.

Moringa School capstone, 2026. All organizations and people in the demo data are fictional.

## What it does

1. **Commit.** A project holds commitments: what is owed, to whom, the target, the unit and the due date.
2. **Plan.** Each commitment is broken into activities with an owner, a due date, an optional dependency, and the proof required to complete it (copied from the project's template).
3. **Prove.** An activity cannot be completed until its required proof exists (a count, a file, a note). Only completed activities count toward targets.
4. **Flag.** A rules engine runs after every change and opens or closes flags automatically:

   | Rule | Fires when | Goes to |
   |---|---|---|
   | Due soon | Not started, due within 3 days | Activity owner |
   | Overdue | Past due and not done | Owner; project manager after 2 days late |
   | Missing proof | Completion was refused and proof is still missing | Activity owner |
   | Blocked | Depends on an activity that is past due (status set to blocked automatically) | Activity owner |
   | Behind pace | Commitment 15+ points behind expected-by-today | Project manager |

   Pace: `expected = target × (days since project start ÷ days from project start to the commitment's due date)`. A flag closes itself when its condition clears. A manually resolved flag stays closed for 3 days.
5. **Report.** A period report (planned against actual, charts, issues and resolutions, evidence index) is generated from the records and stored as a frozen snapshot. It prints to PDF, and "Copy AI brief" copies a prompt of verified figures and opens ChatGPT, with no paid API.

Every meaningful action, including those made by the rules, is written to the audit log.

## Case studies

Five organizations run on the same platform, each with its own tools, website and branded dashboard.

| Organization | Industry | Its own tools | Website (production domain) |
|---|---|---|---|
| Timiza Youth Initiative | Community organization | Programmes and M&E, Tazama field data, funding and donations, volunteers, participant registry | timiza.or.ke |
| Tumaini Community Network | Community organization | Programmes, participants, finance | tumaini.kept.africa |
| Hatua Apparel | Retail chain, five branches | Branch takings against target, stock transfers, deliveries with rider tracking (Tazama), online shop with order tracking | hatua.co.ke |
| Mwangaza Creative Studio | Photography, video, film, social media | Production pipeline, content calendar, studio and gear bookings, client invoicing | mwangaza.studio |
| Pwani Hotels & Safaris | Hotel, restaurants and tours | Rooms, table reservations by sitting, tours with guide assignment, online booking for all three | pwanihotels.co.ke |

A member of the public types the organization's address (or searches its name) and lands on its website. In this repository every site is also served at `/site/<slug>`; in production each organization points its own domain at Kept, or uses `<slug>.kept.africa`.

## Roles

Staff sign in from their organization's website (Staff login) and land on a home built for their role:

- **Administrator**: everything a manager sees, plus team, roles, apps, audit log and website settings.
- **Manager**: the operations home for their industry (programmes, branches, rooms or productions), approvals and alerts.
- **Field team**: "Your day": their own tasks, Tazama forms ready to collect, and alerts assigned to them.
- **Board and partners**: a read-only overview of results, money and reports.

The dashboard has a top bar (search, notifications, account menu) and a sidebar, and a My account page for password changes and signing out on all devices.

## How the platform works (the Odoo model)

Kept is the product. Its home page sells the platform: apps, industries and live customer examples.

- **Sign-up** asks for the industry (community organization, agency, retail, hospitality, school, clinic), the organization name, an optional website address and a brand palette. Kept installs the apps that industry needs.
- **Apps** (14): Projects and M&E, Data collection, Events, Funding, Budgets and expenses, Sales and invoicing, Procurement, Inventory and assets, Bookings, People, Participant registry, Documents, Governance, Website. Admins install or remove them in Apps; data is kept when an app is removed. The API refuses requests to apps an organization has not installed.
- **Every organization** gets its own branded website at `/site/<slug>` and a private, isolated workspace, themed in its own colours.
- **Demo tenants**: Timiza Youth Initiative (community), Mwangaza Creative Studio (agency), Hatua Shoes (retail), Pwani Coast Stays (hospitality).
- **A dedicated deployment** for one customer's own domain (for example timiza.or.ke) sets `VITE_SITE_SLUG=timiza`, which makes that organization's website the home page.

## Tazama: field tracking (replaces the Google Sheet)

Every form in Data collection works like a field-survey tool:

- **Question types** include location (GPS from the phone) and photo (taken with the camera, downscaled on the device before upload), alongside choices, numbers, ratings, dates and text. **Skip logic** shows a question only when an earlier answer matches.
- **Offline first.** On a phone with no signal, responses are kept on the device and sent automatically when it reconnects. Each carries a client id, so a retry never creates a duplicate. Field officers without accounts use the public link and enter their name once.
- **Live tracker** (the default view of each form): today, last 7 days, progress to target, responses per day, a collector league table, a map of where responses were collected, a breakdown by any choice question, and a feed of the latest responses. It refreshes every 5 seconds.
- **Moving off Google Sheets.** Import the existing sheet as CSV (columns are matched to questions by name, and rows that fail validation are listed with reasons), or connect the sheet's link and press Sync to pull only new rows while the team switches over.

Timiza's demo has an "Outreach field tracker" with two weeks of GPS-tagged records from three field officers. In the preview, "Simulate a field team" shows responses arriving live.

## Design system

Six colour roles, each with a job:

| Role | Kept | Timiza's dashboard | Used for |
|---|---|---|---|
| Night | `#22184F` (derived) | deep navy (derived from Timiza blue) | Sidebar, home banner, footer |
| Primary | Violet `#7C5CFF` (sweetened) | Timiza blue `#2563EB` | Buttons, active menu item, charts, links |
| Accent | Tangerine `#FF6B35` | Timiza red `#EF4444` | Alert counts, highlights |
| Marigold | `#FFB627` | `#FFB627` | Positive emphasis, chart series, user avatar |
| Sky | `#3BA7FF` | `#3BA7FF` | Information, chart series |
| Tint | Lilac (derived) | pale blue (derived) | Page background, table headers, soft fills |

Every organization's dashboard derives the same six roles from its own primary and accent colours (Website, then Site settings), so Timiza's staff work in Timiza colours and Hatua's in Hatua's. Dark mode deepens the same colours into indigo or navy rather than black. Text on light accents (lime, yellow) switches to dark automatically. Kept's own pages (home, sign-up, platform sign-in) always use Kept's six.

The field data collection app is called **Tazama** (Swahili: "observe").

**Timiza's website** follows timiza.vercel.app exactly: dark contact bar with both phone numbers, white header with their logo and centred navigation (Home, About Us, Our Work, Contact Us, Gallery), red Donate button, Inter headings with blue eyebrows, photo page headers with a title card, white cards on light grey, and the dark "Connect with Us" footer. Their logo, photos, partner logos and copy are used as published on their site (`assets/timiza`). Additions in the same visual language: live impact figures, a page per program with progress from verified records, a gallery lightbox, a map on Contact Us, a volunteer form, the donation flow and Staff login. Any organization on the community template gets this structure in its own colours and photos (`pages/CommunitySite.jsx`).

**Tenant websites** wear the organization's own brand (primary, accent, deep colour and a heading font chosen in Website → Site settings) and get an industry-specific design:

| Organization | Industry | Palette and type | Website features |
|---|---|---|---|
| Timiza Youth Initiative | Community organization | Ocean blue, mango, Fraunces | Programmes with live progress, impact counters, gallery, stories, donations, volunteer sign-up |
| Tumaini Community Network | Community organization | Forest green, harvest gold, DM Serif | Same community layout, different brand |
| Hatua Shoes | Retail | Cognac, lime, Bricolage | Shop from live inventory, bag, stock-checked orders that land in Inquiries |
| Pwani Coast Stays | Hospitality | Deep sea, coral, DM Serif | Availability search, rooms, booking requests that create tentative bookings with double-booking checks |
| Mwangaza Creative Studio | Agency | Black, electric yellow, Space Grotesk | Portfolio case studies, services, project brief form |

## What Timiza sees first

On Timiza's own domain (`VITE_SITE_SLUG=timiza`), the home page is Timiza's public website: home, about, programmes, services, stories, impact, get involved, contact and donate. Staff sign in from the top bar to reach the ERP behind it. Website content, brand colours, programmes, services, stories and team are all edited in the ERP's Website section, and the impact numbers on the site are counted live from verified records.

**Donations**: M-Pesa STK push and card in sandbox mode by default. Set `PAYMENTS_MODE=mpesa` and the Daraja variables to take real M-Pesa payments. A confirmed donation automatically becomes an Income record and moves the campaign progress bar.

**Data collection**: build surveys, registers and checklists (8 question types), collect in the app or through a public link, and get charts for every question, cross-filtering and CSV export.

**M&E analytics**: progress lines against targets, participants by gender, age, ward, disability and programme, event turnout, spending and volunteer hours.

See `SECURITY.md` for the security review and `AUDIT.md` for the audit against the original brief.

## ERP modules (case study: Timiza Youth Initiative)

Beyond programmes and M&E, Kept runs the whole organization. Every module below is defined once in `backend/app/modules.json`; that spec generates the PostgreSQL tables (prefixed `m_`, with real foreign keys), the validated API, the workflow rules and the screens.

| Area | Modules | Highlights |
|---|---|---|
| Funding | Grants, Income | Pipeline board from prospect to closed; application and report deadlines flagged |
| Finance | Budget lines, Expenses, Budget against actual | Approval workflow, receipts required before approval, no self-approval, overspend flags |
| Procurement | Purchase requests, Vendors | Request, approve, order (vendor required), receive |
| Inventory | Stock items, Stock movements, Assets | Live stock levels, low-stock flags, asset custodians and condition |
| People | Volunteers, Volunteer hours, Leave | Website sign-ups land as applicants; leave approval |
| Participants | Participant registry | Anonymised codes for disaggregated reporting, consent recorded, no names |
| Operations | Events, Documents, Inquiries | Calendar, document expiry flags, website messages |
| Governance | Meetings, Decisions and actions | Minutes and owned follow-ups |
| Website | Site settings, Programme pages, Team | Public portfolio at `/site/<slug>` with live results from verified records |

Also: an organization overview dashboard, an approvals inbox, a combined calendar, CSV export on every module, table and board views, and full history on every record. API reference: `/docs` on the running API.

## Stack

- **Frontend:** React 18, React Router, Vite, plain CSS design system. Vitest.
- **Backend:** FastAPI, SQLAlchemy 2, Alembic migrations, Pydantic validation, JWT auth with bcrypt-hashed passwords. Pytest.
- **Database:** PostgreSQL.
- **Hosting:** Vercel (frontend), Render (API and database).

```
backend/
  app/
    main.py              app, CORS, error format, routers
    config.py            settings from environment / .env
    db.py                engine and session
    models.py            12 tables
    schemas.py           request and response validation
    security.py          bcrypt and JWT
    deps.py              current user, role checks, tenant-scoped lookups
    templates_builtin.py Community programme and Client engagement templates
    routers/             auth, org (people, stakeholders, templates, audit), projects, activities, flags
    services/            pace, rules engine, report builder, audit
  migrations/            Alembic
  tests/                 45 API, business-rule, ERP, apps and security tests
  seed.py                fictional demo data
frontend/
  src/pages              Landing, Auth, Attention, Projects, Project, Activity, Work, Reports, ReportView, Settings
  src/components         Shell (navigation), ui (status, pace line, dialog, fields, states)
```

## Roles (enforced by the API, not just hidden in the UI)

| Role | Can |
|---|---|
| Admin | Everything, plus people, roles, stakeholders and the audit log |
| Manager | Create and edit projects, commitments and activities; resolve, reassign and snooze flags; generate reports |
| Member | Update status and add proof on activities they own |
| Viewer | Read only |

Each organization's data is isolated: another organization's ids return 404.

## See it right now (no setup)

Open `kept-live-preview.html` (in the project root) in any browser, or use the hosted link. It is the same React app running against `frontend/src/demo/engine.js`, an in-browser port of the API (same endpoints, rules, pace maths, permissions and reports) with data saved in the browser. Use **Switch account** to try each role and **Reset data** to start over. Rebuild it with `cd frontend && npm run build:preview`.

The real app below uses the FastAPI backend and PostgreSQL; the preview engine is never included in the normal build.

## Run it locally

Requirements: Python 3.12, Node 20+, PostgreSQL 14+.

```bash
# 1. Database
createuser kept --pwprompt        # password: kept
createdb -O kept kept
createdb -O kept kept_test

# 2. API
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python seed.py                    # optional demo data
uvicorn app.main:app --reload     # http://localhost:8000/docs for interactive API docs

# 3. Web app (new terminal)
cd frontend
npm install
npm run dev                       # http://localhost:5173
```

### Demo accounts (password `kept-demo-2026`)

| Email | Role |
|---|---|
| zawadi@timiza.example | Manager, Timiza Youth Initiative case study (full ERP data) |
| admin@timiza.example | Admin, Timiza |
| achieng@tumaini.example | Manager |
| admin@tumaini.example | Admin |
| brian@tumaini.example | Member |
| viewer@tumaini.example | Viewer |
| wairimu@mwangaza.example | Admin of the second organization (client-engagement example) |

`KEPT_TODAY=2026-10-13` in `.env` freezes "today" so the demo always shows the same situation. Remove it for real use.

### The 2-minute demo

1. Sign in as Achieng. Attention lists 13 flags, worst first.
2. Open **Women in Agribusiness**. Training is 22 points behind pace.
3. Open **Session 9, Kangundo group**. Click **Mark complete**: refused, the signed sheet is missing.
4. Attach any image as the sheet, then **Mark complete**. 21 women are added, training goes from 64 to 85 of 120, and the Behind pace flag closes itself.
5. Back on the project, **Generate report**. Print it or copy the AI brief.

## Tests

```bash
cd backend && pytest -q          # 56 tests: auth, roles, tenant isolation, validation,
                                 # proof rules, pace, flags, escalation, dependencies, reports
cd frontend && npm test
```

## Deploy

### API and database on Render

1. Push this repository to GitHub.
2. In Render, choose **New > Blueprint** and select the repo. `render.yaml` creates `kept-api` and a free PostgreSQL database `kept-db`, wires `DATABASE_URL`, and generates `JWT_SECRET`.
3. After the first deploy, open the service's **Shell** and run `python seed.py` if you want the demo data.
4. Note the API URL, for example `https://kept-api.onrender.com`.

Start command (already in the blueprint): `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

### Web app on Vercel

1. **Add New > Project**, import the repo, set **Root Directory** to `frontend`.
2. Framework preset: Vite. Build: `npm run build`. Output: `dist`.
3. Environment variable: `VITE_API_URL=https://kept-api.onrender.com`. If you set `KEPT_TODAY` on the API, set `VITE_TODAY` to the same date.
4. Deploy, then put the Vercel URL in Render's `CORS_ORIGINS` (comma-separate several) and redeploy the API.

`vercel.json` rewrites all paths to `index.html` so deep links like `/app/projects/…` work.

### Known limits

- Uploaded files are stored on the API server's disk. Render's free disk is wiped on redeploy, so use a Render disk or move uploads to object storage (Cloudinary or S3) before real use.
- Files are served from unguessable URLs without a token check. Signed URLs are the next step.
- Pace assumes steady progress; front- or back-loaded commitments (for example certificates issued at the end) will flag early.

## Next iteration

Budget lines and expenditure, approval routing, recurring activities, email reminders, custom fields per template, a read-only stakeholder portal, offline phone capture, WhatsApp and M-Pesa integrations.
