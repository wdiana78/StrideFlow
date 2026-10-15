# Product Requirements: StrideFlow

## 1. Product definition

**StrideFlow** is a general-purpose operations management platform, sold by subscription, that lets a business or organization run its day-to-day work in one place: projects and tasks, field data collection, approvals and spending, stock across locations, deliveries, bookings, customers and invoicing, documents, and reporting. Customers switch on the capabilities they need. Nothing about the product assumes a particular industry.

### 1.1 Product boundaries

| In scope | Out of scope for the initial release |
|---|---|
| The StrideFlow marketing website | A website builder for customers (see decision U2) |
| The authenticated application for any eligible customer | Double-entry accounting, payroll, tax filing |
| Optional starter templates a customer explicitly adopts | Point-of-sale hardware integration |
| Six independent case-study websites (separate deliverable) | Native mobile apps (the web app is responsive and works offline for field data) |
| Six interactive demonstrations (separate environment) | Hotel channel managers, social network publishing |

### 1.2 Users

| Persona | Needs |
|---|---|
| Owner or administrator | Set up the workspace, invite people, choose capabilities, control permissions, see the audit trail |
| Manager | Plan and assign work, approve spending and requests, see performance across locations, issue reports |
| Team member or field staff | See their own work, record progress and evidence, collect data on a phone (including offline), raise requests |
| Read-only stakeholder (board, partner, auditor) | See results, finances and reports without changing anything |
| Prospective customer | Understand the product quickly, try a demonstration, choose a plan, sign up |

## 2. Requirements

Priorities: **M** must have for the rebuild, **S** should have, **C** could have.

### 2.1 Accounts and access (A)

| Id | Requirement | Priority |
|---|---|---|
| A1 | Register with email and password; the workspace and its owner are created in one step | M |
| A2 | Register and sign in with Google (real OAuth, server-side), with safe linking to an existing account | M |
| A3 | Password visibility toggle on every password field (sign-in, registration, password change, reset) | M |
| A4 | Password reset by email with single-use, expiring links | M |
| A5 | Sign out; sign out on all devices; sessions expire and can be revoked | M |
| A6 | Invite people by email with a role; invitations expire and can be revoked | M |
| A7 | Roles: Owner/Administrator, Manager, Member, Read-only; enforced on the server for every request | M |
| A8 | Clear, specific validation messages; no raw framework errors shown to users | M |
| A9 | Registration is not blocked by previous validation mistakes (rate limits count only abusive patterns) | M |

### 2.2 Workspace and onboarding (W)

| Id | Requirement | Priority |
|---|---|---|
| W1 | New workspaces contain no business records | M |
| W2 | Onboarding asks what the customer wants to manage and enables those capabilities; no industry is assumed | M |
| W3 | Optional starter templates are previewed and adopted only by explicit choice, and are labelled as templates | S |
| W4 | Every list and dashboard has a useful empty state with one relevant next action | M |
| W5 | Workspace settings: name, logo, currency, time zone, terminology overrides, option lists, custom fields | M (custom fields S) |
| W6 | Locations (branches, sites, warehouses, venues) usable by every capability that needs them | M |

### 2.3 Core capabilities (C)

| Id | Requirement | Priority |
|---|---|---|
| C1 | Projects with goals or targets, deadlines, owners and progress | M |
| C2 | Tasks with assignees, due dates, priorities, dependencies, status and evidence | M |
| C3 | Configurable records (the module engine) with validation, relationships, workflow states and permissions | M |
| C4 | Approvals with routing rules, no self-approval, receipts where required, one inbox | M |
| C5 | Alerts for overdue, due soon, blocked, over budget, low stock, expiring documents, approvals waiting; ownership and resolution | M |
| C6 | Calendar of deadlines, events, bookings and leave | M |
| C7 | Search across enabled capabilities | M |
| C8 | Dashboards that show only enabled capabilities | M |
| C9 | Reports generated from records, frozen when issued, exportable to PDF and CSV | M |
| C10 | CSV export of every list; CSV import for records and field data | M (general import S) |
| C11 | Audit history of every change and administrative action | M |
| C12 | Notifications in the application, and by email for invitations, resets and approvals | M (email for approvals S) |

