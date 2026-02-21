-- =============================================================================
-- MIGRATION: create_ingestion_tables
-- Creates ingestion_sessions + ingestion_messages tables for the data
-- ingestion system (chat-based, file upload, image upload, edit workflows)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 1: ingestion_sessions
-- Tracks AI-assisted data ingestion workflows per product type
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.ingestion_sessions (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),

  -- What product type and method
  product_table TEXT NOT NULL CHECK (product_table IN (
    'prep_recipes','plate_specs','foh_plate_specs','wines','cocktails','beer_liquor_list'
  )),
  ingestion_method TEXT NOT NULL DEFAULT 'chat' CHECK (ingestion_method IN (
    'chat','file_upload','image_upload','edit'
  )),

  -- Session status
  status TEXT NOT NULL DEFAULT 'drafting' CHECK (status IN (
    'drafting','review','publishing','published','failed','abandoned'
  )),

  -- The actual draft data (matches target table's JSONB schema)
  draft_data JSONB NOT NULL DEFAULT '{}',
  draft_version INTEGER NOT NULL DEFAULT 1,

  -- Linkage to published product (set on publish)
  product_id UUID,

  -- If editing an existing product, link to it
  editing_product_id UUID,

  -- AI metadata
  ai_confidence NUMERIC(3,2),
  missing_fields TEXT[] NOT NULL DEFAULT '{}',

  -- File upload metadata
  source_file_name TEXT,
  source_file_type TEXT,

  -- Owner
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 2: ingestion_messages
-- Chat messages within an ingestion session (immutable)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.ingestion_messages (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ingestion_sessions(id) ON DELETE CASCADE,

  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,

  -- When AI updates the draft, the delta is stored here
  draft_updates JSONB,

  -- OpenAI tool calls metadata
  tool_calls JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_ingestion_sessions_created_by
  ON public.ingestion_sessions (created_by);

CREATE INDEX idx_ingestion_sessions_status
  ON public.ingestion_sessions (status);

CREATE INDEX idx_ingestion_messages_session_id
  ON public.ingestion_messages (session_id);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_ingestion_sessions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ingestion_sessions_updated_at
  BEFORE UPDATE ON public.ingestion_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_ingestion_sessions_updated_at();

-- =============================================================================
-- RLS POLICIES: ingestion_sessions
-- =============================================================================

ALTER TABLE public.ingestion_sessions ENABLE ROW LEVEL SECURITY;

-- SELECT: Admins and managers can view all; regular users can view their own
CREATE POLICY "Admins can view all ingestion_sessions"
  ON public.ingestion_sessions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Managers can view all ingestion_sessions"
  ON public.ingestion_sessions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::user_role));

CREATE POLICY "Users can view own ingestion_sessions"
  ON public.ingestion_sessions FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- INSERT: Admins only
CREATE POLICY "Admins can insert ingestion_sessions"
  ON public.ingestion_sessions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- UPDATE: Creator can update own sessions (must be admin)
CREATE POLICY "Admins can update own ingestion_sessions"
  ON public.ingestion_sessions FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (created_by = auth.uid() AND has_role(auth.uid(), 'admin'::user_role));

-- DELETE: Admin only
CREATE POLICY "Admins can delete ingestion_sessions"
  ON public.ingestion_sessions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- =============================================================================
-- RLS POLICIES: ingestion_messages
-- =============================================================================

ALTER TABLE public.ingestion_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view messages for sessions they created
CREATE POLICY "Users can view own ingestion_messages"
  ON public.ingestion_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ingestion_sessions
      WHERE id = ingestion_messages.session_id
        AND created_by = auth.uid()
    )
  );

-- INSERT: Users can insert messages for their own sessions
CREATE POLICY "Users can insert own ingestion_messages"
  ON public.ingestion_messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ingestion_sessions
      WHERE id = ingestion_messages.session_id
        AND created_by = auth.uid()
    )
  );

-- UPDATE: Nobody (messages are immutable) — no policy created

-- DELETE: Admin only
CREATE POLICY "Admins can delete ingestion_messages"
  ON public.ingestion_messages FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- =============================================================================
-- SEED DATA: ai_prompts for ingestion system
-- =============================================================================

INSERT INTO public.ai_prompts (id, slug, category, domain, prompt_en, prompt_es, is_active)
VALUES (
  extensions.gen_random_uuid(),
  'ingest-prep-recipe',
  'system',
  NULL,
  'You are an AI recipe structuring assistant for Alamo Prime steakhouse. Your job is to take unstructured recipe descriptions from chefs and structure them into a precise JSON format.

When the user describes a recipe, extract and organize:
1. **Name**: The recipe name
2. **Prep Type**: One of: sauce, marinade, rub, base, garnish, dressing, stock, compound, brine, other
3. **Yield**: quantity and unit (e.g., 2 qt, 1 gal)
4. **Shelf Life**: value and unit (e.g., 5 days, 2 weeks)
5. **Tags**: Relevant keywords (e.g., argentinian, steak, herb)
6. **Ingredients**: Grouped by category (e.g., Herb Base, Liquid, Seasoning). Each ingredient needs: name, quantity (number), unit, and any allergens
7. **Procedure**: Grouped by phase (e.g., Prep, Cook, Store). Each step needs: instruction text. Mark critical steps (food safety, technique-critical)
8. **Batch Scaling**: Notes on how the recipe scales
9. **Training Notes**: Common mistakes, quality checks

Be thorough but concise. If information is missing, note it in your response and include reasonable defaults. Always respond with your analysis AND use the update_draft tool to set the structured data.',
  'Eres un asistente de estructuracion de recetas para el steakhouse Alamo Prime. Tu trabajo es tomar descripciones no estructuradas de recetas de los chefs y organizarlas en un formato JSON preciso.

Cuando el usuario describe una receta, extrae y organiza:
1. **Nombre**: El nombre de la receta
2. **Tipo de preparacion**: Uno de: sauce, marinade, rub, base, garnish, dressing, stock, compound, brine, other
3. **Rendimiento**: cantidad y unidad (ej., 2 qt, 1 gal)
4. **Vida util**: valor y unidad (ej., 5 days, 2 weeks)
5. **Etiquetas**: Palabras clave relevantes
6. **Ingredientes**: Agrupados por categoria. Cada ingrediente necesita: nombre, cantidad (numero), unidad y alergenos
7. **Procedimiento**: Agrupado por fase. Cada paso necesita: texto de instruccion. Marca pasos criticos
8. **Escalado por lote**: Notas sobre como escala la receta
9. **Notas de entrenamiento**: Errores comunes, controles de calidad

Se exhaustivo pero conciso. Si falta informacion, indicalo y usa valores predeterminados razonables.',
  true
);
