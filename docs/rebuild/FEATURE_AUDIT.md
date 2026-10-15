# Feature Audit

Phase 1 audit of the existing codebase (legacy name **Kept**) against the StrideFlow Master Product Specification.
Audit date: 15 October 2026. Commit audited: `78e450c` (and later, documentation only).

## How this audit was done

Findings come from reading the source and running it, not from the existing documentation.

| Evidence | Command or method | Result on audit date |
|---|---|---|
| Backend tests | `cd backend && pytest -q` | 58 passed |
| Frontend unit tests | `cd frontend && npx vitest run` | 3 passed |
| Browser flows | `tests-e2e/core_flows.py`, `case_studies.py`, `tazama.py` (Playwright) | 21 + 17 + 10 passed |
| Fresh-database migration | `alembic upgrade head` on a new empty PostgreSQL database `kept_fresh` | All 10 migrations applied cleanly |
| Registration against the real API | Scripted calls with the exact payload the sign-up page sends (see "Defects") | Works for the normal case; four defects found |
| No-database start | API started with an unreachable `DATABASE_URL` | Starts; `/api/health` reports `ok`; registration returns a generic 500 |
| Static analysis | `bandit -r backend/app -q` | No issues reported |
| Dependency scans | `pip-audit -r requirements.txt`, `npm audit` | No known vulnerabilities |

**Important limit of the evidence.** The 48 browser checks run against the single-file preview build, where a JavaScript copy of the API (`frontend/src/demo/engine.js`, 1,139 lines) answers requests. They prove the user interface and the preview engine, not the FastAPI backend. The backend is proven by the 58 pytest tests. No browser test currently exercises the real backend end to end.

## Status vocabulary

- **Implemented**: works in the real backend and has tests.
- **Implemented (preview-verified UI)**: backend works and is tested; the screen is verified only in the preview build.
- **Partial**: some of the requirement works; gaps listed.
- **Simulated**: the behaviour is imitated (sandbox, stand-in), not live.
- **Missing**: not present in code.
- **Defective**: present but wrong.

Decisions use the specification's seven classifications: *Preserve*, *Preserve and improve*, *Refactor (remove industry assumptions)*, *Separate into demo-only*, *Repair*, *Defer*, *Remove*.

---

## 1. Platform, tenancy and accounts

| Capability | Where | Status | Decision | Notes |
|---|---|---|---|---|
| Multi-tenant data model (`organization_id` on every row) | `models.py`, `erp.py` | Implemented | Preserve | `test_organizations_are_isolated`, `test_permissions_and_isolation` prove 404 on cross-tenant ids for modules, projects, forms |
| Email and password registration | `routers/auth.py` | Implemented, with defects | Repair | See defects D1 to D4 |
| Login, logout, session expiry (8 h JWT) | `routers/auth.py`, `security.py`, `deps.py` | Implemented | Preserve | |
| Session revocation (token version) | `deps.py`, `routers/auth.py`, `routers/org.py` | Implemented | Preserve | Password change, role change, sign out everywhere; tested |
| Account lockout and rate limiting | `hardening.py` | Implemented, with defect | Repair | Failed sign-up attempts count towards an hourly limit (D2) |
| Password policy and bcrypt hashing | `hardening.py`, `security.py` | Implemented | Preserve | 10+ characters, letters and numbers, rejects common and personal passwords |
| Password visibility toggle | `pages/Auth.jsx`, `Account.jsx`, site logins | Missing | Implement | Required by specification Part 6 |
| Password reset and account recovery | none | Missing | Implement | No email sending exists anywhere in the codebase |
| Google OAuth sign-in and registration | none | Missing | Implement | Grep finds "google" only in Maps and Sheets code |
| Account linking (Google to existing email) | none | Missing | Implement | |
| Workspace creation and ownership | `routers/auth.py`, `routers/apps.py` | Implemented, with neutrality defects | Refactor | Sign-up defaults to the NGO industry and asks for a website address and palette (see Architecture problems) |
| Invitations | `routers/org.py` `POST /users` | Partial | Repair | Administrator sets a temporary password; no invitation email, acceptance link or expiry |
| Roles: administrator, manager, member, viewer | `models.py`, `deps.py` | Implemented | Preserve | Enforced server-side; tested |
| Role-specific home screens | `pages/Overview.jsx` | Implemented (preview-verified UI) | Preserve and improve | Manager home is industry-specific; must become capability-driven |
| My account (profile, password change, sign out everywhere) | `pages/Account.jsx` | Implemented (preview-verified UI) | Preserve | |
| User management (list, role change, deactivate) | `routers/org.py`, `pages/Settings.jsx` | Implemented | Preserve | |
| Audit log | `services/audit.py`, `GET /api/audit` | Implemented | Preserve | Login failures, lockouts, record changes, transitions |
| Apps (install and remove capability bundles) | `apps.py`, `platform.json`, `routers/apps.py` | Implemented | Refactor | Good mechanism; the industry presets and app names carry case-study vocabulary |

