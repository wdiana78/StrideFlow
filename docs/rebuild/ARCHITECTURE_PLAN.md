# Architecture Plan

## 1. Summary

Keep the stack (FastAPI, PostgreSQL, SQLAlchemy, Alembic, React with Vite). It is sound, tested and suited to the product. The rebuild changes **boundaries**, not technology:

1. A **neutral core** where capabilities are chosen by the customer, not implied by an industry.
2. **Per-workspace configuration** (terminology, option lists, custom fields) so specialist modules no longer carry case-study values.
3. A **separate demonstration environment** (own database, own deployment mode) with per-visitor sandboxes that can be reset, replacing both the production seed and, later, the duplicated JavaScript API.
4. **Case-study websites as a separate frontend deliverable** that talks to the demonstration environment, not to production.
5. **Authentication completed**: Google OAuth, password reset, invitations, and a move from browser-stored tokens to secure cookies.
6. Supporting infrastructure that is currently missing: background jobs, object storage, email, a provider-configurable AI service.

## 2. Current architecture (as found)

```
frontend (React/Vite)                    backend (FastAPI)                      PostgreSQL "kept"
  marketing pages ─┐                       /api/auth, /api/users                  organizations, users, projects ...
  tenant websites ─┼── /api ─────────────▶ /api/m/{module} (spec engine)  ──────▶ m_* tables (40 modules)
  dashboard        ┘                       /api/forms (Tazama)                    forms, form_submissions
  demo/engine.js  ◀── preview build only   /api/public/{slug}/... (websites)      ← demo orgs seeded here too
                      (JS copy of the API)  /files/{name} (no auth)               uploads on local disk
```

## 3. Problems this plan addresses

| Id | Problem | Consequence |
|---|---|---|
| P1 | Industry is the organizing concept. Sign-up defaults to "Community organization or NGO"; dashboards, analytics and templates branch on industry | Violates neutrality; a logistics company has no fitting industry |
| P2 | Case-study values live in global module definitions (restaurant names, apparel categories, NGO programme names) | Every customer sees another organization's vocabulary |
| P3 | Demo organizations are seeded into the production database with a shared password | Data separation and security failure; reset impossible without touching production |
| P4 | The tenant website builder is part of every workspace and of sign-up; the platform's marketing site lists tenants publicly | Confuses deliverable A with deliverable B; leaks customer names |
| P5 | Two implementations of the API (Python and the 1,139-line JavaScript preview engine) | Every change must be made twice; drift is inevitable |
| P6 | No background processing; rules evaluated on dashboard requests | Slow dashboards as data grows; long jobs tie up requests |
| P7 | Files on local disk, served without authorization | Lost on redeploy; reachable without sign-in |
| P8 | Authentication incomplete (no OAuth, reset, invitations by email); token stored in `localStorage` | Specification Part 6 unmet; XSS would expose sessions |

## 4. Target architecture

```
                      ┌───────────────────────── StrideFlow production ─────────────────────────┐
 stride-web (React)   │  FastAPI  (APP_MODE=production)                                          │
  marketing site ─────┼─▶ auth (password, Google OAuth, reset, invitations), workspaces          │
  application   ──────┼─▶ capabilities: module engine + workspace configuration                  │
                      │   Tazama, approvals, alerts, reports, search, exports, AI (optional)      │
                      │   files via /api/files/{id} (authorized, signed object-storage URLs)      │
                      │   worker process: rules, sheet sync, emails, exports, retention           │
                      │   PostgreSQL: strideflow_prod          Object storage: prod bucket        │
                      └───────────────────────────────────────────────────────────────────────────┘
                      ┌──────────────────────── StrideFlow demonstrations ───────────────────────┐
 stride-web (same     │  same FastAPI code (APP_MODE=demo)                                       │
  build, demo URL) ───┼─▶ /api/demo/{scenario}/start → creates a private sandbox workspace       │
                      │   copied from the scenario snapshot; expires after 24 h; reset = new copy │
 case-study sites ────┼─▶ /api/public/{slug}/... answered from the scenario's showcase workspace  │
  (six separate       │   PostgreSQL: strideflow_demo           Object storage: demo bucket      │
   builds)            └───────────────────────────────────────────────────────────────────────────┘
```

One codebase and one product. Production and demonstrations are separate **deployments** of the same code with separate databases and storage. Nothing in the production database is ever created by demo tooling, and the demo tooling refuses to run when `APP_MODE=production`.

