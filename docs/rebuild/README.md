# StrideFlow rebuild: Phase 1 documents

| Document | Contents |
|---|---|
| PRODUCT_REQUIREMENTS.md | Definitive product definition, boundaries, numbered requirements |
| FEATURE_AUDIT.md | Every existing capability, its real status, defects D1 to D10, preservation decisions |
| ARCHITECTURE_PLAN.md | Target architecture, workspace configuration, demo isolation, authentication, migrations |
| IMPLEMENTATION_PLAN.md | Phases 2 to 7 with tasks, dependencies and acceptance criteria |
| SECURITY_REVIEW.md | Controls with test evidence, findings S1 to S17, verification plan |
| CONTENT_AND_DESIGN_SPEC.md | Brand system with measured contrast, interface principles, information architecture, approved copy |

No application code was changed in Phase 1.

## Decisions needed from the owner

| Id | Decision | Recommendation |
|---|---|---|
| U1 | AI provider and whether AI ships in this release. The project only contains a "Copy AI brief" button that opens ChatGPT; no provider is configured | Build the provider-neutral service; first feature is drafting report narratives from aggregated figures; choose a provider (for example Anthropic or OpenAI) and supply a server-side key |
| U2 | Should production customers get a website builder? The specification says the platform is not a website builder, but the current product includes one | Keep a minimal optional "Public pages" capability (profile, enquiry form); move the full builder to the case-study deliverable only |
| U3 | Retire the single-file offline preview once server-side demos exist. Server demos need a hosted backend (always-on; Render's free tier sleeps) | Retire after Phase 4 to remove the duplicated JavaScript API |
| U4 | Name and details of the nationwide electronics business | Working name "Voltline Electronics", 8 branches across Nairobi, Mombasa, Kisumu, Nakuru, Eldoret, Thika, Nyeri and Machakos |
| U5 | Move sessions from browser storage to HttpOnly cookies with CSRF protection | Yes |
| U6 | Naming: no product named exactly "StrideFlow" was found in a web search, but "Stride ERP" (RyteGate Technologies) is a cloud ERP in the same category. Trademark and domain availability were not verified | Owner to decide whether to proceed and to commission a trademark search before public launch |
| U7 | Email provider and sending domain (needed for password reset and invitations) | Any SMTP or API provider; development logs emails instead of sending |
| U8 | Pricing amounts, trial length, non-profit discount, support offer, data retention after cancellation, and which background facts may appear on the About page | Owner to supply; copy has marked placeholders that must not ship |