## 2. Core operational capabilities

| Capability | Where | Status | Decision | Notes |
|---|---|---|---|---|
| Projects with commitments (targets, deadlines, evidence requirements) | `routers/projects.py`, `models.py` | Implemented | Preserve and improve | Vocabulary is programme/donor oriented ("commitments", "programmes") |
| Project templates | `templates_builtin.py` | Implemented | Refactor | Three templates: `community_programme`, `client_engagement`, `youth_advocacy`. Two of three are NGO-specific |
| Activities (tasks): owners, due dates, dependencies, status | `routers/activities.py` | Implemented | Preserve | Blocked-by-dependency enforced; tested |
| Evidence and proof-before-completion | `routers/activities.py` | Implemented | Preserve | Completion refused without required proof; tested |
| Pace calculation (expected vs actual progress) | `services/pace.py` | Implemented | Preserve | 15-point gap marks at risk; tested |
| Alerts engine (11 rules) | `services/rules.py` | Implemented, with design defect | Preserve and improve | Rules are evaluated synchronously on every `/api/dashboard` call; needs a scheduled job at scale |
| Alert actions: resolve, snooze, reassign, follow-up, history | `routers/flags.py` | Implemented | Preserve | |
| Approvals inbox | `GET /api/approvals` | Implemented | Preserve | Receipt-before-approval and no self-approval enforced for expenses; tested |
| Reports (frozen snapshots, evidence index) | `services/reports.py` | Implemented | Preserve and improve | Report content is project-centric; no reports for other capabilities |
| Calendar (events, deadlines, leave, bookings) | `GET /api/calendar`, `pages/Calendar.jsx` | Implemented (preview-verified UI) | Preserve | |
| Global search | `GET /api/search` | Implemented | Preserve | Scoped to tenant and installed apps; tested |
| Insights (analytics) | `GET /api/analytics`, `pages/Analytics.jsx` | Implemented | Refactor | Built around participants, gender and wards (NGO-specific) |
| Dashboard figures | `GET /api/dashboard` | Implemented | Refactor | Computes NGO, retail, hotel and studio figures inside one endpoint keyed by industry |
| Document expiry alerts | `documents` module, rule `expiring` | Implemented | Preserve | |
| CSV export | every module list | Implemented | Preserve | |
| CSV import | Tazama only | Partial | Preserve and improve | No import for general modules |
| Record history | `GET /api/m/{key}/{id}` `_history` | Implemented | Preserve | |
| Delete with dependency explanation and cascade | `erp.py` | Implemented | Preserve | Tested |
| Kanban boards with drag to transition | `pages/Module.jsx` | Implemented (preview-verified UI) | Preserve | |
| Multi-branch operations | `branches`, `branch_sales`, `transfers` modules | Partial | Preserve and improve | Stock is held centrally; transfers do not move per-branch stock |
| Notifications | in-app bell and alert counts | Partial | Preserve and improve | No email, SMS or push |
| Background processing | none | Missing | Implement | No job runner; long work (rules, sheet sync) runs in the request |

## 3. Spec-driven module engine

`backend/app/modules.json` defines 40 modules; `erp.py` (594 lines) generates tables, validation, CRUD, transitions, statistics and computed fields; `pages/Module.jsx` (402 lines) renders tables, boards and forms.

| Aspect | Status | Notes |
|---|---|---|
| Field types: text, textarea, number, money, date, select, ref, file, colour, bool, email | Implemented | |
| Required, unique, min, max, "after" date ordering | Implemented | |
| Workflow states and role-guarded transitions with notes | Implemented | |
| Required-for-transition fields | Implemented | |
| Relationships (`ref`) with dependency-aware delete | Implemented | |
| Computed fields (budget used, stock level, outstanding) | Implemented | Hand-coded per module in `erp.py` |
| Permissions per module (create, edit, delete) | Implemented | |
| Double-booking prevention (`no_overlap`) | Implemented | Tested |
| Per-workspace custom fields | Missing | Field definitions are global; one customer cannot add a field without changing everyone's |
| Case-study values inside generic definitions | Defective (neutrality) | `reservations.restaurant` options are Ocean Grill, Spice Terrace, Beach Bar; `branch_sales.top_category` lists Denim and Dresses; `items.category` includes Health supplies, IEC materials, Seedlings; `volunteers.interest` lists Timiza's programmes |

Decision: **Preserve and improve.** The engine is the platform's strongest asset. Remove case-study option lists from global definitions, and add per-workspace option lists and custom fields (Architecture Plan section 5).

## 4. Specialist modules (40)

