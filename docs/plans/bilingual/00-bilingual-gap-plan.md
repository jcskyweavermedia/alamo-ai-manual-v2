# Bilingual EN/ES — Gap Closure Plan (v2 — Post-Audit)

> **Goal**: Make the app fully bilingual where needed, matching the `App-overview.md` promise: "in English and Spanish" for all user-facing content.
>
> **Pattern**: Every component uses a local `STRINGS` object + `const t = STRINGS[language]`. ~31 components already use this pattern. A small `common-strings.ts` file holds the 7-10 strings duplicated across 5+ files (e.g. "All"/"Todos", "Search..."/"Buscar...").
>
> **Not in scope**: Admin-only pages (Ingest, Training Dashboard, Review Insights, Admin Settings) stay English-only — admin users are English-speaking operators. Brand names ("Tastly AI", "Alamo Prime") stay as-is. Product content stays English (AI translates on-the-fly; Phase 6 overlay planned separately).
>
> **Type convention**: Import `Language` from `use-language.tsx` for new prop interfaces.

---

## Audit Results (3 Opus agents)

| Auditor | Verdict | Action Taken |
|---|---|---|
| Tech Architect | Approve with changes | Added SidebarNavGroup, constants.ts, JoinGroup; confirmed Recipes.tsx exists |
| Database Expert | Approve | DB layer confirmed bilingual; no migrations needed |
| Devil's Advocate | Fix first | Added auth flow (WS-2), toast hooks (WS-6), expanded Profile (WS-5), fixed translations |

**Updated scope**: ~200+ strings across ~28 files (was ~125 across ~18).

---

## Current State Summary

| Area | Language Aware? | Gap |
|------|----------------|-----|
| Manual reader | Yes | None — dual DB columns |
| Training system | Yes | None — STRINGS pattern throughout |
| Filing Cabinet | Yes | None — STRINGS pattern |
| AI chat / search | Yes | None — language param in prompts |
| `useLanguage()` hook | Yes | None — works correctly |
| **Home page** | Has hook, unused | **12 strings** |
| **Auth flow (SignIn, JoinGroup, SignInForm, SignUpForm)** | No hook | **~35 strings** |
| **Navigation (nav-config + constants.ts + MobileTabBar + Sidebar + SidebarNavGroup)** | No hook | **~20 labels** |
| **Product CardViews (5)** | No hook/prop | **~34 strings** |
| **Product listing pages (5) + StepsOfService** | Has hook, unused | **~60 strings** |
| **NotFound** | No hook | **3 strings** |
| **Header** | Partial | **3 aria-labels** |
| **Profile (4 sub-components)** | Partial | **~9 strings** |
| **Hooks with toast messages** | No language | **~30 strings** |
| **Shared UI primitives** | English defaults | **~5 defaults** |

---

## Architecture Decisions

### Nav labels: Dual labels in config
`nav-config.ts` gets `labelEn`/`labelEs` on all interfaces + a `getLabel()` helper. Sidebar and SidebarNavGroup consume via `getLabel()`.

### MobileTabBar: Separate data source
MobileTabBar uses `STAFF_NAV_ITEMS` from `constants.ts` (NOT nav-config). Both `constants.ts` and the inline admin array in MobileTabBar get dual labels.

### Common strings: Small shared file
`src/lib/common-strings.ts` holds ~10 strings duplicated across 5+ files: "All"/"Todos", "Search..."/"Buscar...", "Featured"/"Destacado", "Notes"/"Notas", etc. Components import selectively — this is NOT an i18n library, just a DRY constants file.

### Zod validation: Dynamic schema factory
Auth forms use `useMemo` with `language` to create Zod schemas with translated error messages.

---

## Workstreams

### WS-1: Navigation System (architectural — do first)

**Files** (5): `nav-config.ts`, `SidebarNavGroup.tsx`, `Sidebar.tsx`, `constants.ts`, `MobileTabBar.tsx`

**Changes**:
1. `nav-config.ts`: `label` → `labelEn` + `labelEs` on NavChild, NavGroup, NavStandalone. Add `getLabel(item, language)` helper.
2. `SidebarNavGroup.tsx`: Use `getLabel()` for all 10+ label render points. Translate "Expand {group}" tooltip.
3. `Sidebar.tsx`: Import `useLanguage`, use `getLabel()`. Translate "Collapse"/"Expand sidebar".
4. `constants.ts`: Add `labelEs` to `STAFF_NAV_ITEMS` and `ADMIN_NAV_ITEMS`.
5. `MobileTabBar.tsx`: Import `useLanguage`, read correct label from items. Translate inline admin array. Translate `aria-label="Main navigation"`.

**Translations**:

