-- =============================================================================
-- MIGRATION: create_form_ai_tools
-- Creates (or replaces) the form_ai_tools reference table for the builder UI
-- and seeds 5 tool definitions. Phase 5 of Form Builder System.
--
-- This migration drops and recreates the table if it already exists from a
-- prior migration (20260225170001) because the schema changed:
--   - id is now TEXT PRIMARY KEY (was UUID + tool_id)
--   - added status, search_function columns
--   - removed default_enabled column
-- =============================================================================

BEGIN;

-- Drop the old table if it exists (safe: no FK references to this table)
DROP TABLE IF EXISTS public.form_ai_tools CASCADE;

-- Create with correct schema: TEXT PK (well-known identifiers, not UUIDs)
CREATE TABLE public.form_ai_tools (
  id              TEXT PRIMARY KEY,
  label_en        TEXT NOT NULL,
  label_es        TEXT NOT NULL,
  description_en  TEXT NOT NULL,
  description_es  TEXT NOT NULL,
  search_function TEXT,                -- PG function name (informational, not enforced)
  icon            TEXT,                -- Lucide icon name for builder UI
  status          TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'deprecated')),
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: read-only for authenticated users, no write access via API
ALTER TABLE public.form_ai_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view form_ai_tools"
  ON public.form_ai_tools FOR SELECT TO authenticated
  USING (true);

-- Seed the 5 AI tools
INSERT INTO public.form_ai_tools (id, label_en, label_es, description_en, description_es, search_function, icon, sort_order)
VALUES
  ('search_contacts',
   'Search Contacts', 'Buscar Contactos',
   'Search the restaurant''s contact directory (hospitals, emergency services, management, vendors). Recommended for forms that reference external contacts.',
   'Buscar en el directorio de contactos del restaurante (hospitales, servicios de emergencia, gerencia, proveedores). Recomendado para formularios que referencian contactos externos.',
   'search_contacts', 'BookUser', 1),

  ('search_manual',
   'Search Manual', 'Buscar Manual',
   'Search restaurant policies, procedures, safety protocols, and standard operating procedures. Recommended for forms that reference company policies.',
   'Buscar politicas, procedimientos, protocolos de seguridad y procedimientos operativos del restaurante. Recomendado para formularios que referencian politicas de la empresa.',
   'search_manual_v2', 'BookOpen', 2),

  ('search_products',
   'Search Products', 'Buscar Productos',
   'Search the menu, recipes, wines, cocktails, and beverages. Recommended for forms related to food preparation, allergens, or menu items.',
   'Buscar el menu, recetas, vinos, cocteles y bebidas. Recomendado para formularios relacionados con preparacion de alimentos, alergenos o platillos del menu.',
   'search_dishes', 'UtensilsCrossed', 3),

  ('search_standards',
   'Restaurant Standards', 'Estandares del Restaurante',
   'Search restaurant quality standards including dress code, cleanliness, guest experience protocols, and general operational standards.',
   'Buscar estandares de calidad del restaurante incluyendo codigo de vestimenta, limpieza, protocolos de experiencia del cliente y estandares operativos generales.',
   'search_manual_v2', 'Star', 4),

  ('search_steps_of_service',
   'Steps of Service', 'Pasos de Servicio',
   'Search the Steps of Service guide for front-of-house procedures, greeting protocols, table management, and guest interaction standards.',
   'Buscar la guia de Pasos de Servicio para procedimientos de frente de casa, protocolos de bienvenida, manejo de mesas y estandares de interaccion con el cliente.',
   'search_manual_v2', 'ListChecks', 5);

COMMIT;