| App | Modules | Status | Decision |
|---|---|---|---|
| Funding | grants, donations, income | Implemented | Preserve (optional capability) |
| Budgets and expenses | budget_lines, expenses | Implemented | Preserve |
| Procurement | vendors, purchase_requests | Implemented | Preserve |
| Inventory and assets | items, stock_moves, assets | Implemented | Preserve and improve (per-location stock) |
| People | volunteers, volunteer_hours, leave_requests | Implemented | Refactor ("volunteers" becomes a configurable people register) |
| Participant registry | participants | Implemented | Preserve (optional; anonymised) |
| Events | events (+ automatic attendance form) | Implemented | Preserve |
| Documents | documents | Implemented | Preserve |
| Governance | meetings, decisions | Implemented | Preserve |
| Sales and invoicing | customers, invoices | Implemented | Preserve |
| Rooms and bookings | resources, bookings | Implemented | Preserve; generalise name to "Bookings and resources" |
| Branches | branches, branch_sales, transfers | Implemented | Preserve and improve |
| Deliveries | deliveries | Implemented | Preserve and improve (proof of delivery is in Tazama, not on the delivery record) |
| Studio | productions | Implemented | Refactor into a general "Jobs and deliverables" pipeline |
| Content calendar | posts | Implemented | Preserve (optional) |
| Dining | reservations | Implemented, with hard-coded restaurants | Refactor (restaurants become workspace-defined venues) |
| Tours | tours, tour_bookings, guides | Implemented | Preserve (optional) |
| Website | site_settings, site_programmes, site_team, site_services, site_stories, site_gallery, site_partners, inquiries | Implemented | Separate (see Architecture problem P4) |

## 5. Field data collection (Tazama)

| Requirement (spec 4.2) | Status | Evidence |
|---|---|---|
| Form builder, 10 question types | Implemented | `routers/forms.py`; tests in `test_tracking.py` |
| Required fields and validation | Implemented | |
| Skip logic (show only if) | Implemented | Backend refuses forward references; hidden answers not stored; tested |
| GPS capture | Implemented (preview-verified UI) | Browser geolocation in `field.js`; validated server-side |
| Photo capture | Implemented | Downscaled on device; magic-byte checked server-side |
| File capture (non-photo) | Missing | Only images accepted for form answers |
| Field-team assignments | Missing | Forms cannot be assigned to people or teams |
| Submission metadata (collector, location, captured time, source) | Implemented | |
| Offline queue and synchronisation | Implemented, with limit | Queue in `localStorage`; form must have been opened online once; no service worker |
| Duplicate protection | Implemented | Client id per response; import and sheet rows fingerprinted; tested |
| Submission review and correction | Partial | Managers can delete responses; no edit, review status or reviewer comments |
| Filtering, aggregation, analytics | Implemented | Per-question charts with filtering |
| Live tracker (polling every 5 s) | Implemented | Tested in browser and API |
| Maps | Simulated in preview, scatter plot in app | No real map tiles in the dashboard; Google Maps links per response |
| CSV import and export | Implemented | Row-level errors returned; tested |
| Google Sheets sync | Implemented, verified only with a mocked HTTP client | SSRF protections tested; never run against Google |
| Public form links | Implemented | Rate-limited, honeypot |
| Permissions | Implemented | Viewers cannot submit; managers delete |
| Audit history of submissions | Partial | Deletions and imports audited; individual submissions are not |
| Data retention controls | Missing | |

Decision: **Preserve and improve.** Add assignments, review and correction, file answers, retention settings, real map tiles and a service worker.

## 6. Public websites and case studies

| Capability | Status | Decision | Notes |
|---|---|---|---|
| Kept marketing website (Home, Product, Solutions, Customers, Pricing, Contact) | Implemented (preview-verified UI) | Rewrite | Must become StrideFlow; current copy leads with NGO and case-study material |
| Tenant website builder (every workspace can publish a site) | Implemented | Separate | Spec: the platform website is not a website builder; customer websites must not be mandatory onboarding |
| Timiza website (faithful rebuild with additions) | Implemented (preview-verified UI) | Preserve and improve, move to case-study deliverable | Images are cropped from screenshots (low resolution) |
| Tumaini website | Implemented | Move to case-study deliverable | Uses the community template; limited content |
| Hatua website (shop, stores, order tracking) | Implemented | Move to case-study deliverable | |
| Mwangaza website (portfolio, brief form) | Implemented | Move to case-study deliverable | |
| Pwani website (rooms, dining, tours) | Implemented | Move to case-study deliverable | |
| Nationwide electronics business website | Missing | Implement | Mandatory sixth case study |
| Donations (M-Pesa, card) | Simulated (sandbox) | Preserve | Daraja STK push code exists but has never been run against Safaricom |
| Online orders with stock check and order tracking | Implemented | Preserve as case-study and optional capability | |
| Room, table and tour booking with capacity checks | Implemented | Preserve as case-study and optional capability | |
| Demo request form (Kept site) | Partial | Repair | Logs the request; no email or CRM delivery |
| Platform showcase (`/api/platform/showcase`) | Defective (privacy) | Remove or restrict | Publishes every workspace that has a website, including future real customers |

