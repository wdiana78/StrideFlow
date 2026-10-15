# Content and Design Specification

## 1. Brand

**Name:** StrideFlow (capital S and F; never "Strideflow", "Stride Flow" or "StrideFlo").
**Positioning line:** Operations software for teams that get things done.
**Personality:** capable, calm, precise, warm. Writes like a good operations manager: concrete, brief, no hype.
**Distinct from customers:** StrideFlow's colours, type and voice appear on StrideFlow's own pages and in the application chrome. Customers' brands appear only in their logo, workspace name and (optionally) one accent colour.

### 1.1 Colour system (contrast measured, WCAG 2.2)

| Token | Light | Dark | Use | Measured contrast |
|---|---|---|---|---|
| Primary (Purple 600) | `#5B34C9` | `#B39CFF` (Purple 300) | Primary buttons, links, focus rings, active navigation, the main chart series | 7.56:1 with white text; 7.27:1 on dark surface |
| Primary strong (Purple 700) | `#4A27A8` | `#CBBBFF` | Hover and pressed states, text on tint | 8.66:1 on Purple 50 |
| Primary tint (Purple 50) | `#F3EFFE` | `#2A2340` | Selected rows, active navigation background, soft fills | |
| Secondary (Maroon 700) | `#7E1F3F` | `#F08FAE` (Maroon 300) | Sparingly: secondary emphasis, the marketing site's accent band, the second chart series, badges for "Owner" | 9.75:1 with white text; 7.37:1 on dark surface |
| Secondary tint (Maroon 50) | `#FBEFF3` | `#3A1C28` | Background for maroon emphasis | 8.70:1 with Maroon 700 text |
| Canvas | `#FAF8FC` | `#16121F` | Page background (warm, not pure white or black) | |
| Surface | `#FFFFFF` | `#201B2C` | Cards, panels, tables | |
| Ink | `#1D1828` | `#F2EFF8` | Body text and headings | 16.4:1 |
| Muted | `#5F5970` | `#B6AEC8` | Secondary text, labels | 6.67:1 on white; 7.87:1 on dark surface |
| Border | `#E7E3EE` (decorative), `#8C859C` (inputs) | `#352E45`, `#6E6684` | Dividers; input outlines | Input border 3.53:1 (meets 3:1 non-text) |
| Success | `#067647` | `#47CD89` | On track, completed, paid | 5.69:1 |
| Warning | `#B54708` | `#FDB022` | At risk, due soon, low stock | 5.43:1 |
| Danger | `#B42318` | `#F97066` | Overdue, failed, destructive actions | 6.57:1 |
| Information | `#175CD3` | `#84ADFF` | Neutral notices | |

Rules: purple carries action and selection; maroon is an accent used in at most one element per view; status colours carry meaning only alongside text or an icon; no gradients in the application; one restrained gradient (purple to maroon) is allowed in the marketing hero only. Dark mode uses deep aubergine surfaces, never pure black.

### 1.2 Typography

- **Inter** for interface and marketing (weights 400, 500, 600, 700), tabular figures for numbers.
- Scale: 12, 13, 14 (body in dense tables), 15 (default body), 17, 20, 24, 30, 38, 48 (marketing hero only).
- Headings in sentence case. Line length 60 to 75 characters for prose.

### 1.3 Shape, space and elevation

- 4-point spacing grid; page gutters 24 px (desktop) and 16 px (mobile).
- Radius 8 px for inputs and buttons, 12 px for panels; no fully rounded cards.
- Two elevations only: resting (1 px border, no shadow) and raised (menus, dialogs: soft shadow).
- Icons: one line-icon set (1.75 px stroke), 16 and 20 px. No emoji in the interface.

## 2. Interface principles

1. **Information first.** Tables and lists are the default for operational data; cards only where the content is visual or summary-level.
2. **One primary action per screen**, placed top right of the page header.
3. **Every number links to its source** (a KPI opens the filtered list behind it).
4. **Empty states teach the next step**: one sentence on what the screen is for and one button. No illustrations that carry no information.
5. **Status in words and colour**: "Overdue · 3 days", never colour alone.
6. **Confirm destructive actions** in a dialog that names the record and consequences.
7. **Forms validate inline** with messages that say how to fix the problem.
8. **No decorative controls**: a button either works or is disabled with a tooltip explaining why.
9. **Responsive by design**: the sidebar collapses below 960 px; tables become stacked rows below 640 px; nothing scrolls horizontally except wide tables inside their own container.
10. **Accessible by default**: visible focus ring (2 px Purple 600 with offset), labels on every control, keyboard operation of menus, dialogs and drag-and-drop alternatives.

