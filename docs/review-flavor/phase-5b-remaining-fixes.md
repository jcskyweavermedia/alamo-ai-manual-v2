# Phase 5b: Remaining Dashboard Fixes (Revised)

> Updated after expert panel review (DB engineer, technical architect, devil's advocate).

---

## Decision Summary

| Item | Verdict | Rationale |
|------|---------|-----------|
| Staff name dedup | **BUILD** | Real data quality issue, ~115 lines, immediate UX win |
| Remove decorative dropdowns | **BUILD** | 866 reviews too sparse for most filters; removes user confusion |
| Remove diagnostic logging | **BUILD** | 5 wasted RLS queries + console noise on every render |
| Wire all 8 filter dropdowns | **DEFER** | Revisit when dataset reaches 5,000+ reviews |
| Hook refactor (5 hooks) | **DEFER** | High-risk 800-1000 line refactor for no user benefit at current volume |
| Fuzzy matching (pg_trgm) | **REJECT** | Overkill for current data size |

---

## Fix 1: Remove Decorative Dropdowns

### Rationale (from expert panel)

- With 866 reviews across 7+ years, "Month" on March 1 = 1 day of data → empty charts
- No "insufficient data" empty-state design exists
- Global `DateRangeSelector` already handles date filtering at page level
- Hook splitting would be a high-risk 800-1000 line refactor

### What to Remove

| Location | Element | State Variable |
|----------|---------|---------------|
| `StrengthsOpportunities.tsx` | Period dropdown (Month/Quarter/Year) | `period` |
| `RestaurantRankList.tsx` | Time pill bar (Month/Quarter/Year/Last Year/5 Yr/All) | `timePeriod` |
| `ReviewDashboard.tsx` Food tab | Food/Drink filter chips + Time pills | `foodFilter`, `foodTime` |
| `ReviewDashboard.tsx` Staff tab | Time pill bar (Month/Quarter/Year/All Time) | `staffTime` |
| `ReviewDashboard.tsx` Categories tab | Time pills only (Month/Quarter/Year) | `catTime` |
| `ReviewDashboard.tsx` Company tab | Metric pills + Time pills | `metric`, `companyTime` |

### What to KEEP

- **Categories tab `catView` selector** (Food Quality/Service/Ambience/Value) — already functional, switches data client-side
- **FlavorIndexChart** category tabs + restaurant dropdown — already wired

### Files Modified

| File | Change |
|------|--------|
| `src/components/reviews/StrengthsOpportunities.tsx` | Remove `useState`, period dropdown, constants |
| `src/components/reviews/RestaurantRankList.tsx` | Remove `useState`, time pills, constants, `TimePillBar` import |
| `src/pages/ReviewDashboard.tsx` | Remove filter state + `TimePillBar` JSX from Food/Staff/Categories/Company tabs; remove unused constants |

---

## Fix 2: Staff Name Deduplication

### Problem

`aggregate_staff_mentions()` groups by exact `staff->>'name'` string. AI extraction produces:
- `Maria Garcia` vs `Maria` (full name / first name)
- `our server` vs `the bartender` (generic descriptions)
- `chris` vs `Christopher` (case / nickname)

### Strategy: Two-Layer Normalization

**Layer 1**: Improve AI extraction prompt + add `normalizeStaffName()` post-processing
**Layer 2**: Harden `aggregate_staff_mentions()` SQL GROUP BY

### Layer 1: AI Extraction (Edge Function)

**File:** `supabase/functions/analyze-review/index.ts`

#### 1a. Tighten system prompt

```diff
- For staff_mentioned, extract actual first names or descriptions
-   (e.g., "Maria", "our server", "the bartender").
+ For staff_mentioned, ONLY extract real first names (e.g., "Maria", "Carlos", "Jake").
+   Do NOT include generic descriptions like "our server" or "the bartender" — skip those.
+   Capitalize the first letter of each name. If a full name is given (e.g., "Maria Garcia"),
+   use only the first name ("Maria") unless two staff share the same first name.
+   Normalize common nicknames to their standard form (e.g., "Chris" not "Christopher",
+   "Mike" not "Michael") — use whichever form appears most commonly in casual speech.
```

#### 1b. Post-extraction normalization in `validateExtraction()`

```typescript
// Normalization that matches PostgreSQL initcap(split_part(trim(...), ' ', 1))
function normalizeStaffName(name: string): string {
  let n = name.trim();
  const parts = n.split(/\s+/);
  if (parts.length > 1) n = parts[0];
  // initcap-compatible: uppercase first letter of each word segment
  return n.replace(/\b\w/g, (c) => c.toUpperCase())
          .replace(/(?<=\b\w)\w+/g, (s) => s.toLowerCase());
}

const GENERIC_STAFF = new Set([
  'our server', 'the server', 'our waiter', 'the waiter',
  'our bartender', 'the bartender', 'our host', 'the host',
  'the manager', 'our manager', 'a server', 'a waiter',
]);

// Filter generics + normalize names
ext.staff_mentioned = ext.staff_mentioned
  .filter(s => {
    const lower = s.name.toLowerCase().trim();
    return !GENERIC_STAFF.has(lower) && lower.length > 1;
  })
  .map(s => ({ ...s, name: normalizeStaffName(s.name) }));
```

### Layer 2: SQL Migration

Single migration with 4 phases:

#### Phase 1: Enable unaccent extension
```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

#### Phase 2: Normalize existing `staff_mentioned` JSONB in-place

**Critical fix from DB expert**: `COALESCE` wrapper to prevent NULL when all entries are filtered out.

```sql
UPDATE review_analyses
SET staff_mentioned = COALESCE(
  (SELECT jsonb_agg(
    jsonb_set(elem, '{name}',
      to_jsonb(initcap(split_part(trim(unaccent(elem->>'name')), ' ', 1)))
    )
  )
  FROM jsonb_array_elements(staff_mentioned) elem
  WHERE lower(trim(elem->>'name')) NOT IN (
    'our server', 'the server', 'our waiter', 'the waiter',
    'our bartender', 'the bartender', 'our host', 'the host',
    'the manager', 'our manager', 'a server', 'a waiter'
  )
  AND length(trim(elem->>'name')) > 1
  ),
  '[]'::jsonb
)
WHERE jsonb_array_length(staff_mentioned) > 0;
```

#### Phase 3: Update `aggregate_staff_mentions()` with hardened GROUP BY

```sql
CREATE OR REPLACE FUNCTION public.aggregate_staff_mentions(
  p_restaurant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  FROM (
    SELECT
      initcap(split_part(trim(unaccent(staff->>'name')), ' ', 1)) AS name,
      staff->>'role' AS role,
      COUNT(*) AS mentions,
      COUNT(*) FILTER (WHERE staff->>'sentiment' = 'positive') AS positive,
      COUNT(*) FILTER (WHERE staff->>'sentiment' = 'negative') AS negative
    FROM public.review_analyses ra,
         jsonb_array_elements(ra.staff_mentioned) AS staff
    WHERE ra.restaurant_id = p_restaurant_id
      AND ra.review_date >= p_start_date::timestamptz
      AND ra.review_date < (p_end_date + 1)::timestamptz
      AND length(trim(staff->>'name')) > 1
      AND lower(trim(staff->>'name')) NOT IN (
        'our server', 'the server', 'our waiter', 'the waiter',
        'our bartender', 'the bartender', 'our host', 'the host',
        'the manager', 'our manager', 'a server', 'a waiter'
      )
    GROUP BY initcap(split_part(trim(unaccent(staff->>'name')), ' ', 1)), staff->>'role'
    ORDER BY COUNT(*) DESC
    LIMIT p_limit
  ) t;
$$;
```

Key improvements from expert review:
- `unaccent()` — merges `José` / `Jose`
- `COALESCE` — prevents NULL return
- `>= p_start_date::timestamptz` / `< (p_end_date + 1)::timestamptz` — uses existing index instead of `::date` cast
- Generic filter as belt-and-suspenders with Layer 1

#### Phase 4: Re-run `rollup_review_intelligence` only (not daily FI)

```sql
DO $$
DECLARE rec RECORD; total INTEGER := 0;
BEGIN
  FOR rec IN
    SELECT DISTINCT review_date::date AS d
    FROM public.restaurant_reviews
    WHERE review_date IS NOT NULL AND review_date::date <= CURRENT_DATE - 1
    ORDER BY d
  LOOP
    PERFORM public.rollup_review_intelligence(rec.d);
    total := total + 1;
  END LOOP;
  RAISE NOTICE 'Re-rolled % dates for review_intelligence', total;
END $$;
```

### Known Limitations

1. **First-name collision**: Two staff named "Maria" at the same restaurant merge into one entry. Mitigated by `GROUP BY ... role` (different roles stay separate). Acceptable for V1.
2. **Re-extraction impossible**: `review_text` is NULLed after analysis. SQL migration is the only path for existing data. AI prompt change prevents future issues.

---

## Fix 3: Remove Diagnostic Logging

Remove from `use-review-dashboard.ts` lines 286-318:
- `console.group('[ReviewDashboard] Phase C — Data Diagnostics')` block
- 5 RLS test queries (`review_analyses`, `flavor_index_daily`, `restaurant_reviews`)
- All associated `console.log` statements

This eliminates 5 unnecessary network calls per render.

---

## Execution Order

| Step | Action | Type |
|------|--------|------|
| 1 | Update AI prompt + add `normalizeStaffName()` | Edge function |
| 2 | Deploy `analyze-review` | `npx supabase functions deploy` |
| 3 | Create & push SQL migration (normalize + harden + re-rollup) | Migration |
| 4 | Remove decorative dropdowns from UI | React components |
| 5 | Remove diagnostic logging from hook | React hook |
| 6 | TypeScript build verification | `npx tsc --noEmit` |

---

## Estimated Scope

- Edge function: ~40 lines changed
- SQL migration: ~80 lines
- UI dropdown removal: ~-100 lines (net deletion)
- Diagnostic logging removal: ~-35 lines
- **Net**: ~-15 lines (cleaner codebase)
