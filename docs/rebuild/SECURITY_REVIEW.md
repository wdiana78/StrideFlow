# Security Review

Risk-based review of the existing code, organized by the OWASP Top 10 (2021) and the specification's Part 11 checklist. This is a code review with automated scanning. **No penetration test has been performed.** Scanner results do not prove the system is secure.

## 1. Commands run (15 October 2026)

| Command | Result |
|---|---|
| `bandit -r backend/app -q` | No issues reported (two earlier SHA-1 findings were fixed by marking non-security fingerprints `usedforsecurity=False`) |
| `pip-audit -r backend/requirements.txt` | No known vulnerabilities |
| `npm audit` (frontend) | 0 vulnerabilities |
| `pytest -q` (includes 16 security tests and 7 tracking tests) | 58 passed |
| Registration abuse and validation probes against the real API | See findings S1 and S2 |
| API start with an unreachable database | See finding S9 |

## 2. Existing controls (verified by tests)

| Control | Test |
|---|---|
| Password policy (length, character classes, common and personal passwords) | `test_weak_and_personal_passwords_rejected` |
| Lockout after 5 failed sign-ins, logged | `test_account_locks_after_five_failures_and_logs_it` |
| Identical response for unknown email and wrong password | `test_unknown_email_and_wrong_password_look_identical` |
| Tampered, unsigned (`alg: none`) and expired tokens rejected | `test_tampered_and_unsigned_tokens_rejected` |
| Sessions revoked on password change and role change | `test_password_change_signs_out_other_sessions`, `test_role_change_takes_effect_immediately` |
| No privilege escalation by members | `test_privilege_escalation_blocked` |
| Cross-workspace access returns 404 | `test_organizations_are_isolated`, `test_permissions_and_isolation`, form tests |
| Mass assignment ignored | `test_mass_assignment_ignored` |
| SQL injection payloads inert | `test_sql_injection_payloads_are_inert` |
| Stored script kept as text; `javascript:` and external file links refused | `test_stored_script_is_kept_as_text_and_links_are_not_accepted` |
| Upload type checked by content (magic bytes), path traversal refused | `test_upload_content_must_match_extension` |
| Rate limits and honeypots on public forms | `test_public_forms_are_rate_limited_and_honeypot_drops_bots` |
| Donation status needs the receipt reference; sandbox-only simulator; M-Pesa callback secret | `test_donation_flow_sandbox`, `test_mpesa_callback_needs_secret_token` |
| Google Sheets link restricted to `docs.google.com` spreadsheets (SSRF) | `test_sheet_link_cannot_be_used_to_reach_other_hosts` |
| Order tracking requires the matching phone number | `test_retail_order_can_be_tracked_only_with_the_matching_phone` |
| Security headers (CSP, HSTS, frame denial, no-sniff) | `test_security_headers_present` |
| Production refuses weak JWT secret, wildcard CORS and `KEPT_TODAY` | `config.get_settings()` (not covered by a test) |

## 3. Findings

| Id | Area (OWASP) | Finding | Risk | Recommendation | Phase |
|---|---|---|---|---|---|
| S1 | Identification and authentication (A07) | Failed registrations count towards a 5-per-hour IP limit; legitimate users are locked out, and users behind one NAT share the limit | High (availability of sign-up) | Count only successful registrations per IP and add a per-email limit; apply a separate, higher limit to failed attempts | 3 |
| S2 | A07 | No password reset; no Google OAuth; no email verification | High (requirement gap) | Implement per Architecture Plan section 8 | 3, 6 |
| S3 | Cryptographic failures and XSS impact (A02, A03) | Session JWT stored in `localStorage`; any XSS can read it | Medium | HttpOnly cookie sessions with CSRF tokens (decision U5). Until then keep CSP strict and avoid `innerHTML` (none exists today) | 3 |
| S4 | Broken access control (A01) | `/files/{name}` serves uploads without authentication or workspace check | Medium | Authorized `/api/files/{id}` with signed object-storage URLs; files table with `organization_id` | 3 |
| S5 | A01 and privacy | `/api/platform/showcase` publishes the name, slug and brand of every workspace with website settings | Medium | Remove; list case studies from static content | 3 |
| S6 | Security misconfiguration (A05) | Production deployment instructions include `python seed.py`, which creates demo workspaces with the shared password `kept-demo-2026` | High | Separate demo environment; seed refuses production mode; data migration M6 removes legacy demo workspaces | 2, 3 |
| S7 | A05 | Rate limiter is in memory; limits reset on restart and are not shared across instances | Low now, Medium when scaled | Move counters to PostgreSQL (or Redis if added) | 6 |
| S8 | Insecure design (A04) | Rules evaluated synchronously in `/api/dashboard`; a large workspace can make dashboard requests slow enough to exhaust workers | Medium | Background worker with scheduled evaluation | 3 |
| S9 | Logging and monitoring (A09) | `/api/health` returns `ok` when the database is down; generic 500s hide outages | Medium | Health checks dependencies and returns 503; structured logs with request ids | 3 |
| S10 | A09 | Logs are unstructured; no alerting on repeated lockouts or 5xx rates | Low | Structured JSON logs; document alert thresholds for the host | 6 |
| S11 | Software and data integrity (A08) | The preview build bundles a full copy of the API and demo data into a public HTML file | Low (no secrets inside) | Retire after server demos exist (decision U3) | 4 |
| S12 | A01 | Workspace isolation relies on application code in every query (well tested, but one missed filter leaks data) | Medium | Add PostgreSQL row-level security on tenant tables as defence in depth; add an automated test that calls every list endpoint with a foreign workspace | 6 |
| S13 | Privacy | No data retention or workspace export/deletion workflow | Medium (legal) | Retention per Tazama form; workspace export; owner-initiated deletion with a grace period | 6 |
| S14 | AI (planned) | No AI integration exists yet; when added it could disclose customer data to a provider | n/a now | Server-side only; send aggregated figures, not raw records; per-workspace opt-in; log metadata, not content | 6 |
| S15 | Supply chain | Dependencies pinned and scanned; no automated scanning in CI | Low | Add Bandit, pip-audit and npm audit to CI | 6 |
| S16 | Backup and recovery | No documented backup, restore or recovery procedure | Medium | Daily automated PostgreSQL backups, tested restore, runbook | 6 |
| S17 | Database privileges | The application connects as the database owner (can drop tables) | Low | Separate migration role (owner) and runtime role (data read/write only) | 6 |

## 4. Not applicable or acceptable as is

- **CSRF**: not exploitable today because authentication is a bearer header, not a cookie. Becomes required if S3 is adopted, and is part of that design.
- **CORS**: explicit origins only; credentials not allowed; wildcard refused in production.
- **Injection**: SQLAlchemy parameterised queries throughout; no string-built SQL found.

## 5. Verification required before release

1. Automated cross-workspace test across every list, detail, export, search, report, file and Tazama endpoint (S12).
2. OAuth tests: state mismatch, replayed code, wrong audience, unverified email, linking to an existing account without its password.
3. Password reset tests: token reuse, expiry, enumeration resistance, session revocation.
4. Demo isolation tests: production mode refuses demo endpoints and demo workspaces; reset never touches production; sandbox A cannot reach sandbox B.
5. File access tests: another workspace's file id returns 404; expired signed URLs fail.
6. Scans clean in CI; findings investigated and documented rather than suppressed.

## 6. External configuration that cannot be verified here

Google OAuth client and consent screen, email provider, object storage bucket and keys, M-Pesa Daraja credentials, AI provider key, production database backups. Each will be documented with exact settings in Phase 6, and reported as untested until real credentials are used.
