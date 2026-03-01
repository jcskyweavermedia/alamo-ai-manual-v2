-- =============================================================================
-- Phase 5 Migration 2: Create form_ai_tools config table + seed data
-- =============================================================================

CREATE TABLE IF NOT EXISTS form_ai_tools (
  id              UUID        PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  tool_id         TEXT        UNIQUE NOT NULL,
  label_en        TEXT        NOT NULL,
  label_es        TEXT        NOT NULL,
  description_en  TEXT        NOT NULL,
  description_es  TEXT        NOT NULL,
  icon            TEXT        NOT NULL DEFAULT 'Wrench',
  default_enabled BOOLEAN     NOT NULL DEFAULT true,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: read-only for authenticated users
ALTER TABLE form_ai_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read form_ai_tools"
  ON form_ai_tools FOR SELECT
  TO authenticated
  USING (true);

-- Seed 5 AI tools
INSERT INTO form_ai_tools (tool_id, label_en, label_es, description_en, description_es, icon, default_enabled, sort_order)
VALUES
  (
    'search_contacts',
    'Contact Lookup',
    'Búsqueda de Contactos',
    'Search vendor and supplier contacts to auto-fill contact fields',
    'Buscar contactos de proveedores para auto-llenar campos de contacto',
    'Users',
    true,
    1
  ),
  (
    'search_manual',
    'Operations Manual',
    'Manual de Operaciones',
    'Search the restaurant operations manual for procedures and standards',
    'Buscar el manual de operaciones del restaurante para procedimientos y estándares',
    'BookOpen',
    true,
    2
  ),
  (
    'search_products',
    'Product Database',
    'Base de Datos de Productos',
    'Search recipes, dishes, wines, cocktails, and beer/liquor',
    'Buscar recetas, platillos, vinos, cócteles y cervezas/licores',
    'UtensilsCrossed',
    true,
    3
  ),
  (
    'search_standards',
    'Restaurant Standards',
    'Estándares del Restaurante',
    'Search food safety, hygiene, and operational standards',
    'Buscar estándares de seguridad alimentaria, higiene y operaciones',
    'ShieldCheck',
    false,
    4
  ),
  (
    'search_steps_of_service',
    'Steps of Service',
    'Pasos del Servicio',
    'Search the steps of service guide for FOH procedures',
    'Buscar la guía de pasos del servicio para procedimientos de FOH',
    'ListChecks',
    false,
    5
  )
ON CONFLICT (tool_id) DO NOTHING;
