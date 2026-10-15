# Security review: Kept ERP

Scope: FastAPI API, PostgreSQL schema, React frontend, public website and donation flow. Reviewed as an attacker would approach it, then tested.

## Threat model (what could go wrong, and what stops it)

| Threat | Example attack | Control | Evidence |
|---|---|---|---|
| Account takeover by guessing | Password spraying, brute force | 10+ character policy, common and personal passwords rejected, 5 failures lock the account for 15 minutes, per-IP and per-email rate limits, lockouts audited | `test_weak_and_personal_passwords_rejected`, `test_account_locks_after_five_failures_and_logs_it` |
| User enumeration | Comparing error messages or timing for real vs fake emails | Identical message and status; password hash verified even for unknown emails | `test_unknown_email_and_wrong_password_look_identical` |
| Token forgery | Editing the JWT role, `alg: none`, expired tokens | HS256 pinned, `exp` and `sub` required, signature checked, secret must be 32+ random chars in production (app refuses to start otherwise) | `test_tampered_and_unsigned_tokens_rejected` |
| Stolen or stale sessions | Old token after a password change, role change or removal | Token version claim: password change, "sign out everywhere", role change and deactivation revoke every issued token immediately | `test_password_change_signs_out_other_sessions`, `test_role_change_takes_effect_immediately` |
| Privilege escalation | Member promotes self, viewer edits | Roles enforced in the API on every route, never only in the UI; admins cannot remove their own admin access | `test_roles_enforced_by_backend`, `test_privilege_escalation_blocked`, `test_members_only_work_on_their_own_activities` |
| Cross-organization access (IDOR) | Guessing another organization's record ids | Every query is scoped to the caller's organization; foreign ids return 404, not 403; references to other organizations' records are rejected | `test_organizations_are_isolated`, `test_permissions_and_isolation`, `test_forms_validation_and_public_access` |
| Mass assignment | Posting `organization_id`, `created_by_id`, `provider_ref` | Only fields declared in the module spec are accepted; system fields are hidden and server-set | `test_mass_assignment_ignored` |
| SQL injection | `' OR 1=1 --` in search | SQLAlchemy parameterised queries only; no string-built SQL | `test_sql_injection_payloads_are_inert`, Bandit: no issues |
| Stored XSS | `<script>` in a name, `javascript:` file links | React escapes all text; no `innerHTML` anywhere; file fields only accept URLs this API generated | `test_stored_script_is_kept_as_text_and_links_are_not_accepted` |
| Malicious uploads | `.exe` renamed to `.jpg`, HTML in `.txt`, path traversal | Allow-list of types, magic-byte check that content matches extension, 10 MB cap, random 128-bit names, strict filename route, `nosniff`, sandbox CSP, non-images forced to download | `test_upload_content_must_match_extension` |
| Spam and abuse of public forms | Bots flooding volunteer, inquiry, donation and survey endpoints | Per-IP rate limits, hidden honeypot field, length limits, validation | `test_public_forms_are_rate_limited_and_honeypot_drops_bots` |
| Donation fraud | Confirming an unpaid donation, enumerating donations, forged M-Pesa callbacks, amount tampering | Status lookup needs the receipt reference; simulator only exists in sandbox mode; callback URL carries a secret compared in constant time; amount from Safaricom must match; settled donations cannot change | `test_donation_flow_sandbox`, `test_mpesa_callback_needs_secret_token` |
| Server-side request forgery | Pointing the Google Sheets sync at an internal address (cloud metadata, localhost) | Only `https://docs.google.com/spreadsheets/...` links are accepted, rewritten to Google's CSV export URL, redirects limited to Google hosts, 15 s timeout, 5 MB cap, sync rate-limited | `test_sheet_link_cannot_be_used_to_reach_other_hosts`, `test_sheet_sync_imports_new_rows_once` |
| Duplicate or replayed field data | A phone retrying after a dropped connection, a sheet synced twice | Every device response carries a client id; imports and sheet rows are fingerprinted; repeats are recognised and not stored twice | `test_location_and_offline_retries_are_safe`, `test_import_saves_valid_rows_reports_the_rest_and_ignores_repeats` |
| Clickjacking and content sniffing | Framing the app | `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff` on API and site | `test_security_headers_present`, `frontend/vercel.json` |
| Oversized requests | Memory exhaustion | 12 MB request cap, bounded reads, paginated lists | middleware `BodySizeLimit` |
| Information leakage | Stack traces in errors | Generic 500 handler; details only in server logs | `main.py` |
| Repudiation | "I never approved that" | Audit log of sign-ins, failures, lockouts, approvals and every change, including automatic rule actions | Settings → Audit log |
| Personal data | Survivor or participant identities | Participant registry has no names; referral logs record counts only; consent field required | module spec, seed data |

## Scans (13 Oct 2026)

| Tool | Target | Result |
|---|---|---|
| Bandit | `backend/app` | No issues identified |
| pip-audit | `backend/requirements.txt` | No known vulnerabilities (PyJWT upgraded 2.7.0 → 2.15.1 to close 16 advisories) |
| npm audit | `frontend` (all dependencies) | 0 vulnerabilities (react-router-dom 6.28 → 7.18.4, vite 5 → 6.4.4, vitest 2 → 4.1.11) |
| pytest | 56 tests, 18 of them security tests | All pass |

## Residual risks and next steps

1. **Token storage.** The JWT sits in `localStorage`. CSP, React escaping and no `innerHTML` keep the XSS surface very small, but an httpOnly, SameSite=Strict cookie with CSRF tokens is stronger. Recommended before handling real survivor data.
2. **Rate limits are per process.** Move counters to Redis if the API runs on more than one instance.
3. **Uploaded files** are served by unguessable URL without a sign-in check. Use signed, expiring URLs or object storage (S3 or Cloudinary) for sensitive documents. Render's free disk is also wiped on redeploy.
4. **Two-factor sign-in** for admins and finance roles (TOTP).
5. **Card payments** run in sandbox. For live cards, integrate a PCI-compliant provider (Pesapal, Flutterwave, Stripe) with hosted checkout, so card numbers never touch this server.
6. **Backups and data retention**: enable daily PostgreSQL backups on Render, and agree a retention period with the organization under Kenya's Data Protection Act 2019.

## Production checklist

- `ENVIRONMENT=production`, random `JWT_SECRET` (the app refuses weak values), `CORS_ORIGINS` set to the Vercel domain only, `KEPT_TODAY` unset.
- `PAYMENTS_MODE=mpesa` with Daraja keys, `MPESA_CALLBACK_TOKEN` set to a long random string, and the callback URL ending in that token.
- HTTPS only (Render and Vercel do this by default).