## 7. Demonstrations

| Capability | Status | Decision |
|---|---|---|
| Five demo organizations with realistic data | Implemented | Separate into demo-only (Architecture Plan section 6) |
| Sixth demo (electronics, multi-branch) | Missing | Implement |
| Demo data loading | Defective (isolation) | `seed.py` writes demo organizations into the same database and tables as customers; documentation tells operators to run it in production |
| Demo reset | Partial | Preview build only (`resetPreview` clears browser storage). No server-side reset |
| Demo isolation from production | Missing on the server | Only the preview build is isolated (by running in the browser) |
| Demo labelling | Partial | Preview shows "Demo"; websites and dashboards are not consistently labelled as illustrative |
| Known demo passwords in the production database | Defective (security) | `kept-demo-2026` for every demo account |
| Preview engine (JavaScript copy of the API) | Implemented | Defer replacement, then remove. It duplicates the backend and has drifted risk with every change |

## 8. Integrations

| Integration | Status | Decision |
|---|---|---|
| Google OAuth | Missing | Implement |
| AI | Simulated | "Copy AI brief" copies report figures to the clipboard and opens chatgpt.com. No provider, no server call |
| Email (invitations, resets, notifications) | Missing | Implement (provider-configurable) |
| M-Pesa (Daraja) | Written, untested live | Preserve behind configuration |
| Card payments | Simulated | Defer (hosted provider) |
| Google Sheets | Implemented, tested with mocks | Preserve |
| Google Maps | Simulated in preview; embed link in production | Preserve and improve |
| File storage | Local disk | Repair (object storage; Render's disk is wiped on redeploy) |

## 9. Defects found during this audit

| Id | Defect | Evidence | Severity |
|---|---|---|---|
| D1 | The sign-up page generates website addresses the API rejects. `slugify` truncates to 40 characters and can end with a dash; names under 3 characters give 2-character slugs. The API answers with a raw regular expression ("String should match pattern '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'") | Calls 3 and 4 in the registration test | High: blocks sign-up for long or very short organization names |
| D2 | Failed registration attempts count towards a limit of 5 per hour per IP address. A person who mistypes a password policy three times and fixes two other errors is locked out for an hour. On a shared network (office, campus, `127.0.0.1` in development) everyone shares one limit | Call 9 returned 429 "Try again in 3600 seconds" after earlier validation failures | High: the most likely cause of reported registration failures |
| D3 | Validation messages come straight from Pydantic ("String should have at least 2 characters") and the frontend only redirects to the right step for errors shaped `{field}`; schema errors are shaped `{errors: [...]}` | Call 8 | Medium |
| D4 | The password hint says "10+ characters, letters and numbers" but the server also rejects passwords containing the person's name or email and common words, without saying so in advance | Calls 6 and 7 | Low |
| D5 | `/api/health` reports `ok` when the database is unreachable, and registration then fails with a generic 500. Operators cannot tell the database is down | No-database run | Medium |
| D6 | `seed.py` inserts five demo organizations with a shared known password into the production database, and the README deployment steps include running it | `seed.py`, README | High (data separation and security) |
| D7 | Uploaded files are served at `/files/{name}` to anyone with the link, with no sign-in or organization check | `main.py` lines 69 onward | Medium (unguessable 128-bit names reduce, but do not remove, the risk) |
| D8 | Alert rules are evaluated inside every `/api/dashboard` request | `routers/erp.py` `dashboard()` | Medium (performance at scale) |
| D9 | `/api/platform/showcase` lists every workspace that has website settings | `routers/apps.py` | Medium (privacy) |
| D10 | `KEPT_TODAY` freezes the date for the whole server; it exists only for demos but lives in production configuration | `config.py` | Low (refused in production mode) |

## 10. Legacy name "Kept"

23 occurrences of "Kept" in source files (excluding embedded images) plus documentation. Internal identifiers: `kept_token`, `kept_theme`, `kept_collector`, `kept_outbox_*`, `kept_preview_db_v*` (browser storage keys), `kept:changed`, `kept:signed-out`, `kept:theme` (browser events), `KEPT_TODAY` (environment variable), database name `kept`, directory `kept/`. Plan: rename every user-facing string to StrideFlow; rename browser keys with a one-time migration so signed-in users are not logged out; keep the database name and directory until infrastructure is set up (Implementation Plan phase 3).