## 3. Information architecture

### 3.1 Marketing website

| Page | Purpose | Primary action |
|---|---|---|
| Home | What StrideFlow does, for whom, why it is different | Start free trial / Book a demo |
| Product | Capabilities in depth, grouped by job | Try a demo |
| Solutions | Uses by operating model (not industry) | Try the matching demo |
| Case studies | Six illustrative organizations, their websites and demos | Open a demo |
| Pricing | Plans, what is included, FAQ about billing | Start free trial |
| Security | How data is protected and isolated | Contact us |
| About | Purpose, approach, background (no invented team or history) | Contact |
| Contact | Sales, support, demo requests | Send message |
| Demo access | Choose one of six demonstrations | Open demo |
| Sign in, Get started | Authentication | |
| Privacy policy, Terms of service | Legal (require legal review before publication) | |

### 3.2 Application navigation

Sidebar (left), top bar (search, notifications, help, account). Sidebar groups, showing only enabled capabilities:

- **Overview**: Home, Alerts, Approvals, Calendar
- **Work**: Projects, Tasks, Reports
- **Field data**: Tazama (forms, live tracker)
- **Operations**: one entry per enabled capability (Inventory, Procurement, Deliveries, Bookings, Customers and invoicing, Jobs, People, Documents ...)
- **Workspace**: Locations, Team, Capabilities, Settings, My account

Terminology overrides rename items (for example Projects to Programmes) without changing behaviour.

## 4. Approved copy

### 4.1 Home

**Headline:** Run your operations from one place.

**Subheading:** StrideFlow brings projects, field data, approvals, stock, deliveries, bookings and reporting into one system your whole team can use, in the office or in the field.

**Primary actions:** Start free trial · Try a live demo

**Proof strip (factual, no invented customers):** Works offline in the field · Multi-location by design · Approvals with an audit trail · Your data, separated from everyone else's

**Section: The problem**
> Most growing organizations run on spreadsheets, shared folders and message threads. Work gets done, but nobody can see all of it: which tasks are late, what was spent and approved, where the stock is, what the field team collected yesterday. Reports take days because the evidence has to be found before it can be counted.

**Section: What changes with StrideFlow** (three columns)
- **See the work as it happens.** Tasks, field submissions, stock movements and bookings update the moment they are recorded. Alerts flag what is overdue, over budget or running low.
- **Control spending and requests.** Expenses, purchase requests and leave follow approval routes with receipts attached. Nobody approves their own request, and every decision is recorded.
- **Report from the record.** Reports are built from the data your team has already entered, with the evidence behind each figure, so they take minutes and stand up to questions.

**Section: Built for the way you work**
> Switch on only the capabilities you need. A field team, a chain of shops, a studio and a hotel can use StrideFlow without adopting each other's vocabulary.

**Closing call to action:** Start with one team and one process. Add the rest when you are ready. · Start free trial

### 4.2 Product (capability descriptions)

- **Projects and tasks.** Plan work with owners, deadlines, priorities and dependencies. Track progress against targets and see what is at risk before it slips.
- **Tazama field data.** Build forms with skip logic, GPS and photos. Collect on any phone, even without signal; responses sync when the connection returns, and a live tracker shows progress by person, place and day.
- **Approvals and spending.** Route expenses, purchases and leave to the right approver, require receipts, and compare spending with budgets.
- **Inventory across locations.** Track stock by branch, warehouse or site, move it between locations with a clear hand-over, and get warned before it runs out.
- **Procurement.** Raise purchase requests, compare suppliers, approve, order and receive in one flow.
- **Deliveries.** Follow each delivery from dispatch to doorstep, with rider check-ins and proof of delivery.
- **Bookings and resources.** Manage rooms, venues, vehicles and equipment with availability checks that prevent double-booking.
- **Customers and invoicing.** Keep customer records, issue invoices and see what is overdue.
- **Jobs and deliverables.** Move client work from brief to delivery, including review rounds and approvals.
- **Documents and contracts.** Store agreements and certificates, and get reminded before they expire.
- **Reports and insights.** Dashboards for each capability, reports frozen at the moment of issue, and exports to CSV and PDF.
- **Audit and permissions.** Four roles, server-side permission checks and a complete history of changes.

