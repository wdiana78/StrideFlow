# Audit against the original capstone brief

Status key: **Done**, **Partial** (works, with a stated limit), **Deferred** (deliberately out of scope).

| Brief section | Requirement | Status | Where |
|---|---|---|---|
| 2 Product concept | Business management and operations platform, not a CRUD collection | Done | Programmes and M&E plus 24 operational modules linked by real foreign keys, rules and reports |
| 3 Case study | Real organization as case study, product stays general | Done | Timiza Youth Initiative workspace and website; Tumaini (fictional NGO) and Mwangaza (creative agency) prove it is not NGO-only |
| 3 | No private data; fictional figures | Done | Only public website facts are real; staff, figures and finances are illustrative and labelled |
| 3 | Shared capabilities separated from industry terms | Done | Templates hold vocabulary and proof rules; modules are defined in one JSON spec |
| 4 Discovery | Problem analysis before code | Done | Plan, data model and journey boards on the design canvas |
| 5A Setup | Organization, users, roles, permissions | Done | Register, invite, roles, deactivate, audit log |
| 5B Work | Tasks, deadlines, dependencies, escalation, ownership | Done | Activities, dependency blocking, overdue escalation after 2 days, Attention queue |
| 5C Projects | Objectives, planned vs actual, evidence, templates | Done | Commitments with pace, required proof, three templates |
| 5D Resources | Suppliers, purchase requests, approvals, POs, deliveries, budgets, invoices, inventory | Done | Vendors, purchase requests (approve, order, receive), budget lines, expenses with receipts, stock, assets |
| 5E Records | CRUD, search, filter, sort, paginate, attachments, expiry, minutes, decisions | Done | Every module: table and board views, row edit and delete, CSV export, history; documents with expiry; meetings and decisions |
| 5F Automation | Triggers, conditional rules, reminders, approvals, escalation, missing info | Done | 10 rule types feeding Attention; approval routing with no self-approval; auto block and unblock; donation → income posting |
| 5F | Exception handling and recovery from failed processes | Partial | Failed and cancelled payments recorded and retryable; no background job queue yet |
| 5G Reporting | Configurable reports, KPIs, planned vs actual, trends, exportable | Done | Period reports (frozen snapshots, PDF), M&E analytics, budget vs actual, overview KPIs, form analytics, CSV everywhere |
| 5H Accountability | Audit trail, ownership, ageing, prioritised exceptions, evidence behind metrics | Done | Audit log, Attention queue by severity and age, evidence index in reports |
| 5I AI readiness | Copy a verified brief to an external AI, no paid API | Done | "Copy AI brief" on reports |
| 6 Defining value | One-sentence proposition; connected records | Done | Promises → work → proof → flags → reports → public impact |
| 7 Scope | MVP, next, long-term | Done | Plan board; this audit; README |
| 8 Tech | One backend (FastAPI), one ORM (SQLAlchemy), PostgreSQL, migrations, tests, env config, Vercel and Render | Done | 3 Alembic migrations, 38 backend tests, `render.yaml`, `vercel.json` |
| 8 | No paid integrations without approval | Done | M-Pesa Daraja code path built but off by default; sandbox simulator for demos |
| 9 UI/UX | Distinct, branded, accessible, responsive, deliberate states | Done | White-label theme from site settings, visible focus, labelled controls, empty, loading and error states, mobile menu |
| 10 Design | Wireframes, design system, high-fidelity screens | Done | Design canvas artifact |
| 11 Functional | Real CRUD, validation, persistence, backend permissions, working filters, audit | Done | All verified in automated tests and browser runs |
| 12 Process | Incremental stages with decisions explained | Done | This conversation and git history |
| Extra | Platform with industry selection and installable apps (Odoo model) | Done | Kept home page, three-step sign-up, Apps page, API app gating, four demo tenants in four industries |
| Extra | Event-linked data collection | Done | Every event gets a public attendance and feedback form; marking it held fills attendance from responses |
| Extra | Sales and Bookings | Done | Invoices with overdue alerts and income posting; bookings with double-booking prevention |
| Extra (your request) | Public website with donate button, data collection, M&E charts, security review | Done | Website pages, sandbox M-Pesa and card donations, form builder, analytics, `SECURITY.md` |

## Known gaps, honestly stated

- Double-entry accounting and payroll are not included. Kept tracks budgets, expenses and income, not a general ledger.
- No SMS, email or WhatsApp notifications yet; flags appear in the app only.
- Offline data collection for field staff with no signal is not built.
- The hosted preview runs a JavaScript copy of the API in the browser so it can be clicked without a server. The real system is the FastAPI and PostgreSQL code in `backend/`.