| EN | ES |
|---|---|
| Manual | Manual |
| BOH | BOH |
| Recipes | Recetas |
| FOH | FOH |
| Dish Guide | Guía de Platos |
| Wines | Vinos |
| Cocktails | Cócteles |
| Beer & Liquor | Cerveza y Licores |
| FOH Manuals | Manuales FOH |
| Learn | Aprender |
| Courses | Cursos |
| Forms | Formularios |
| Profile | Perfil |
| Search | Buscar |
| Ask AI | Preguntar IA |
| Reviews | Reseñas |
| Collapse | Contraer |
| Expand sidebar | Expandir barra lateral |

---

### WS-2: Auth Flow + Home + NotFound

**Files** (6): `Index.tsx`, `SignIn.tsx`, `SignInForm.tsx`, `SignUpForm.tsx`, `JoinGroup.tsx`, `NotFound.tsx`

**Changes**:
1. `Index.tsx` (12 strings): Add STRINGS. Hook already imported.
2. `SignIn.tsx` (6 strings): Add useLanguage + STRINGS.
3. `SignInForm.tsx` (~10 strings): Add useLanguage + STRINGS. Zod schema in useMemo for translated validation.
4. `SignUpForm.tsx` (~15 strings): Same approach as SignInForm.
5. `JoinGroup.tsx` (~12 strings): Add useLanguage + STRINGS.
6. `NotFound.tsx` (3 strings): Add useLanguage + STRINGS.

**Key translations**:

| EN | ES |
|---|---|
| Welcome to Alamo Prime | Bienvenido a Alamo Prime |
| Your AI-powered restaurant operations assistant | Tu asistente de operaciones con IA |
| Quick Access | Acceso Rápido |
| System Status | Estado del Sistema |
| All systems operational | Todos los sistemas funcionando |
| Welcome Back | Bienvenido |
| Sign in to access the operations manual | Inicia sesión para acceder al manual |
| Don't have an account? | ¿No tienes cuenta? |
| Contact your manager | Contacta a tu gerente |
| Sign In / Signing in... | Iniciar Sesión / Iniciando sesión... |
| Email / Password | Correo electrónico / Contraseña |
| Email is required | El correo es obligatorio |
| Password must be at least 8 characters | La contraseña debe tener al menos 8 caracteres |
| Create Account | Crear Cuenta |
| Full Name | Nombre Completo |
| Confirm Password | Confirmar Contraseña |
| Passwords do not match | Las contraseñas no coinciden |
| Join {group} | Unirse a {group} |
| Page not found | Página no encontrada |
| Return to Home | Volver al Inicio |

---

### WS-3: Product Listing Pages + StepsOfService

**Files** (6): `DishGuide.tsx`, `Wines.tsx`, `Cocktails.tsx`, `BeerLiquor.tsx`, `Recipes.tsx`, `StepsOfService.tsx`

All already import `useLanguage()` but don't use it for UI strings.

**Changes per file**: Add STRINGS object with filter labels, sort labels, hero text, search placeholder, error messages, `title="Back"` tooltips.

**Shared strings** (import from `common-strings.ts`):

| EN | ES |
|---|---|
| All | Todos |
| Search... | Buscar... |
| A–Z | A–Z |
| New | Nuevo |
| Featured | Destacado |
| No results found | Sin resultados |
| Failed to load | Error al cargar |
| Back | Volver |

**Per-page translations**:

| Page | Filters (ES) | Hero (ES) |
|---|---|---|
| Dish Guide | Aperitivo, Entrada, Acompañamiento, Postre | Cada Plato Cuenta una Historia |
| Wines | Tinto, Blanco, Rosado, Espumoso | Saborea y Descubre |
| Cocktails | Clásico, Moderno, Tiki, Refrescante; tabs: Cócteles, Prep de Barra | Preparados con Alma |
| Beer & Liquor | Cerveza, Licor | Servido con Carácter |
| Recipes | (match existing filters) | Hecho con Amor y Fuego |
| StepsOfService | Mesero, Bartender, Busser, Barback | (convert inline ternaries to STRINGS) |

---

### WS-4: Product CardView Components

**Files** (5): `DishCardView.tsx`, `WineCardView.tsx`, `CocktailCardView.tsx`, `RecipeCardView.tsx`, `BeerLiquorCardView.tsx`

**Changes per file**:
1. Add `language: Language` to props (import type from `use-language`)
2. Add STRINGS object with section headings
3. Wire throughout JSX
4. Parent listing pages pass `language={language}` prop

**Translations**: (same as v1 — see translation table in previous version)

---

### WS-5: Header + Profile + UI Primitives

**Files** (7): `Header.tsx`, `Profile.tsx`, `LanguagePreference.tsx`, `ThemePreference.tsx`, `SignOutButton.tsx`, `error-state.tsx`, `AuthLoadingScreen.tsx`

**Changes**:
1. `Header.tsx`: Translate aria-labels/titles using existing `language` prop.
2. `Profile.tsx`: Add STRINGS for "Profile", "Settings", "Notifications".
3. `LanguagePreference.tsx`: Translate "Language" label.
4. `ThemePreference.tsx`: Translate "Theme", "Light theme", "System theme", "Dark theme".
5. `SignOutButton.tsx`: Translate "Sign Out"/"Signing Out...".
6. `error-state.tsx`: Add `language` prop with EN defaults. Translate "Something went wrong", "Try again".
7. `AuthLoadingScreen.tsx`: Accept `language` prop for "Loading..." default.

