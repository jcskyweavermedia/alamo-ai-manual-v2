# Phase 5: Form Builder Admin — Consolidated Audit Report

> **Date**: 2026-02-25
> **Audited by**: 4 specialized agents (Opus)
> **Plan files audited**: Master plan + 5 section documents

---

## Executive Summary

| Audit | Verdict | Findings |
|-------|---------|----------|
| **Cross-Section Consistency** | ⚠️ Needs fixes | 5 Critical, 7 Major, 13 Minor (25 total) |
| **Template Compatibility** | ✅ Safe | Both seed templates pass all 7 validation rules |
| **Codebase Feasibility** | ✅ Verified | 18 verified, 2 partially correct, 0 incorrect |
| **Implementation Gaps** | ⚠️ Needs fixes | 6 Blocking, 15 Important, 10 Nice-to-have (31 total) |

**Overall verdict**: The plan is architecturally sound and all codebase assumptions are accurate. However, **6 blocking gaps** and **5 critical inconsistencies** must be resolved before implementation begins.

---

## 1. Cross-Section Consistency Audit

Found 25 inconsistencies between the 5 section documents.

### Critical (5) — Must fix before coding

| # | Issue | Details |
|---|-------|---------|
| C1 | **Tool ID mismatch** | DB seeds `search_standards` but backend TOOL_REGISTRY uses `search_restaurant_standards`. Runtime breakage — tool calls will 404. |
| C2 | **Max fields: 50 vs 60** | DB plan trigger = 50, backend plan trigger = 60. Master plan resolves to **50** but backend doc not updated. |
| C3 | **Max options: 50 vs 30** | DB plan trigger = 50, backend plan trigger = 30. Master plan resolves to **50** but backend doc not updated. |
| C4 | **Trigger name/logic conflict** | DB: `handle_form_template_publish()` (always bumps version). Backend: `bump_form_template_version()` (conditional bump). Master plan picks DB plan but backend doc not updated. |
| C5 | **snake_case vs camelCase** | `generate-form-template` response uses snake_case keys but frontend expects camelCase via Supabase transform. Need explicit mapping or consistent casing. |

### Major (7)

| # | Issue |
|---|-------|
| M1 | Migration count: DB says 4, backend says 5 — need reconciliation |
| M2 | `BuilderTab` type: arch plan uses 4 tabs, UX uses different names |
| M3 | `ADD_FIELD` reducer payload shape differs between sections |
| M4 | `BuilderState` flat vs nested shape inconsistency |
| M5 | Backend claims "no new tables" but `form_ai_tools` IS a new table |
| M6 | `useFormBuilder` return type not fully aligned across sections |
| M7 | `rightPanelMode` state not defined — preview vs property panel vs AI refine |

### Minor (13)

Cosmetic naming differences, doc-only inconsistencies, and style mismatches. Non-blocking for implementation.

---

## 2. Template Compatibility Audit

**Result: SAFE TO DEPLOY** ✅

Both existing seed templates (`daily-opening-checklist` and `shift-end-report`) were validated against all 7 enhanced trigger rules:

| Rule | Result |
|------|--------|
| Max 50 fields | ✅ Pass (14 and 11 fields) |
| Valid field types | ✅ Pass (all types in allowed set) |
| Required options for select/radio/checkbox | ✅ Pass |
| Key format (slug regex) | ✅ Pass |
| Condition references valid keys | ✅ Pass |
| Unique keys | ✅ Pass |
| Unique order values | ✅ Pass |

No seed data migration or template patching needed.

---

## 3. Codebase Feasibility Audit

**Result: All assumptions verified** ✅

| Category | Checked | Pass | Partial | Fail |
|----------|---------|------|---------|------|
| Components to reuse | 8 | 8 | 0 | 0 |
| Type definitions | 3 | 3 | 0 | 0 |
| Routes & navigation | 2 | 2 | 0 | 0 |
| Edge functions | 2 | 2 | 0 | 0 |
| State management patterns | 2 | 1 | 1 | 0 |
| Database schema | 3 | 3 | 0 | 0 |
| **Total** | **20** | **18** | **2** | **0** |

### Partially Correct (2)

1. **IngestDraftContext pattern**: Plan says "following IngestDraftContext pattern" for undo/redo, but IngestDraftContext has NO undo/redo. The Context + useReducer part matches; undo/redo is new functionality.

2. **Trigger rules**: Plan describes "enhanced 7-rule trigger" but current trigger only has 3 rules. Plan correctly identifies this as an enhancement, but the master plan table could be clearer.

### Key Verifications

- `FormBody`, `FormSection`, `FormFieldRenderer` — all exist with expected props ✅
- `FormFieldDefinition` — 12+ properties confirmed, all 17 `FormFieldType` values match ✅
- `ProtectedRoute` with `requiredRole` array support — confirmed ✅
- `ask-form` TOOL_REGISTRY — exists at expected location, extensible ✅
- `_shared/` modules (auth, cors, openai, supabase, usage) — all present ✅
- `@dnd-kit/sortable` — NOT installed yet (expected, new dependency) ✅
- No existing `/admin/forms` routes — confirmed clean slate ✅

---

## 4. Implementation Gap Analysis

Found 31 gaps across the plan documents.

### Blocking (6) — Cannot implement without resolving

