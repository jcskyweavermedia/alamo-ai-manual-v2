# Phase 1: Database Foundation

**Parent**: [00-master-plan.md](./00-master-plan.md)
**Status**: Audited — Ready to implement
**Dependencies**: None
**Blocks**: Phase 3, Phase 4, Phase 5

### Audit Log (2026-02-11)

Plan reviewed against 8 existing migrations. Results:

| Check | Status |
|-------|--------|
| UUID pattern (`extensions.gen_random_uuid()`) | Confirmed — matches newer migrations |
| `update_updated_at_column()` trigger function | Confirmed — exists, search_path secured |
| `has_role(uid, 'admin'::user_role)` signature | Confirmed — enum has staff/manager/admin |
| `profiles(id)` FK + ON DELETE CASCADE | Confirmed — matches usage_counters pattern |
| `groups(id)` FK + ON DELETE CASCADE | Confirmed — matches group_memberships pattern |
| RLS subquery for chat_messages | Acceptable — can denormalize user_id later if needed |
| Action prompt slug convention | Fixed — uses camelCase to match ask-product edge function |
| pg_cron availability | Not enabled — manual cleanup for now, automate in Phase 8 |

---

## Objective

Create the database tables, RLS policies, indexes, and helper functions needed for:

1. **Unified prompt management** (`ai_prompts`) — all system prompts in one table, DB-driven, replacing hardcoded prompts in edge functions and extending the existing `routing_prompts` table
2. **Chat session tracking** (`chat_sessions`) — session lifecycle per user per viewer context
3. **Chat message history** (`chat_messages`) — full conversation persistence with tool call metadata

---

## Conventions (Matching Existing Codebase)

These patterns are drawn directly from the existing migrations:

| Convention | Pattern |
|-----------|---------|
| UUID generation | `extensions.gen_random_uuid()` |
| User FK | `REFERENCES public.profiles(id) ON DELETE CASCADE` |
| Admin check | `has_role(auth.uid(), 'admin'::user_role)` |
| Timestamps | `created_at/updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` |
| Auto-update trigger | `update_updated_at_column()` (shared function, already exists) |
| RLS standard | SELECT = all authenticated, INSERT/UPDATE/DELETE = admin |
| Security functions | `SECURITY DEFINER SET search_path = 'public'` |
| Policy naming | `"[Role] can [action] [table]"` |

---

## Table 1: `ai_prompts`

### Purpose

Single source of truth for all AI system prompts — text, voice, action templates, and domain instructions. Replaces:

- Hardcoded prompts in `ask` edge function
- Hardcoded prompts in `ask-product` edge function (18 action prompts + base persona)
- Hardcoded prompts in `realtime-voice` edge function
- `routing_prompts` table (1 row for realtime session)

### Why a New Table Instead of Extending `routing_prompts`

The existing `routing_prompts` table was designed narrowly for voice session configuration (slug + mode + prompt + voice). The unified system needs:

- A `category` column to distinguish prompt types (system, domain, action, voice)
- A `domain` column to associate prompts with specific viewers
- A `tools_config` JSONB column for tool-specific overrides
- A `sort_order` column for prompt assembly ordering

Extending `routing_prompts` would overload its purpose. Cleaner to create `ai_prompts` and migrate the one existing row, then deprecate `routing_prompts` in Phase 8 cleanup.

### Schema

```sql
CREATE TABLE public.ai_prompts (
  id          UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,

  -- Classification
  category    TEXT NOT NULL DEFAULT 'domain',
    -- 'system'  = base persona, tool map, behavior rules
    -- 'domain'  = viewer-specific context (manual, wines, etc.)
    -- 'action'  = action button prompt templates (practice-pitch, teach-me, etc.)
    -- 'voice'   = voice-specific instructions (filler phrases, brevity rules)
  domain      TEXT,
    -- NULL for system/voice prompts
    -- 'manual' | 'recipes' | 'dishes' | 'wines' | 'cocktails' | 'beer_liquor'

  -- Content
  prompt_en   TEXT NOT NULL,
  prompt_es   TEXT,

  -- Voice config (only for voice-applicable prompts)
  voice       TEXT,                -- TTS/Realtime voice ID (e.g., 'cedar', 'alloy')

  -- Tool config (optional overrides)
  tools_config JSONB,
    -- Example: {"enabled_tools": ["search_wines", "search_dishes"], "max_rounds": 2}
    -- NULL = use all tools with default settings

  -- Ordering & status
  sort_order  INT NOT NULL DEFAULT 0,  -- for prompt assembly ordering
  is_active   BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Constraints

```sql
-- Category validation
ALTER TABLE public.ai_prompts
  ADD CONSTRAINT ai_prompts_category_check
  CHECK (category IN ('system', 'domain', 'action', 'voice'));