---

### WS-6: Hook Toast Messages

**Files** (4): `use-form-submission.ts`, `use-direct-image-upload.ts`, `use-file-upload.ts`, `use-form-attachments.ts`

**Changes**: Each hook either accepts a `language` parameter or calls `useLanguage()` internally. Add bilingual toast messages using inline ternaries (hooks don't use JSX, so STRINGS pattern adapted as needed).

**Key translations**:

| EN | ES |
|---|---|
| Failed to save draft | Error al guardar borrador |
| Please fill in all required fields | Complete todos los campos obligatorios |
| Please sign in to upload images | Inicie sesión para subir imágenes |
| Image exceeds the 10MB size limit | La imagen excede el límite de 10MB |
| Failed to remove file | Error al eliminar archivo |

---

## Execution Order

```
Phase 1 (Foundation):   WS-1 (nav system) + create common-strings.ts
Phase 2 (Parallel):     WS-2 + WS-3 + WS-4 + WS-5 + WS-6 (5 agents)
Phase 3 (Verify):       TypeScript check + single audit agent
```

**Total agents**: 7 (1 nav, 5 parallel, 1 audit)

---

## Implementation Checklist

- [ ] `src/lib/common-strings.ts` — create shared string constants
- [ ] **WS-1**: nav-config.ts → dual labels + getLabel helper
- [ ] **WS-1**: SidebarNavGroup.tsx → getLabel for 10+ render points
- [ ] **WS-1**: Sidebar.tsx → useLanguage + getLabel + translate UI strings
- [ ] **WS-1**: constants.ts → dual labels on STAFF/ADMIN_NAV_ITEMS
- [ ] **WS-1**: MobileTabBar.tsx → useLanguage + bilingual labels
- [ ] **WS-2**: Index.tsx → STRINGS (12 strings)
- [ ] **WS-2**: SignIn.tsx → useLanguage + STRINGS (6 strings)
- [ ] **WS-2**: SignInForm.tsx → useLanguage + STRINGS + Zod i18n (~10 strings)
- [ ] **WS-2**: SignUpForm.tsx → useLanguage + STRINGS + Zod i18n (~15 strings)
- [ ] **WS-2**: JoinGroup.tsx → useLanguage + STRINGS (~12 strings)
- [ ] **WS-2**: NotFound.tsx → useLanguage + STRINGS (3 strings)
- [ ] **WS-3**: DishGuide.tsx → STRINGS for filters/hero/errors
- [ ] **WS-3**: Wines.tsx → STRINGS for filters/hero/errors
- [ ] **WS-3**: Cocktails.tsx → STRINGS for filters/hero/errors + tabs
- [ ] **WS-3**: BeerLiquor.tsx → STRINGS for filters/hero/errors
- [ ] **WS-3**: Recipes.tsx → STRINGS for filters/hero/errors
- [ ] **WS-3**: StepsOfService.tsx → convert to STRINGS pattern
- [ ] **WS-4**: DishCardView.tsx → language prop + STRINGS
- [ ] **WS-4**: WineCardView.tsx → language prop + STRINGS
- [ ] **WS-4**: CocktailCardView.tsx → language prop + STRINGS
- [ ] **WS-4**: RecipeCardView.tsx → language prop + STRINGS
- [ ] **WS-4**: BeerLiquorCardView.tsx → language prop + STRINGS
- [ ] **WS-5**: Header.tsx → translate aria-labels
- [ ] **WS-5**: Profile.tsx + 3 sub-components → STRINGS
- [ ] **WS-5**: error-state.tsx → language prop with EN defaults
- [ ] **WS-5**: AuthLoadingScreen.tsx → language prop
- [ ] **WS-6**: use-form-submission.ts → bilingual toasts
- [ ] **WS-6**: use-direct-image-upload.ts → bilingual toasts
- [ ] **WS-6**: use-file-upload.ts → bilingual toasts
- [ ] **WS-6**: use-form-attachments.ts → bilingual toasts
- [ ] **Audit**: TypeScript 0 errors + full pass on all ~28 files

---

## Rules for Agents

1. **Use the STRINGS pattern** — `const STRINGS = { en: {...}, es: {...} } as const`
2. **Import shared strings from `common-strings.ts`** for the ~10 strings used across 5+ files
3. **Import `Language` type** from `@/hooks/use-language` for new prop interfaces
4. **Keep Spanish translations natural** — restaurant-industry terms, not literal translations
5. **Don't touch admin-only pages** — English only
6. **Don't add STRINGS to components that are already fully bilingual**
7. **Pass `language` prop from parent → child** when child doesn't have its own `useLanguage()` call
8. **Preserve existing behavior** — only add translations, don't restructure components
9. **0 TypeScript errors** after changes