### 2.4 Field data collection, Tazama (F)

| Id | Requirement | Priority |
|---|---|---|
| F1 | Form builder with at least ten question types, required fields, validation and skip logic | M |
| F2 | GPS, photo and file answers | M (file S) |
| F3 | Offline collection with a reliable queue and duplicate protection | M |
| F4 | Assign forms to people or teams; collectors see their assigned forms | S |
| F5 | Live tracker: today, period, target, collectors, map, breakdown, latest responses | M |
| F6 | Review and correction: mark responses reviewed, request correction, edit with history | S |
| F7 | Analytics per question with filtering; CSV export with location | M |
| F8 | CSV import; Google Sheets sync when configured | M |
| F9 | Public form links with abuse protection | M |
| F10 | Retention setting per form (keep for N months, then delete or anonymise) | C |

### 2.5 Specialist capabilities (optional per workspace) (S)

Procurement and suppliers; inventory with per-location stock and transfers; deliveries with proof of delivery; budgets and expenses; customers and invoicing; bookings and resources with availability; jobs and deliverables; content calendar; people register and leave; events with attendance forms; documents and contracts with expiry; governance (meetings and decisions); funding and donations; participant registry. Each is **M** to preserve as it exists today and **S** for the improvements listed in the Feature Audit.

### 2.6 AI (I)

| Id | Requirement | Priority |
|---|---|---|
| I1 | Provider-configurable AI service using server-side credentials only | S |
| I2 | First use: draft a narrative for an issued report from its aggregated figures; clearly labelled as an AI draft; never saved without a person accepting it | S |
| I3 | Respect permissions and workspace isolation; send no raw personal data; handle timeouts, rate limits and provider errors | M (if I1 is built) |

### 2.7 Marketing website (P)

| Id | Requirement | Priority |
|---|---|---|
| P1 | Pages: Home, Product, Solutions, Case studies, Pricing, Security, About, Contact, Demo access, Sign in, Get started, Privacy, Terms | M |
| P2 | Copy from CONTENT_AND_DESIGN_SPEC.md; no invented customers, results, team or history | M |
| P3 | Case-study section linking to the six websites and demonstrations, clearly described as illustrative | M |

### 2.8 Case-study websites (CS) and demonstrations (D)

| Id | Requirement | Priority |
|---|---|---|
| CS1 | Six separate websites: Timiza, Tumaini, Hatua Apparel, Mwangaza, Pwani, nationwide electronics business | M |
| CS2 | Timiza's site refines timiza.vercel.app; unknown facts marked "to be confirmed" | M |
| CS3 | Websites never call production and never shape production defaults | M |
| D1 | Six demonstrations on the same application, each with realistic, consistent data and complete workflows | M |
| D2 | Per-visitor isolation, a reset that never touches production, persistent demo labelling | M |
| D3 | Simulated integrations labelled as simulated | M |

### 2.9 Quality (Q)

| Id | Requirement | Priority |
|---|---|---|
| Q1 | Works on phones (from 360 px wide) and desktops; no horizontal scrolling | M |
| Q2 | Keyboard operable; visible focus; labelled controls; contrast to WCAG 2.2 AA | M |
| Q3 | Light and dark modes with tested contrast | M |
| Q4 | Every visible button performs its action or is disabled with an explanation | M |
| Q5 | Destructive actions confirm first | M |

## 3. Non-functional requirements

- **Isolation**: no path (ids, URLs, filters, exports, attachments, jobs, reports, search, AI) returns another workspace's data.
- **Performance**: list pages respond in under 500 ms at the 95th percentile with 50,000 records per module per workspace; dashboards under 1 s.
- **Availability**: health endpoint reflects database and storage status.
- **Data protection**: aligned with Kenya's Data Protection Act 2019; export and deletion of a workspace's data on request.
- **Security**: see SECURITY_REVIEW.md.
