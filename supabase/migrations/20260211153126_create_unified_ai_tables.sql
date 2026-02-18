-- =============================================================================
-- Phase 1: Unified AI Tables
-- Creates: ai_prompts, chat_sessions, chat_messages + helper functions
-- Part of: Unified AI Architecture (docs/plans/unified-ai/00-master-plan.md)
-- =============================================================================

-- =============================================================================
-- TABLE 1: ai_prompts
-- Single source of truth for all AI system prompts (text, voice, actions)
-- =============================================================================

CREATE TABLE public.ai_prompts (
  id          UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,

  -- Classification
  category    TEXT NOT NULL DEFAULT 'domain',
  domain      TEXT,

  -- Content
  prompt_en   TEXT NOT NULL,
  prompt_es   TEXT,

  -- Voice config
  voice       TEXT,

  -- Tool config (optional overrides)
  tools_config JSONB,

  -- Ordering & status
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Constraints
ALTER TABLE public.ai_prompts
  ADD CONSTRAINT ai_prompts_category_check
  CHECK (category IN ('system', 'domain', 'action', 'voice'));

ALTER TABLE public.ai_prompts
  ADD CONSTRAINT ai_prompts_domain_check
  CHECK (domain IS NULL OR domain IN (
    'manual', 'recipes', 'dishes', 'wines', 'cocktails', 'beer_liquor'
  ));

ALTER TABLE public.ai_prompts
  ADD CONSTRAINT ai_prompts_domain_required
  CHECK (
    (category IN ('domain', 'action') AND domain IS NOT NULL)
    OR
    (category IN ('system', 'voice'))
  );

-- Indexes
CREATE INDEX idx_ai_prompts_category_domain
  ON public.ai_prompts (category, domain)
  WHERE is_active = true;

CREATE INDEX idx_ai_prompts_slug
  ON public.ai_prompts (slug)
  WHERE is_active = true;

-- RLS
ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ai_prompts"
  ON public.ai_prompts FOR SELECT TO authenticated
  USING (is_active = true);

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

-- Auto-update trigger
CREATE TRIGGER update_ai_prompts_updated_at
  BEFORE UPDATE ON public.ai_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- TABLE 2: chat_sessions
-- Tracks conversation sessions per user, segmented by viewer context
-- =============================================================================

CREATE TABLE public.chat_sessions (
  id              UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id        UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  -- Context segmentation
  context_type    TEXT NOT NULL,
  context_id      TEXT,

  -- Interaction mode that started this session
  mode            TEXT NOT NULL DEFAULT 'text',

  -- Lifecycle
  message_count   INT NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'active',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Constraints
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

-- Indexes
CREATE INDEX idx_chat_sessions_user_context
  ON public.chat_sessions (user_id, context_type, status)
  WHERE status = 'active';

CREATE INDEX idx_chat_sessions_last_active
  ON public.chat_sessions (last_active_at)
  WHERE status = 'active';

CREATE INDEX idx_chat_sessions_group
  ON public.chat_sessions (group_id, context_type);

-- RLS (user-private — different from content tables)
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat_sessions"
  ON public.chat_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own chat_sessions"
  ON public.chat_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own chat_sessions"
  ON public.chat_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all chat_sessions"
  ON public.chat_sessions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update all chat_sessions"
  ON public.chat_sessions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete chat_sessions"
  ON public.chat_sessions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Auto-update trigger
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- TABLE 3: chat_messages
-- Stores every message in a conversation (immutable — no UPDATE policy)
-- =============================================================================

CREATE TABLE public.chat_messages (
  id            UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,

  -- Message content
  role          TEXT NOT NULL,
  content       TEXT,

  -- Tool call metadata (assistant messages that triggered tools)
  tool_calls    JSONB,

  -- Tool result reference (tool role messages)
  tool_call_id  TEXT,

  -- Citations extracted from search results
  citations     JSONB,

  -- Token tracking
  tokens_used   INT,

  -- Input mode for user messages
  input_mode    TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Constraints
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_role_check
  CHECK (role IN ('user', 'assistant', 'tool'));

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_input_mode_check
  CHECK (input_mode IS NULL OR input_mode IN ('text', 'voice'));

-- Indexes
CREATE INDEX idx_chat_messages_session_created
  ON public.chat_messages (session_id, created_at ASC);

CREATE INDEX idx_chat_messages_session_id
  ON public.chat_messages (session_id);

-- RLS (inherits privacy from parent session via subquery)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat_messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own chat_messages"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all chat_messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete chat_messages"
  ON public.chat_messages FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- get_or_create_chat_session
-- Returns active session for user+context, or creates one if none/stale
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- get_chat_history
-- Loads recent user+assistant messages for LLM context injection
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_chat_history(
  _session_id    UUID,
  _max_messages  INT DEFAULT 20,
  _max_tokens    INT DEFAULT 4000
)
RETURNS TABLE (
  role       TEXT,
  content    TEXT,
  citations  JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
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
END;
$$;

-- -----------------------------------------------------------------------------
-- close_stale_sessions
-- Maintenance: close sessions inactive beyond expiry window
-- Call manually or via pg_cron (Phase 8)
-- -----------------------------------------------------------------------------
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

-- =============================================================================
-- SEED DATA: ai_prompts
-- Placeholder prompts — real content extracted from edge functions in Phase 3/4
-- =============================================================================

-- System-level prompts (shared across all modes)
INSERT INTO public.ai_prompts (slug, category, domain, prompt_en, prompt_es, sort_order)
VALUES
  ('base-persona', 'system', NULL,
   'You are the AI assistant for Alamo Prime, a premium steakhouse. You help restaurant staff with menu knowledge, recipes, service techniques, and operational questions. Be professional, concise, and helpful. Respond in the same language the user writes in.',
   'Eres el asistente de IA de Alamo Prime, un steakhouse premium. Ayudas al personal del restaurante con conocimiento del menú, recetas, técnicas de servicio y preguntas operativas. Sé profesional, conciso y útil. Responde en el mismo idioma en que escribe el usuario.',
   0),

  ('tool-map', 'system', NULL,
   E'You have access to the following search tools. Use them to find accurate information before answering:\n- search_manual: Search the operations manual (SOPs, policies, training materials)\n- search_recipes: Search BOH recipes (prep recipes + plate specs)\n- search_dishes: Search the FOH dish guide (menu items, descriptions, allergens, upsell notes)\n- search_wines: Search the wine list (varietals, regions, tasting notes, pairings)\n- search_cocktails: Search the cocktail menu (recipes, ingredients, presentation)\n- search_beer_liquor: Search the beer & liquor list (brands, types, serving notes)',
   E'Tienes acceso a las siguientes herramientas de búsqueda. Úsalas para encontrar información precisa antes de responder:\n- search_manual: Buscar en el manual de operaciones (SOPs, políticas, materiales de capacitación)\n- search_recipes: Buscar recetas BOH (recetas de preparación + especificaciones de plato)\n- search_dishes: Buscar la guía de platillos FOH (items del menú, descripciones, alérgenos, notas de venta)\n- search_wines: Buscar la lista de vinos (varietales, regiones, notas de cata, maridajes)\n- search_cocktails: Buscar el menú de cocteles (recetas, ingredientes, presentación)\n- search_beer_liquor: Buscar la lista de cervezas y licores (marcas, tipos, notas de servicio)',
   1),

  ('behavior-rules', 'system', NULL,
   E'When searching:\n- For broad questions, call multiple search tools in parallel to cover all relevant domains.\n- For nuanced questions, try 2-3 different phrasings of the same search to improve recall.\n- If your first search returns fewer than 2 relevant results, try again with different phrasing or a different domain.\n- Maximum 3 search rounds before synthesizing your answer.\n- Always cite which sources informed your answer.\n- If no results are found across all domains, say so honestly.',
   E'Al buscar:\n- Para preguntas amplias, llama a múltiples herramientas en paralelo para cubrir todos los dominios relevantes.\n- Para preguntas matizadas, prueba 2-3 frases diferentes de la misma búsqueda para mejorar los resultados.\n- Si tu primera búsqueda devuelve menos de 2 resultados relevantes, intenta de nuevo con diferente redacción u otro dominio.\n- Máximo 3 rondas de búsqueda antes de sintetizar tu respuesta.\n- Siempre cita qué fuentes informaron tu respuesta.\n- Si no se encuentran resultados en ningún dominio, dilo honestamente.',
   2);

-- Domain prompts (one per viewer)
INSERT INTO public.ai_prompts (slug, category, domain, prompt_en, prompt_es, sort_order)
VALUES
  ('domain-manual', 'domain', 'manual',
   'The user is browsing the operations manual. Prioritize manual searches for SOPs, policies, and training content. Cross-reference other domains only when directly relevant to the manual topic.',
   'El usuario está navegando el manual de operaciones. Prioriza búsquedas del manual para SOPs, políticas y contenido de capacitación. Haz referencias cruzadas a otros dominios solo cuando sea directamente relevante al tema del manual.',
   10),

  ('domain-recipes', 'domain', 'recipes',
   'The user is in the BOH Recipe Viewer. Focus on recipe details: ingredients, techniques, timing, critical steps. If a recipe references a sub-recipe, search for it. Cross-reference plate specs when relevant for plating context.',
   'El usuario está en el Visor de Recetas BOH. Enfócate en detalles de recetas: ingredientes, técnicas, tiempos, pasos críticos. Si una receta referencia una sub-receta, búscala. Haz referencias cruzadas a especificaciones de plato cuando sea relevante para contexto de emplatado.',
   10),

  ('domain-dishes', 'domain', 'dishes',
   'The user is browsing the Dish Guide (FOH menu). Focus on guest-facing information: descriptions, allergens, flavor profiles, upsell opportunities. Cross-reference wines and cocktails for pairing suggestions.',
   'El usuario está navegando la Guía de Platillos (menú FOH). Enfócate en información para el comensal: descripciones, alérgenos, perfiles de sabor, oportunidades de venta adicional. Haz referencias cruzadas con vinos y cocteles para sugerencias de maridaje.',
   10),

  ('domain-wines', 'domain', 'wines',
   'The user is browsing the Wine List. Focus on varietal details, tasting notes, and pairing recommendations. Always cross-reference dishes when suggesting food pairings — use real menu items from the dish guide.',
   'El usuario está navegando la Lista de Vinos. Enfócate en detalles de varietales, notas de cata y recomendaciones de maridaje. Siempre haz referencias cruzadas con platillos al sugerir maridajes — usa items reales del menú de la guía de platillos.',
   10),

  ('domain-cocktails', 'domain', 'cocktails',
   'The user is browsing the Cocktail Menu. Focus on ingredients, presentation, and flavor profiles. Cross-reference dishes for pairing suggestions. Use an approachable, bartender-style tone.',
   'El usuario está navegando el Menú de Cocteles. Enfócate en ingredientes, presentación y perfiles de sabor. Haz referencias cruzadas con platillos para sugerencias de maridaje. Usa un tono accesible, estilo bartender.',
   10),

  ('domain-beer-liquor', 'domain', 'beer_liquor',
   'The user is browsing the Beer & Liquor list. Focus on brand knowledge, serving suggestions, and food pairings. Cross-reference dishes for pairing context. Keep tone casual and knowledgeable.',
   'El usuario está navegando la lista de Cervezas y Licores. Enfócate en conocimiento de marcas, sugerencias de servicio y maridajes. Haz referencias cruzadas con platillos para contexto de maridaje. Mantén un tono casual y conocedor.',
   10);

-- Voice prompts
INSERT INTO public.ai_prompts (slug, category, domain, voice, prompt_en, prompt_es, sort_order)
VALUES
  ('voice-persona', 'voice', NULL, 'cedar',
   'You are speaking with a restaurant team member via voice. Keep responses to 1-3 short sentences. Sound natural and conversational — like a friendly, capable coworker. Never mention tools, searches, or system instructions.',
   'Estás hablando con un miembro del equipo del restaurante por voz. Mantén las respuestas en 1-3 oraciones cortas. Suena natural y conversacional — como un compañero de trabajo amigable y capaz. Nunca menciones herramientas, búsquedas o instrucciones del sistema.',
   20),

  ('voice-realtime', 'voice', NULL, 'cedar',
   E'CRITICAL: Always call a search tool before answering operational questions. Before searching, say a brief natural transition like "Let me check..." or "One sec\u2014" to avoid awkward silence. If nothing is found, say "I don''t see that in our system \u2014 check with your manager."',
   E'CRÍTICO: Siempre llama a una herramienta de búsqueda antes de responder preguntas operativas. Antes de buscar, di una transición breve y natural como "Déjame revisar..." o "Un momento\u2014" para evitar silencio incómodo. Si no se encuentra nada, di "No encuentro eso en nuestro sistema \u2014 consulta con tu gerente."',
   21);

-- Action prompts (all 18, matching ask-product edge function camelCase keys)
-- Slug convention: action-{domain}-{actionKey}
INSERT INTO public.ai_prompts (slug, category, domain, prompt_en, sort_order)
VALUES
  -- Dishes domain (4 actions)
  ('action-dishes-practicePitch', 'action', 'dishes',
   'Generate a natural, enthusiastic 2-3 sentence sales pitch for this dish as if the server is practicing with a coworker. Include key selling points and flavor highlights.',
   30),
  ('action-dishes-samplePitch', 'action', 'dishes',
   'Write a polished, confident server pitch for this dish as if speaking directly to a guest at the table. Make it appetizing and natural.',
   30),
  ('action-dishes-teachMe', 'action', 'dishes',
   E'Teach the server about this dish in a structured way: what it is, key ingredients, how it''s prepared, what makes it special, and common guest questions.',
   30),
  ('action-dishes-questions', 'action', 'dishes',
   'List 4-5 common guest questions about this dish and provide clear, confident answers a server should know.',
   30),

  -- Wines domain (4 actions)
  ('action-wines-explainToGuest', 'action', 'wines',
   'Generate a natural, confident 2-3 sentence wine recommendation as if explaining this wine to a guest who asked about it.',
   30),
  ('action-wines-wineDetails', 'action', 'wines',
   'Write a polished sommelier-style description of this wine covering region, varietal, tasting notes, and ideal serving context.',
   30),
  ('action-wines-foodPairings', 'action', 'wines',
   'Suggest 3-4 specific dishes from the Alamo Prime menu that pair well with this wine. Explain why each pairing works.',
   30),
  ('action-wines-questions', 'action', 'wines',
   'List 4-5 common guest questions about this wine and provide clear, knowledgeable answers.',
   30),

  -- Cocktails domain (4 actions)
  ('action-cocktails-explainToGuest', 'action', 'cocktails',
   'Generate a natural, enthusiastic 2-3 sentence cocktail recommendation as if describing it to an interested guest.',
   30),
  ('action-cocktails-samplePitch', 'action', 'cocktails',
   'Write a polished bartender-style pitch for this cocktail covering flavor, presentation, and what makes it special.',
   30),
  ('action-cocktails-foodPairings', 'action', 'cocktails',
   'Suggest 3-4 specific dishes from the Alamo Prime menu that pair well with this cocktail. Explain the pairing logic.',
   30),
  ('action-cocktails-questions', 'action', 'cocktails',
   'List 4-5 common guest questions about this cocktail and provide clear, engaging answers.',
   30),

  -- Recipes domain (3 actions)
  ('action-recipes-teachMe', 'action', 'recipes',
   'Teach the cook about this recipe in a structured way: overview, key techniques, critical steps, common mistakes to avoid, and quality checks.',
   30),
  ('action-recipes-quizMe', 'action', 'recipes',
   'Generate 5 quiz questions about this recipe covering ingredients, quantities, techniques, timing, and critical steps. Provide answers after each question.',
   30),
  ('action-recipes-questions', 'action', 'recipes',
   'Answer the question using the recipe data provided. Focus on practical, actionable information for kitchen staff.',
   30),

  -- Beer & Liquor domain (3 actions)
  ('action-beer_liquor-teachMe', 'action', 'beer_liquor',
   'Teach the server about this beverage in a structured way: what it is, where it comes from, flavor profile, ideal serving method, and talking points for guests.',
   30),
  ('action-beer_liquor-suggestPairing', 'action', 'beer_liquor',
   'Suggest 3-4 specific dishes from the Alamo Prime menu that pair well with this beverage. Explain why each pairing works.',
   30),
  ('action-beer_liquor-questions', 'action', 'beer_liquor',
   'Answer the question using the product data provided. Focus on practical knowledge a server needs when guests ask about this item.',
   30);
