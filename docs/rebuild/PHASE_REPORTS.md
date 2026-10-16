# Phase reports

## Phase 2 and Phase 3 part A (accounts and isolation), 16 October 2026

### Changed
- **Registration (D1 to D4):** one step (name, organization, work email, password); no industry, website address or palette. Rate limits count only abusive volumes and successful sign-ups. Validation errors are plain sentences naming the field. Password rules shown as a live checklist.
- **Onboarding:** a Welcome screen asks what to manage first and switches on those capabilities. Starter templates only when explicitly chosen (API).
- **Empty workspaces:** no records; Home shows next steps.
- **Sessions (U5):** opaque, revocable sessions in a `sessions` table; HttpOnly cookie plus CSRF cookie and `X-CSRF-Token` header for changes; API clients may send the token as a Bearer header. JWTs and browser token storage removed from the hosted application.
- **Sign-out** ends the server session before leaving the page; returning to the organization's website works again.
- **Password reset** by emailed single-use link (30 minutes), identical answer for unknown emails, all sessions revoked.
- **Invitations** by email with role; 7-day expiry; revocable; single use.
- **Show/Hide** on every password field. Form labels point at their control by id (accessibility fix).
- **Health (D5):** 503 when the database is unreachable.
- **Configuration:** `APP_MODE`; production refuses demo workspaces, `KEPT_TODAY` and the log email transport; empty settings such as `KEPT_TODAY=` are treated as unset.
- **Demo separation (D6, D9):** workspace `kind` with a database check constraint; production refuses non-customer workspaces at sign-in and on every request; `seed.py` refuses production and marks its workspaces as demo; showcase endpoint removed; website capability demonstration-only.
- **Naming:** user-facing "Kept" replaced by StrideFlow in the application.

### Migrations
- `a6d837160a96` (accounts): upgrade, downgrade, re-upgrade rehearsed on an empty database and on a copy of the existing one; `alembic check` clean.
- M6 `backend/scripts/remove_legacy_demo.py`: dry run lists exactly the five legacy demo workspaces; refuses without a backup from the last 24 hours; deletion cascaded every related table to zero; the backup restored all five.

### Results
| Check | Result |
|---|---|
| Backend pytest | 76 passed |
| `tests-e2e/real_backend.py` (browser, real API, fresh database) | 14 passed |
| Preview suites core_flows, case_studies, tazama | 21, 17, 10 passed |
| Frontend unit tests | 3 passed |
| Bandit | 0 issues, no suppressions |
| pip-audit, npm audit | no known vulnerabilities |