-- Domain validation (NULL allowed for system/voice prompts)
ALTER TABLE public.ai_prompts
  ADD CONSTRAINT ai_prompts_domain_check
  CHECK (domain IS NULL OR domain IN (
    'manual', 'recipes', 'dishes', 'wines', 'cocktails', 'beer_liquor'
  ));

-- Domain required for domain and action categories
ALTER TABLE public.ai_prompts
  ADD CONSTRAINT ai_prompts_domain_required
  CHECK (
    (category IN ('domain', 'action') AND domain IS NOT NULL)
    OR
    (category IN ('system', 'voice'))
  );
```

### Indexes

```sql
-- Fast lookup by category + domain (prompt assembly)
CREATE INDEX idx_ai_prompts_category_domain
  ON public.ai_prompts (category, domain)
  WHERE is_active = true;

-- Fast lookup by slug (direct access)
CREATE INDEX idx_ai_prompts_slug
  ON public.ai_prompts (slug)
  WHERE is_active = true;
```

### RLS Policies

```sql
ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active prompts
CREATE POLICY "Authenticated users can view ai_prompts"
  ON public.ai_prompts FOR SELECT TO authenticated
  USING (is_active = true);

-- Admins can manage prompts
CREATE POLICY "Admins can insert ai_prompts"
  ON public.ai_prompts FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update ai_prompts"
  ON public.ai_prompts FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete ai_prompts"
  ON public.ai_prompts FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));
```

### Auto-Update Trigger

```sql
CREATE TRIGGER update_ai_prompts_updated_at
  BEFORE UPDATE ON public.ai_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### Seed Data

The following rows establish the prompt building blocks. During Phase 3 (unified edge function), the actual prompt content will be extracted from the current hardcoded edge functions and inserted here. For now, we seed the **structure** with placeholder content.