### 4.3 Solutions (by operating model)

| Heading | Copy |
|---|---|
| Teams with people in the field | Collect data, evidence and check-ins from anywhere, and see them on a live map the same day. |
| Multi-location operations | Compare branches against targets, move stock between sites and keep one consolidated view. |
| Client and project work | Run each engagement from brief to delivery with clear owners, review rounds and invoices. |
| Service and booking businesses | Take bookings for rooms, tables, tours or equipment and run the day from one schedule. |
| Programme-based organizations | Track targets, activities and evidence, and produce reports from the record. |

### 4.4 Case studies introduction

> **See StrideFlow in action.** The six organizations below are illustrative case studies built to show how one platform supports very different work. Each has its own website and a live demonstration you can explore and reset. Their names, figures and records are examples, not customer endorsements.

### 4.5 Pricing (structure; amounts require the owner's decision, U8)

Three plans, monthly or annual: **Team** (up to 10 users, core capabilities), **Business** (up to 50 users, all capabilities, field data without limits), **Enterprise** (custom limits, single sign-on, service-level agreement). A 14-day trial without payment details. Discount for registered non-profits, if offered.

### 4.6 FAQ (prospective customers)

1. **What does StrideFlow replace?** The spreadsheets, shared drives, paper forms and message threads used to plan work, record activity, approve spending and produce reports.
2. **Do we have to use every capability?** No. Switch on what you need and add more later. Your data stays when a capability is switched off.
3. **Can we bring our existing data?** Yes. Field data imports from CSV and Google Sheets today; general record import is planned [confirm before launch].
4. **Does it work without internet?** Field forms work offline on a phone once opened, and sync automatically when the signal returns. The rest of the application needs a connection.
5. **Who can see what?** Each person has a role (owner or administrator, manager, member, read-only). Permissions are checked on the server for every request.
6. **How is our data separated from other customers?** Every record belongs to one workspace, and every request is checked against the workspace of the person making it.
7. **Can we sign in with Google?** Yes [available after Phase 6].
8. **What happens to our data if we cancel?** You can export it as CSV at any time. After cancellation it is deleted after a stated retention period [period requires decision].
9. **Is there support during setup?** [Requires the owner's support offer.]
10. **What does StrideFlow not do yet?** It does not replace accounting software or payroll, and it has no native mobile app; the web app works on phones.

Bracketed notes must be resolved before publication; the page must not ship with them.

### 4.7 About (draft; facts to confirm)

> StrideFlow is operations software built in Nairobi for organizations that need to see their work clearly without buying an enterprise system. It started from a simple observation: most teams already record what they do, in spreadsheets, forms and messages, but cannot turn those records into decisions. StrideFlow's approach is to make recording the work and reporting on it the same activity.

Background details (founder, company, history) are left out until the owner confirms what may be published.

## 5. Case-study website direction

| Site | Direction |
|---|---|
| Timiza Youth Initiative | Refine timiza.vercel.app: keep its blue and red identity, Inter, structure and copy; improve hierarchy, spacing, accessibility and imagery. Sections: programmes, projects, achievements and impact (only confirmed figures; otherwise "to be confirmed"), about, updates, gallery, partners, contact, donate, volunteer |
| Tumaini Community Network | Warm, agricultural, community-led; green and harvest gold; programmes, stories, savings groups, contact |
| Hatua Apparel | Contemporary fashion retail; shop, collections, stores, order tracking, about the workshop |
| Mwangaza Creative Studio | Cinematic portfolio; work, services (photography, video, film, social), process, book a shoot |
| Pwani Hotels & Safaris | Coastal hospitality; rooms, dining, safaris and tours, events, location, reservations |
| Voltline Electronics (working name) | Nationwide electronics retail; product categories, branch finder, deals, delivery and installation, business sales, order tracking |

Every case-study site carries a small footer note: "Illustrative case study built on StrideFlow."

## 6. Terminology (application)

Use: workspace, capability, project, task, form, response, location, approval, alert, report, member. Avoid in the core product: programme (unless the customer renames projects), beneficiary, donor, grant (except inside the optional Funding capability), branch (use location; customers may rename it).