## 5. Neutral core and workspace configuration

### 5.1 Capabilities replace industries

- `platform.json` keeps the capability catalogue (today's "apps"), renamed in the interface to **capabilities**: Projects and tasks, Field data (Tazama), Approvals and expenses, Budgets, Procurement, Inventory and locations, Deliveries, Bookings and resources, Customers and invoicing, Jobs and deliverables, Content calendar, People, Events, Documents and contracts, Governance, Funding and donations, Participant registry, Public pages.
- Sign-up no longer asks for an industry. Onboarding asks what the customer wants to manage first and enables only those capabilities. Industries survive only as optional **starter templates** the customer explicitly chooses ("Start from a template" with a preview), never as a default.
- Every dashboard panel, insight and report declares which capability it needs and appears only when that capability is enabled. No endpoint branches on industry.
- New workspaces start empty. Empty states offer the next sensible action per screen.

### 5.2 Per-workspace configuration (new tables)

| Table | Purpose |
|---|---|
| `workspace_settings` | Terminology overrides (for example "Projects" shown as "Programmes" or "Jobs"), enabled capabilities, currency, time zone, locale, fiscal year start |
| `workspace_option_lists` | Values for select fields per workspace (venues, product categories, departments, programme areas). Replaces case-study values in `modules.json` |
| `workspace_custom_fields` | Extra fields per module per workspace (type, label, required, list visibility), stored in the record's JSONB `extra` column |
| `locations` | Generic sites, branches, warehouses, venues; referenced by inventory, deliveries, bookings, sales and expenses |

The module engine merges the global definition with the workspace's configuration at request time (cached per workspace). Global definitions keep only neutral defaults.

### 5.3 Specific refactors

- `reservations.restaurant` becomes a reference to a `location` of kind "venue".
- `branch_sales` becomes **Location sales** (period takings per location); categories come from the workspace option list.
- Stock becomes **per location**: `stock_moves` gains `location_id`; transfers move stock between locations; stock levels are computed per location and in total.
- `volunteers` becomes a **People register** with a configurable "type" option list (volunteer, contractor, member, guide, rider).
- `productions` becomes **Jobs** (client work from brief to delivery), with job types from an option list.
- Insights split into capability-specific analytics (projects, field data, inventory, sales, bookings); participant demographics only when the Participant registry is enabled.

## 6. Demonstration environment

### 6.1 Scenarios

Six scenario definitions in `backend/demo/scenarios/` (JSON, version-controlled): Timiza Youth Initiative, Tumaini Community Network, Hatua Apparel, Mwangaza Creative Studio, Pwani Hotels & Safaris, and **Voltline Electronics** (working name for the nationwide electronics business; see unresolved decision U4). Each defines workspace settings, enabled capabilities, locations, users with roles, and records. Data generation is deterministic.

### 6.2 Per-visitor sandboxes

- `POST /api/demo/{scenario}/start` (demo mode only) copies the scenario's snapshot into a new workspace flagged `kind = 'demo_sandbox'` with `expires_at = now + 24 h`, and signs the visitor in as a chosen demo role.
- Visitors only ever touch their own sandbox, so one visitor cannot change another's data, and no visitor can change a scenario's master copy.
- **Reset** creates a fresh copy and abandons the old one; a worker job deletes expired sandboxes.
- Every demo screen shows a persistent "Demonstration with illustrative data" banner with Reset and Exit.
- Simulated integrations (payments, maps, SMS) are labelled as simulated in the interface.
- Demo users cannot reach administrative platform functions; demo sandboxes cannot send real email or SMS.

### 6.3 Guards

- `organizations.kind` (`customer`, `demo_scenario`, `demo_sandbox`) with a database check constraint.
- In production mode the API refuses any request that resolves to a non-customer workspace, and demo endpoints are not mounted.
- The demo loader refuses to run unless `APP_MODE=demo` and the database name matches the demo pattern.
- A data migration removes the five legacy demo organizations from existing production databases (after a backup), see section 10.

### 6.4 The single-file preview

`kept-live-preview.html` and `demo/engine.js` remain as an offline showcase until the server-side demonstrations are live, then are retired to remove the duplicated API (P5). See unresolved decision U3.

## 7. Case-study websites

- A separate frontend package, `case-studies/`, builds six independent static sites from shared presentational components and per-site content files. Each has its own identity, navigation and copy.
- Interactive features (donations, orders, bookings, enquiries, volunteer sign-up, public forms) call the **demonstration** API for that scenario's showcase workspace. They never call production.
- The production application keeps an optional **Public pages** capability (a simple profile and enquiry page) that is never part of mandatory onboarding. The full website builder used by the case studies is not part of the production product (unresolved decision U2).
- `/api/platform/showcase` is removed; the marketing site lists case studies from static content.

## 8. Authentication and sessions

| Element | Design |
|---|---|
| Session | Server-issued session id in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie, backed by a `sessions` table (revocable, 8-hour idle and 30-day absolute expiry). CSRF protection with a double-submit token header on state-changing requests. Replaces the JWT in `localStorage` (decision U5) |
| Google OAuth | Authorization Code flow with PKCE and a signed `state`, handled by the backend (`/api/auth/google/start`, `/api/auth/google/callback`). Verifies the ID token's signature, issuer, audience, expiry and `email_verified` |
| Account linking | A Google sign-in whose verified email matches an existing password account links only after the person enters that account's password once (prevents takeover through an unverified address). `oauth_identities` stores provider and subject |
| Password reset | Single-use tokens (hashed in `password_reset_tokens`), 30-minute expiry, identical response whether or not the email exists, revokes all sessions on use |
| Invitations | `invitations` table with hashed token, role, expiry (7 days); acceptance sets a password or uses Google |
| Email | `services/email.py` with an SMTP or HTTP-API provider chosen by configuration; in development, emails are written to the log |

## 9. Supporting services

| Service | Design |
|---|---|
| Background jobs | A `jobs` table and a separate worker process (`python -m app.worker`) polling with `SELECT ... FOR UPDATE SKIP LOCKED`. Jobs: alert rules on a schedule, Google Sheets sync, email, large exports, sandbox cleanup, retention. No new infrastructure (no Redis) |
| File storage | S3-compatible object storage behind `services/storage.py`; files recorded in a `files` table with `organization_id`; downloads via `/api/files/{id}`, which checks authorization then redirects to a short-lived signed URL. Local disk remains for development |
| AI | `services/ai.py` with a provider interface (no provider chosen, see U1). First feature: drafting a report narrative from the figures the report already contains, shown as an AI-drafted suggestion that a person must accept. Inputs are the report's aggregated figures only, never raw personal records |
| Health | `/api/health` checks the database and storage and returns 503 when either is unavailable |
| Logging | Structured JSON logs with request id, workspace id and user id; no passwords, tokens or form answers |

## 10. Data model changes and migrations

All migrations are additive except where marked.

| Migration | Change | Destructive? |
|---|---|---|
| M1 | `organizations.kind` with check constraint, default `customer` | No |
| M2 | `workspace_settings`, `workspace_option_lists`, `workspace_custom_fields`, `locations`; `extra` JSONB on module tables | No |
| M3 | `sessions`, `oauth_identities`, `password_reset_tokens`, `invitations` | No |
| M4 | `jobs`, `files` | No |
| M5 | `stock_moves.location_id`, `branch_sales` → location sales (copy data, keep old columns until verified) | No (two-step) |
| M6 | Data migration: delete the five legacy demo organizations and their records from production databases | **Yes**. Requires a `pg_dump` backup first; matches on the exact demo emails and a dry-run listing; reversible by restoring the dump |
| M7 | Drop `organizations.industry` default; keep the column for analytics | No |

Rollback: every migration has a downgrade; M6 is reversed only by restoring the backup taken immediately before it, which the runbook makes mandatory.

## 11. Frontend structure

```
frontend/                 (stride-web: marketing site + application, one build)
  src/marketing/          pages and copy from CONTENT_AND_DESIGN_SPEC.md
  src/app/                shell, capabilities, Tazama, settings
  src/design/             tokens, components (single source for both)
case-studies/             (six static sites, shared components, per-site content)
```

Large files are split as they are touched (`PublicSite.jsx` 948 lines, `routers/erp.py` 855 lines).

## 12. What is deliberately unchanged

FastAPI, PostgreSQL, SQLAlchemy, Alembic, React, Vite; the module engine; Tazama's data model and offline protocol; role model and permissions; audit log; rate limiting and upload checks; security headers; the test suites (extended, not replaced).
