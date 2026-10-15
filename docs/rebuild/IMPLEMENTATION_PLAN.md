# Implementation Plan

Phases follow the specification's Part 13. Each phase ends with a report: what changed, preserved, modified or deferred, migrations applied, tests and security checks run with actual results, configuration still needed, and known limitations.

Work is done on a branch per phase; `main` always passes the full test suite. Nothing is deleted from the current application until its replacement passes its acceptance tests.

## Phase 1: Audit and specification (this delivery)

Delivered: the six documents in `docs/rebuild/`. No code changed.

## Phase 2: Architecture confirmation and migration rehearsal

| Task | Depends on |
|---|---|
| Resolve decisions U1 to U8 (see `README.md` in this folder) | Owner |
| Write migrations M1 to M5 and M7; rehearse on a copy of the current database; write M6 with dry-run output | Approved architecture |
| Define the six demo scenario files and the electronics scenario's dataset | U4 |
| Draft the capability catalogue and onboarding questions | |

**Acceptance:** migrations upgrade and downgrade cleanly on a fresh database and on a copy of the current one; M6 dry run lists exactly the five legacy demo workspaces and nothing else.

## Phase 3: Neutral core, authentication and isolation

| Task | Notes |
|---|---|
| Repair registration defects D1 to D4 | Slug generation and server-side normalisation; rate limits that ignore validation failures; human-readable validation messages mapped to fields; password guidance shown before submission |
| Health check reflects the database (D5) | |
| Remove `seed.py` from production paths; add mode guards (D6) | |
| Neutral onboarding: capability selection replaces industry; optional templates | |
| Workspace settings, terminology, option lists, locations (M2) | Refactor reservations, branch sales, people, jobs to use them |
| Remove case-study values from `modules.json` | |
| Capability-driven dashboard, insights and reports (no industry branches) | |
| Empty states for every list and dashboard | |
| Sessions in HttpOnly cookies with CSRF (if U5 approved) | |
| Password visibility toggles everywhere | |
| Password reset, email service (development: log transport) | |
| Invitations by email | |
| Authorized file access and object storage interface (D7) | |
| Background worker: scheduled rules, emails, sheet sync (D8) | |
| Remove `/api/platform/showcase` (D9) | |
| Rename user-facing "Kept" to "StrideFlow"; migrate browser storage keys | |
| Apply the StrideFlow design tokens to the application | |

**Acceptance:**
1. A new registration (email and password) creates a workspace with zero business records in every module, verified by an automated test that counts rows per table.
2. Registration succeeds for organization names of 2 and 160 characters, and for names whose generated address would exceed 40 characters.
3. Three failed registrations followed by a valid one from the same IP succeed.
4. Every validation error returned by the registration and sign-in endpoints has a human-readable message and a field name.
5. `/api/health` returns 503 with the database stopped.
6. Password reset: link works once, expires after 30 minutes, does not reveal whether an email exists, and signs out other sessions.
7. Invitation: invited person sets a password and lands in the right workspace with the invited role; an expired invitation fails with a clear message.
8. Every password field has a working show/hide control operable by keyboard.
9. A workspace that enables only Projects and Tazama sees no inventory, funding, bookings or participant language anywhere.
10. Cross-workspace tests pass for every list, detail, export, search, report, file and Tazama endpoint.
11. All existing backend tests pass (updated only where behaviour intentionally changed, with the change noted).

## Phase 4: Demonstrations

| Task | Notes |
|---|---|
| Demo mode, scenario loader, per-visitor sandboxes, reset, expiry job | Architecture Plan section 6 |
| Six scenarios, including the electronics business (multiple branches, consolidated reporting, stock availability by branch, procurement, deliveries, expenses, approvals) | |
| Demo banner, simulated-integration labels, role switcher limited to demo users | |
| Browser test per scenario | |

**Acceptance (for each of the six):**
1. Opening the demo loads the scenario's data and dashboard within 5 seconds.
2. At least one end-to-end workflow completes and is visible in the related list, dashboard figure and report. Examples: Timiza, a field submission appears in the live tracker and the outreach report; Hatua, a transfer changes stock in both branches; electronics, a purchase request is approved, ordered, received and raises branch stock; Pwani, a reservation changes tonight's occupancy; Mwangaza, a job moves from review to delivered and its invoice is raised; Tumaini, a task completed with evidence moves project progress.
3. Changes in one visitor's sandbox are invisible to a second visitor.
4. Reset restores the initial state; running it 10 times in a row leaves production row counts unchanged.
5. Demo users cannot reach administrative platform functions.
6. With `APP_MODE=production`, demo endpoints return 404 and the loader refuses to run.

## Phase 5: Marketing website and case-study websites

| Task | Notes |
|---|---|
| StrideFlow marketing pages with approved copy | CONTENT_AND_DESIGN_SPEC.md section 4 |
| Six case-study sites as separate builds wired to their demo workspaces | |
| Timiza: re-audit the live site, collect original assets, mark unconfirmed facts | |

**Acceptance:** every page passes an automated accessibility scan (axe) with no serious violations; no page scrolls horizontally at 360 px; no bracketed placeholder text ships; every interactive feature on a case-study site writes only to the demonstration environment (verified by a test against production returning nothing); no case-study name appears in the production application's code paths other than the demo scenario files.

## Phase 6: Integrations and security hardening

| Task | Notes |
|---|---|
| Google OAuth (start, callback, linking) | Real credentials needed to test live |
| AI service and the report-narrative feature | Provider decision U1 |
| Email provider configuration | |
| Object storage configuration | |
| Row-level security on tenant tables | S12 |
| Rate limiter state in PostgreSQL | S7 |
| Structured logging, CI with Bandit, pip-audit, npm audit | S10, S15 |
| Backup and restore runbook, tested restore | S16 |
| Separate database roles for migrations and runtime | S17 |

**Acceptance:** OAuth tests from SECURITY_REVIEW.md section 5 pass against a local provider stub, and a live sign-in succeeds with real credentials (reported as untested if credentials are not provided); AI calls send only aggregated report figures (verified by a test that inspects the outbound payload) and fail gracefully on timeout; CI runs all scanners on every push; a backup is restored into an empty database and the application starts against it.

## Phase 7: Final verification

Run all suites (backend, frontend unit, browser flows for the application, every demo and every website), production build checks and scanners. Produce a completion matrix covering every requirement in PRODUCT_REQUIREMENTS.md with one of: verified, incomplete, deferred (with reason), blocked (with what is needed).

## Estimated size

| Phase | Relative size |
|---|---|
| 2 | Small |
| 3 | Large (largest) |
| 4 | Large |
| 5 | Medium to large |
| 6 | Medium |
| 7 | Small to medium |
