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
  tests/                 22 API, business-rule and ERP tests
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
cd backend && pytest -q          # 22 tests: auth, roles, tenant isolation, validation,
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