```sql
-- ─── System-level prompts (shared across all modes) ───

INSERT INTO public.ai_prompts (slug, category, domain, prompt_en, prompt_es, sort_order)
VALUES
  ('base-persona', 'system', NULL,
   'You are the AI assistant for Alamo Prime, a premium steakhouse...',
   'Eres el asistente de IA de Alamo Prime, un steakhouse premium...',
   0),

  ('tool-map', 'system', NULL,
   'You have access to the following search tools...',
   'Tienes acceso a las siguientes herramientas de búsqueda...',
   1),

  ('behavior-rules', 'system', NULL,
   'When searching: call multiple tools in parallel for broad questions...',
   'Al buscar: llama a múltiples herramientas en paralelo para preguntas amplias...',
   2);

-- ─── Domain prompts (one per viewer) ───

INSERT INTO public.ai_prompts (slug, category, domain, prompt_en, prompt_es, sort_order)
VALUES
  ('domain-manual', 'domain', 'manual',
   'The user is browsing the operations manual...',
   'El usuario está navegando el manual de operaciones...',
   10),

  ('domain-recipes', 'domain', 'recipes',
   'The user is in the BOH Recipe Viewer...',
   'El usuario está en el Visor de Recetas BOH...',
   10),

  ('domain-dishes', 'domain', 'dishes',
   'The user is browsing the Dish Guide (FOH menu)...',
   'El usuario está navegando la Guía de Platillos (menú FOH)...',
   10),

  ('domain-wines', 'domain', 'wines',
   'The user is browsing the Wine List...',
   'El usuario está navegando la Lista de Vinos...',
   10),

  ('domain-cocktails', 'domain', 'cocktails',
   'The user is browsing the Cocktail Menu...',
   'El usuario está navegando el Menú de Cocteles...',
   10),

  ('domain-beer-liquor', 'domain', 'beer_liquor',
   'The user is browsing the Beer & Liquor list...',
   'El usuario está navegando la lista de Cervezas y Licores...',
   10);

-- ─── Voice prompts ───

INSERT INTO public.ai_prompts (slug, category, domain, voice, prompt_en, prompt_es, sort_order)
VALUES
  ('voice-persona', 'voice', NULL, 'cedar',
   'You are speaking with a restaurant team member via voice...',
   'Estás hablando con un miembro del equipo del restaurante por voz...',
   20),

  ('voice-realtime', 'voice', NULL, 'cedar',
   'CRITICAL: Always call a search tool before answering operational questions...',
   'CRÍTICO: Siempre llama a una herramienta de búsqueda antes de responder preguntas operativas...',
   21);

-- ─── Action prompts (all 18, matching ask-product edge function camelCase keys) ───
-- Slug convention: action-{domain}-{actionKey} (camelCase actionKey matches edge function)
-- Full prompt content will be extracted from ask-product/index.ts during Phase 3.
-- Placeholder text below captures intent; real prompts are richer.

INSERT INTO public.ai_prompts (slug, category, domain, prompt_en, sort_order)
VALUES
  -- Dishes domain (4 actions)
  ('action-dishes-practicePitch', 'action', 'dishes',
   'Generate a natural, enthusiastic 2-3 sentence sales pitch...',
   30),
  ('action-dishes-samplePitch', 'action', 'dishes',
   'Write a polished, confident server pitch for this dish...',
   30),
  ('action-dishes-teachMe', 'action', 'dishes',
   'Teach the server about this dish in a structured way...',
   30),
  ('action-dishes-questions', 'action', 'dishes',
   'List 4-5 common guest questions about this dish...',
   30),

  -- Wines domain (4 actions)
  ('action-wines-explainToGuest', 'action', 'wines',
   'Generate a natural, confident 2-3 sentence wine recommendation...',
   30),
  ('action-wines-wineDetails', 'action', 'wines',
   'Write a polished sommelier-style pitch for this wine...',
   30),
  ('action-wines-foodPairings', 'action', 'wines',
   'Suggest 3-4 specific dishes from the Alamo Prime menu that pair well with this wine...',
   30),
  ('action-wines-questions', 'action', 'wines',
   'List 4-5 common guest questions about this wine...',
   30),

  -- Cocktails domain (4 actions)
  ('action-cocktails-explainToGuest', 'action', 'cocktails',
   'Generate a natural, enthusiastic 2-3 sentence cocktail recommendation...',
   30),
  ('action-cocktails-samplePitch', 'action', 'cocktails',
   'Write a polished bartender-style pitch for this cocktail...',
   30),
  ('action-cocktails-foodPairings', 'action', 'cocktails',
   'Suggest 3-4 specific dishes from the Alamo Prime menu that pair well with this cocktail...',
   30),
  ('action-cocktails-questions', 'action', 'cocktails',
   'List 4-5 common guest questions about this cocktail...',
   30),

  -- Recipes domain (3 actions)
  ('action-recipes-teachMe', 'action', 'recipes',
   'Teach the cook about this recipe in a structured way...',
   30),
  ('action-recipes-quizMe', 'action', 'recipes',
   'Generate 5 quiz questions about this recipe...',
   30),
  ('action-recipes-questions', 'action', 'recipes',
   'Answer the question using the recipe data provided...',
   30),

  -- Beer & Liquor domain (3 actions)
  ('action-beer_liquor-teachMe', 'action', 'beer_liquor',
   'Teach the server about this beverage in a structured way...',
   30),
  ('action-beer_liquor-suggestPairing', 'action', 'beer_liquor',
   'Suggest 3-4 specific dishes from the Alamo Prime menu that pair well with this beverage...',
   30),
  ('action-beer_liquor-questions', 'action', 'beer_liquor',
   'Answer the question using the product data provided...',
   30);
```

### Prompt Assembly Logic (for reference — implemented in Phase 3)

The edge function assembles the final prompt by loading and concatenating rows:

```
Final prompt = [
  base-persona           (category='system', sort_order=0)
  tool-map               (category='system', sort_order=1)
  behavior-rules         (category='system', sort_order=2)
  domain-{viewer}        (category='domain', domain=current viewer, sort_order=10)
  voice-persona          (category='voice', sort_order=20)  ← only if voice mode
  voice-realtime         (category='voice', sort_order=21)  ← only if realtime mode
]
```

For action mode, the edge function loads the specific action prompt:

```
Action prompt = ai_prompts WHERE slug = 'action-{domain}-{actionKey}'

Examples:
  action-dishes-practicePitch
  action-wines-foodPairings
  action-recipes-quizMe
  action-beer_liquor-suggestPairing
```

---

## Table 2: `chat_sessions`

### Purpose

Tracks conversation sessions per user, segmented by viewer context. Enables:

- Session resumption (continue where you left off in the Wine viewer)
- Session expiry (stale sessions auto-close after 4 hours)
- Analytics (which domains get the most AI interaction)

### Schema

```sql
CREATE TABLE public.chat_sessions (
  id              UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id        UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  -- Context segmentation
  context_type    TEXT NOT NULL,
    -- 'manual' | 'recipes' | 'dishes' | 'wines' | 'cocktails' | 'beer_liquor'
  context_id      TEXT,
    -- Optional: specific item slug (e.g., 'bone-in-ribeye')
    -- NULL = general conversation in that viewer

  -- Interaction mode that started this session
  mode            TEXT NOT NULL DEFAULT 'text',
    -- 'text' | 'mic_tts' | 'realtime_voice'

  -- Lifecycle
  message_count   INT NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'active',
    -- 'active' | 'closed'

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Constraints

```sql
ALTER TABLE public.chat_sessions
  ADD CONSTRAINT chat_sessions_context_type_check
  CHECK (context_type IN (
    'manual', 'recipes', 'dishes', 'wines', 'cocktails', 'beer_liquor'
  ));

ALTER TABLE public.chat_sessions
  ADD CONSTRAINT chat_sessions_mode_check
  CHECK (mode IN ('text', 'mic_tts', 'realtime_voice'));

ALTER TABLE public.chat_sessions
  ADD CONSTRAINT chat_sessions_status_check
  CHECK (status IN ('active', 'closed'));
```

### Indexes

```sql
-- Primary lookup: find active session for user + viewer context
CREATE INDEX idx_chat_sessions_user_context
  ON public.chat_sessions (user_id, context_type, status)
  WHERE status = 'active';

-- Cleanup: find stale sessions
CREATE INDEX idx_chat_sessions_last_active
  ON public.chat_sessions (last_active_at)
  WHERE status = 'active';

-- Analytics: sessions per group
CREATE INDEX idx_chat_sessions_group
  ON public.chat_sessions (group_id, context_type);
```

### RLS Policies

Chat sessions are **user-private** — different from the standard "all authenticated can read" pattern used by content tables.

```sql
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only view their own sessions
CREATE POLICY "Users can view own chat_sessions"
  ON public.chat_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can create their own sessions
CREATE POLICY "Users can insert own chat_sessions"
  ON public.chat_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own sessions (close, update last_active_at)
CREATE POLICY "Users can update own chat_sessions"
  ON public.chat_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can view all sessions (analytics, support)
CREATE POLICY "Admins can view all chat_sessions"
  ON public.chat_sessions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Admins can manage all sessions
CREATE POLICY "Admins can update all chat_sessions"
  ON public.chat_sessions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete chat_sessions"
  ON public.chat_sessions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));
```

### Auto-Update Trigger

```sql
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

---

## Table 3: `chat_messages`

### Purpose

Stores every message in a conversation — user questions, assistant responses, tool call metadata, and citations. Enables:

- History injection into LLM context (last N messages)
- Conversation display in the UI
- Tool call debugging (what was searched, what was returned)
- Citation tracking (which sources informed each response)

### Schema

```sql
CREATE TABLE public.chat_messages (
  id            UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,

  -- Message content
  role          TEXT NOT NULL,
    -- 'user' | 'assistant' | 'tool'
  content       TEXT,
    -- The actual message text
    -- For tool role: the tool result summary
    -- NULL allowed (e.g., assistant message with only tool_calls, no text yet)

  -- Tool call metadata (only for assistant messages that triggered tools)
  tool_calls    JSONB,
    -- Array of tool calls made by the assistant:
    -- [
    --   {
    --     "id": "call_abc123",
    --     "name": "search_wines",
    --     "arguments": {"search_query": "full bodied red for steak"},
    --     "result_count": 3
    --   }
    -- ]
    -- NULL for user messages and non-tool assistant messages

  -- Tool result metadata (only for tool role messages)
  tool_call_id  TEXT,
    -- References which tool_call this result corresponds to
    -- Matches tool_calls[].id from the preceding assistant message

  -- Citations extracted from search results
  citations     JSONB,
    -- [
    --   {"domain": "wines", "slug": "malbec-reserve", "name": "Malbec Reserve 2022", "snippet": "..."}
    -- ]
    -- NULL for user messages and tool messages

  -- Token tracking
  tokens_used   INT,
    -- Approximate tokens consumed by this message (for budget tracking)
    -- NULL for tool messages

  -- Input mode for user messages
  input_mode    TEXT,
    -- 'text' | 'voice' — how the user submitted this message
    -- NULL for assistant/tool messages

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Constraints

```sql
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_role_check
  CHECK (role IN ('user', 'assistant', 'tool'));

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_input_mode_check
  CHECK (input_mode IS NULL OR input_mode IN ('text', 'voice'));