| # | Gap | Section | Resolution |
|---|-----|---------|------------|
| G2 | **Header/Instructions field types** have no builder property panel spec | UX | Add `content` textarea for `instructions` type; clarify header drag = header only (not child fields) |
| G7 | **`refine-form-instructions`** has no JSON.parse error handling | Backend | Wrap in try-catch, check `finish_reason === "length"`, increase `max_tokens` from 800→1200 |
| G12 | **Edit published template** flow is unresolved | UX + DB | Decide: keep `published` status during edits, require explicit "Publish Changes" to bump version |
| G14 | **`FormTemplate` type** missing 3 new columns | Arch | Add `publishedAt`, `builderState`, `aiRefinementLog` to `src/types/forms.ts` |
| G22 | **Backend plan still says max 30 options** | Backend | Update to 50 per master plan resolution |
| G23 | **Backend plan still says max 60 fields** | Backend | Update to 50 per master plan resolution |

*Note: G30 (condition ordering relaxation) is also blocking but already flagged as critical-path risk R9 in the master plan.*

### Important (15)

| # | Gap | Impact |
|---|-----|--------|
| G1 | Slug collision handling unspecified | Developer must invent algorithm |
| G3 | Icon picker — no curated icon list | 1000+ Lucide icons, bundle size risk |
| G4 | Template cloning — no deep copy spec | May clone transient state or same slug |
| G5 | Publish validation failure UX undefined | Cryptic Postgres errors shown to admin |
| G6 | Admin navigation entry point unspecified | Developer must guess where to add link |
| G8 | AI-generated fields may violate trigger rules | Auto-save fails on builder hydration |
| G9 | Auto-save silent failure — no retry spec | Potential data loss |
| G11 | Unsaved changes navigation warning missing | Admin loses work on accidental navigation |
| G15 | ~60 bilingual builder UI strings not defined | Spanish translations left as placeholders |
| G16 | EN/ES instructions editing workflow unclear | ES instructions left empty |
| G18 | Mobile field editor trigger contradicts arch plan | Inline expand vs full-screen sheet conflict |
| G20 | `builder_state` cleared on publish resets UI | Admin loses their place in builder |
| G21 | Backend plan version trigger not marked superseded | Two competing trigger implementations |
| G26 | Right column state machine undefined (desktop) | Preview vs property panel vs AI refine |
| G29 | `useBuilderAutoSave` hook missing from arch plan | Debounce, dirty tracking, save queue unspecified |

### Nice-to-have (10)

Field label bilingual edge cases, `section_es` editing deferral, virtualization library choice, `ProtectedRoute` role consistency, form viewer compatibility notes, and other documentation clarity items.

---

## Action Items — Pre-Implementation Checklist

### Must-Fix (do before writing any code)

1. **Resolve tool ID mismatch (C1)**: Decide on `search_standards` vs `search_restaurant_standards`. Update BOTH the DB seed AND the backend TOOL_REGISTRY to match.

2. **Update backend plan limits (C2, C3, G22, G23)**: Change max fields from 60→50 and max options from 30→50 in the backend document. Add a note at the top: "See master plan for authoritative limits."

3. **Mark backend trigger as superseded (C4, G21)**: Delete or clearly mark `bump_form_template_version()` in backend plan as superseded by DB plan's `handle_form_template_publish()`.

4. **Resolve casing (C5)**: Add explicit `snakeToCamel` mapping in the `generate-form-template` response handler, or use Supabase client's built-in transform.

5. **Spec instructions/header field editing (G2)**: Add property panel specification for `instructions` (content textarea) and `header` (text input, no AI hint/placeholder) field types.

6. **Add JSON error handling to refine function (G7)**: Wrap `JSON.parse` in try-catch, add `finish_reason` check, increase `max_tokens`.

7. **Decide edit-published flow (G12)**: Choose between "auto-revert to draft on edit" vs "stay published, explicit re-publish bumps version". Document the decision.

8. **Update `FormTemplate` type (G14)**: Plan must specify adding `publishedAt`, `builderState`, `aiRefinementLog` to the TypeScript interface.

9. **Fix condition ordering in Migration 3 (G30/R9)**: Update trigger SQL to validate conditions against ALL field keys, not just preceding ones.

### Should-Fix (before Sprint 2)

10. **Define right-column state machine (M7, G26)**: Add `rightPanelMode: 'preview' | 'field-properties' | 'ai-refine'` to BuilderState.

11. **Specify publish validation UX (G5)**: Client-side `validateForPublish()` with error summary panel.

12. **Define auto-save failure flow (G9, G29)**: Exponential backoff retry, amber/red banners, prevent navigation when dirty.

13. **Add unsaved changes warning (G11)**: `beforeunload` + React Router `useBlocker`.

14. **Curate icon list (G3)**: Pick 20-30 restaurant-relevant Lucide icons for the picker.

15. **Specify clone algorithm (G4)**: Deep copy fields + instructions + ai_tools, new slug, reset version/status/builder_state.

### Can-Defer (to Sprint 4 / Phase 7)

16. `section_es` / `hint_es` editing (G28) — defer to Phase 7 bilingual editor
17. Virtualization library choice (G19) — defer, use React.memo first
18. Bilingual builder strings (G15) — can be added incrementally during implementation
19. Admin nav entry point (G6) — simple card on `/admin` page, decide during Sprint 1

---

## Confidence Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Codebase accuracy** | 9.5/10 | Every import, type, and component verified. Zero incorrect assumptions. |
| **Architecture soundness** | 8.5/10 | useReducer + Context pattern well-precedented. Undo/redo is new but well-defined. |
| **Completeness** | 7/10 | 6 blocking gaps and several important underspecifications need resolution. |
| **Internal consistency** | 6.5/10 | 5 critical cross-section contradictions. Backend plan not updated after master plan resolutions. |
| **Implementability** | 8/10 | After fixing the 9 must-fix items above, a developer can implement without guesswork. |

**Bottom line**: The plan is **good but not ready**. Fix the 9 must-fix items (estimated ~2 hours of plan editing), and it becomes a solid, implementable specification.
