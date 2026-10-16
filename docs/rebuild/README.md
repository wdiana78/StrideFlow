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

## Decisions (resolved 16 October 2026)

| Id | Decision |
|---|---|
| U1 | No AI in this release. No provider chosen |
| U2 | No website builder in StrideFlow. The six case-study websites are separate deliverables; building websites for customers is a separate service offered by the StrideFlow team. Website modules are demonstration-only and hidden in production |
| U3 | Retire the single-file offline preview after hosted demonstrations exist (Phase 4) |
| U4 | Sixth case study: Voltline Electronics, 8 branches (Nairobi, Mombasa, Kisumu, Nakuru, Eldoret, Thika, Nyeri, Machakos) |
| U5 | Sessions in HttpOnly cookies with CSRF protection (implemented) |
| U6 | Proceed with StrideFlow; "Stride ERP" exists in the same category, so a trademark search is recommended before public launch |
| U7 | Email provider chosen later; development uses the log transport; production refuses to start without SMTP |
| U8 | Pricing, trial, support offer, retention period and About facts to come from the owner; placeholders must not ship |

Progress: see PHASE_REPORTS.md.