```

### Indexes

```sql
-- Primary lookup: messages for a session, ordered chronologically
CREATE INDEX idx_chat_messages_session_created
  ON public.chat_messages (session_id, created_at ASC);

-- Fast count for session message_count updates
CREATE INDEX idx_chat_messages_session_id
  ON public.chat_messages (session_id);
```

### RLS Policies

Messages inherit privacy from their session — users can only access messages belonging to their own sessions.

```sql
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages in their own sessions
CREATE POLICY "Users can view own chat_messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()
    )
  );

-- Users can insert messages into their own sessions
CREATE POLICY "Users can insert own chat_messages"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()
    )
  );

-- Admins can view all messages (support, analytics)
CREATE POLICY "Admins can view all chat_messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Admins can manage all messages
CREATE POLICY "Admins can delete chat_messages"
  ON public.chat_messages FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));
```

Note: No UPDATE policy for users — messages are immutable once created. Only admins can delete (for moderation/cleanup).

---

## Helper Functions

### `get_or_create_chat_session`

Called by edge functions at the start of every AI interaction. Returns an active session for the user's current viewer context, or creates one if none exists or the last one is stale.

```sql
CREATE OR REPLACE FUNCTION public.get_or_create_chat_session(
  _user_id      UUID,
  _group_id     UUID,
  _context_type TEXT,
  _context_id   TEXT DEFAULT NULL,
  _mode         TEXT DEFAULT 'text',
  _expiry_hours INT DEFAULT 4
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _session_id UUID;
BEGIN
  -- Try to find an active, non-expired session for this user + context
  SELECT id INTO _session_id
  FROM public.chat_sessions
  WHERE user_id = _user_id
    AND context_type = _context_type
    AND status = 'active'
    AND last_active_at > (now() - make_interval(hours => _expiry_hours))
  ORDER BY last_active_at DESC
  LIMIT 1;

  -- If found, touch last_active_at and return
  IF _session_id IS NOT NULL THEN
    UPDATE public.chat_sessions
    SET last_active_at = now()
    WHERE id = _session_id;

    RETURN _session_id;
  END IF;

  -- Close any stale active sessions for this user + context
  UPDATE public.chat_sessions
  SET status = 'closed', updated_at = now()
  WHERE user_id = _user_id
    AND context_type = _context_type
    AND status = 'active';

  -- Create new session
  INSERT INTO public.chat_sessions (user_id, group_id, context_type, context_id, mode)
  VALUES (_user_id, _group_id, _context_type, _context_id, _mode)
  RETURNING id INTO _session_id;

  RETURN _session_id;
END;
$$;
```

### `get_chat_history`

Loads recent messages for a session, respecting a token budget. Used by edge functions to inject history into the LLM prompt.

```sql
CREATE OR REPLACE FUNCTION public.get_chat_history(
  _session_id   UUID,
  _max_messages  INT DEFAULT 20,
  _max_tokens   INT DEFAULT 4000
)
RETURNS TABLE (
  role      TEXT,
  content   TEXT,
  citations JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _running_tokens INT := 0;
BEGIN
  -- Return most recent messages (excluding tool role for cleaner context)
  -- Newest first internally, then reverse for chronological order
  RETURN QUERY
  WITH recent AS (
    SELECT
      m.role,
      m.content,
      m.citations,
      m.tokens_used,
      m.created_at
    FROM public.chat_messages m
    WHERE m.session_id = _session_id
      AND m.role IN ('user', 'assistant')
      AND m.content IS NOT NULL
    ORDER BY m.created_at DESC
    LIMIT _max_messages
  )
  SELECT
    r.role,
    r.content,
    r.citations,
    r.created_at
  FROM recent r
  ORDER BY r.created_at ASC;

  -- Note: Token budget enforcement is handled in the edge function
  -- by iterating results and truncating when budget exceeded.
  -- The DB returns up to _max_messages; the edge function trims further.
END;
$$;
```

### `close_stale_sessions`

Maintenance function to close sessions that have been inactive beyond the expiry window. Can be called manually or by a scheduled job.

> **Note**: `pg_cron` is not currently enabled on this Supabase project. For automated cleanup, either enable `pg_cron` via the Supabase dashboard and schedule this function, or use a Supabase scheduled Edge Function as an alternative. This is a **Phase 8 cleanup item** — not required for Phase 1. The function works as a manual call in the meantime.

```sql
CREATE OR REPLACE FUNCTION public.close_stale_sessions(
  _expiry_hours INT DEFAULT 4
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _closed_count INT;
BEGIN
  UPDATE public.chat_sessions
  SET status = 'closed', updated_at = now()
  WHERE status = 'active'
    AND last_active_at < (now() - make_interval(hours => _expiry_hours));

  GET DIAGNOSTICS _closed_count = ROW_COUNT;
  RETURN _closed_count;
END;
$$;
```

---

## Migration Strategy

### Single Migration File

All three tables + helper functions in one migration since they form a cohesive unit with FK dependencies.

**Migration name**: `create_unified_ai_tables`

### Execution Order Within Migration

1. Create `ai_prompts` table + constraints + indexes + RLS + trigger
2. Create `chat_sessions` table + constraints + indexes + RLS + trigger
3. Create `chat_messages` table + constraints + indexes + RLS
4. Create helper functions (`get_or_create_chat_session`, `get_chat_history`, `close_stale_sessions`)
5. Seed `ai_prompts` with placeholder prompts

### What Happens to `routing_prompts`

- **Phase 1**: `routing_prompts` is left untouched. Both tables coexist.
- **Phase 4**: `realtime-session` edge function is updated to read from `ai_prompts` instead of `routing_prompts`.
- **Phase 8**: `routing_prompts` is dropped in the final cleanup migration, after confirming nothing references it.

No data migration needed in Phase 1 — the `routing_prompts` content will be manually extracted and refined when populating `ai_prompts` with real prompt content in Phase 3/4.

---

## Verification Checklist

After applying the migration, verify:

- [ ] `ai_prompts` table exists with all constraints passing
- [ ] `chat_sessions` table exists with FK to `profiles` and `groups`
- [ ] `chat_messages` table exists with FK to `chat_sessions`
- [ ] All CHECK constraints enforce valid enum values
- [ ] RLS is enabled on all 3 tables
- [ ] Authenticated user can SELECT from `ai_prompts` (active only)
- [ ] Authenticated user can INSERT/SELECT/UPDATE own `chat_sessions`
- [ ] Authenticated user can INSERT/SELECT own `chat_messages`
- [ ] Authenticated user CANNOT see other users' sessions or messages
- [ ] Admin can see all sessions and messages
- [ ] `get_or_create_chat_session` returns existing active session if < 4h old
- [ ] `get_or_create_chat_session` creates new session if none exists or stale
- [ ] `get_or_create_chat_session` closes stale sessions on creation
- [ ] `get_chat_history` returns messages in chronological order
- [ ] `get_chat_history` excludes tool-role messages
- [ ] `close_stale_sessions` closes only sessions older than expiry window
- [ ] `update_updated_at_column` trigger fires on all 3 tables (note: `chat_messages` has no updated_at — intentional, messages are immutable)
- [ ] Seed data: all prompt rows inserted with correct categories and domains
- [ ] Supabase security advisors report no new warnings

---

## SQL Test Queries (Post-Migration)

```sql
-- Verify tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('ai_prompts', 'chat_sessions', 'chat_messages');

-- Verify prompts seeded
SELECT slug, category, domain, is_active FROM ai_prompts ORDER BY sort_order;

-- Verify constraints work (should fail)
INSERT INTO ai_prompts (slug, category, domain, prompt_en)
VALUES ('bad', 'invalid_category', NULL, 'test');
-- Expected: CHECK constraint violation

-- Test session lifecycle (as service role)
SELECT get_or_create_chat_session(
  'USER_UUID'::uuid,
  'GROUP_UUID'::uuid,
  'wines',
  NULL,
  'text'
);

-- Test history retrieval
SELECT * FROM get_chat_history('SESSION_UUID'::uuid);

-- Test stale session cleanup
SELECT close_stale_sessions(4);
```

---

## File Outputs

This phase produces **one migration file**:

```
supabase/migrations/YYYYMMDDHHMMSS_create_unified_ai_tables.sql
```

No edge function changes. No frontend changes. Pure database work.

---

## Estimated Effort

- Schema design: Done (this document)
- Migration writing: ~30 minutes
- Testing & verification: ~20 minutes
- Total: ~1 hour
