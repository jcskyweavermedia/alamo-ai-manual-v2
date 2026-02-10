-- ============================================
-- SEED MANUAL SECTIONS: Structural entries (no content yet)
--
-- Creates 34 rows:
--   6 top-level content sections
--   4 category folders (is_category = true)
--   10 team roles children
--   5 operational procedures children
--   5 guest services children
--   4 appendix children
--
-- Content columns (content_en, content_es) are NULL.
-- They will be populated in a separate step.
-- Search vectors auto-generate via trigger when content is added.
-- ============================================

-- Fixed UUIDs for category folders (so children can reference parent_id)
-- team-roles:              10000000-0000-0000-0000-000000000006
-- operational-procedures:  10000000-0000-0000-0000-000000000007
-- guest-services:          10000000-0000-0000-0000-000000000008
-- appendix:                10000000-0000-0000-0000-000000000010

BEGIN;

-- ============================================
-- TOP-LEVEL CONTENT SECTIONS (level 0, is_category = false)
-- ============================================

INSERT INTO public.manual_sections (file_path, slug, title_en, title_es, category, tags, sort_order, level, is_category, word_count_en, word_count_es)
VALUES
  ('01-welcome-philosophy.md', 'welcome-philosophy', 'Welcome Philosophy', 'Filosofía de Bienvenida', 'welcome', ARRAY['welcome','philosophy','introduction','brand'], 1, 0, false, 3000, 3000),
  ('02-company-overview.md', 'company-overview', 'Company Overview', 'Visión General y Filosofía', 'company', ARRAY['company','overview','information','brand'], 2, 0, false, 2500, 2500),
  ('03-core-values.md', 'core-values', 'Core Values', 'Valores Fundamentales', 'values', ARRAY['core-values','culture','teamwork','excellence'], 3, 0, false, 3000, 3000),
  ('04-service-excellence.md', 'service-excellence', 'Service Excellence', 'Excelencia en Servicio', 'service', ARRAY['service','excellence','SHOW','hospitality'], 4, 0, false, 4000, 4000),
  ('05-hours-operations.md', 'hours-operations', 'Hours of Operations', 'Horarios de Operación', 'operations', ARRAY['hours','operations','schedule','timing'], 5, 0, false, 2500, 2500),
  ('09-brand-standards.md', 'brand-standards', 'Brand Standards', 'Estándares de Marca', 'brand', ARRAY['brand-standards','appearance','professionalism','visual-identity'], 9, 0, false, 3500, 3500);

-- ============================================
-- CATEGORY FOLDERS (level 0, is_category = true)
-- ============================================

INSERT INTO public.manual_sections (id, file_path, slug, title_en, title_es, category, tags, sort_order, level, is_category)
VALUES
  ('10000000-0000-0000-0000-000000000006', '06-team-roles', 'team-roles', 'Team Roles', 'Roles del Equipo', 'team-roles', ARRAY['team-roles','overview','structure','organization'], 6, 0, true),
  ('10000000-0000-0000-0000-000000000007', '07-operational-procedures', 'operational-procedures', 'Operational Procedures', 'Procedimientos Operativos', 'operational-procedures', ARRAY['procedures','operations','overview','framework'], 7, 0, true),
  ('10000000-0000-0000-0000-000000000008', '08-guest-services', 'guest-services', 'Guest Services', 'Servicios a Huéspedes', 'guest-services', ARRAY['guest-services','overview','communication','support'], 8, 0, true),
  ('10000000-0000-0000-0000-000000000010', '10-appendix', 'appendix', 'Appendix', 'Apéndice', 'appendix', ARRAY['appendix','overview','reference','resources'], 10, 0, true);

-- ============================================
-- TEAM ROLES CHILDREN (level 1, parent = 06)
-- ============================================

INSERT INTO public.manual_sections (parent_id, file_path, slug, title_en, title_es, category, tags, sort_order, level, is_category, word_count_en, word_count_es)
VALUES
  ('10000000-0000-0000-0000-000000000006', '06-team-roles/README.md', 'team-roles-overview', 'Team Roles Overview', 'Visión General de Roles del Equipo', 'team-roles', ARRAY['team-roles','overview','structure','organization'], 0, 1, false, 2000, 2000),
  ('10000000-0000-0000-0000-000000000006', '06-team-roles/06-01-host-essentials.md', 'host-essentials', 'Host Essentials', 'Esencial del Anfitrión', 'team-roles', ARRAY['host','essentials','greeting','reservations'], 1, 1, false, 3500, 3500),
  ('10000000-0000-0000-0000-000000000006', '06-team-roles/06-02-server-standards.md', 'server-standards', 'Server Standards', 'Estándares del Mesero', 'team-roles', ARRAY['server','standards','service','procedures'], 2, 1, false, 4000, 4000),
  ('10000000-0000-0000-0000-000000000006', '06-team-roles/06-03-bus-person-procedures.md', 'bus-person-procedures', 'Bus Person Procedures', 'Procedimientos del Ayudante de Mesa', 'team-roles', ARRAY['bus-person','procedures','support','cleaning'], 3, 1, false, 3500, 3500),
  ('10000000-0000-0000-0000-000000000006', '06-team-roles/06-04-management-roles.md', 'management-roles', 'Management Roles', 'Roles de Gestión', 'team-roles', ARRAY['management','leadership','operations','administration'], 4, 1, false, 4000, 4000),
  ('10000000-0000-0000-0000-000000000006', '06-team-roles/06-05-line-cook-standards.md', 'line-cook-standards', 'Line Cook Standards', 'Estándares de Cocinero de Línea', 'team-roles', ARRAY['line-cook','cooking','food-preparation','kitchen'], 5, 1, false, 4000, 4000),
  ('10000000-0000-0000-0000-000000000006', '06-team-roles/06-06-prep-cook-procedures.md', 'prep-cook-procedures', 'Prep Cook Procedures', 'Procedimientos de Cocinero de Preparación', 'team-roles', ARRAY['prep-cook','food-preparation','kitchen-organization','sanitation'], 6, 1, false, 3500, 3500),
  ('10000000-0000-0000-0000-000000000006', '06-team-roles/06-07-dishwasher-operations.md', 'dishwasher-operations', 'Dishwasher Operations', 'Operaciones de Lavaplatos', 'team-roles', ARRAY['dishwasher','sanitation','cleanliness','kitchen-maintenance'], 7, 1, false, 3000, 3000),
  ('10000000-0000-0000-0000-000000000006', '06-team-roles/06-08-bartender-standards.md', 'bartender-standards', 'Bartender Standards', 'Estándares de Bartender', 'team-roles', ARRAY['bartender','beverage-service','bar-operations','guest-experience'], 8, 1, false, 4000, 4000),
  ('10000000-0000-0000-0000-000000000006', '06-team-roles/06-09-security-host-support.md', 'security-host-support', 'Security and Host Support', 'Apoyo de Seguridad y Anfitrión', 'team-roles', ARRAY['security','host-support','safety','guest-assistance'], 9, 1, false, 3500, 3500);

-- ============================================
-- OPERATIONAL PROCEDURES CHILDREN (level 1, parent = 07)
-- ============================================

INSERT INTO public.manual_sections (parent_id, file_path, slug, title_en, title_es, category, tags, sort_order, level, is_category, word_count_en, word_count_es)
VALUES
  ('10000000-0000-0000-0000-000000000007', '07-operational-procedures/README.md', 'operational-procedures-overview', 'Operational Procedures Overview', 'Visión General de Procedimientos Operativos', 'operational-procedures', ARRAY['procedures','operations','overview','framework'], 0, 1, false, 2000, 2000),
  ('10000000-0000-0000-0000-000000000007', '07-operational-procedures/07-01-opening-duties.md', 'opening-duties', 'Opening Duties', 'Tareas de Apertura', 'operational-procedures', ARRAY['opening','duties','preparation','setup'], 1, 1, false, 3500, 3500),
  ('10000000-0000-0000-0000-000000000007', '07-operational-procedures/07-02-ongoing-operations.md', 'ongoing-operations', 'Ongoing Operations', 'Operaciones Continuas', 'operational-procedures', ARRAY['ongoing','operations','continuous','service'], 2, 1, false, 3500, 3500),
  ('10000000-0000-0000-0000-000000000007', '07-operational-procedures/07-03-closing-protocols.md', 'closing-protocols', 'Closing Protocols', 'Protocolos de Cierre', 'operational-procedures', ARRAY['closing','protocols','shutdown','procedures'], 3, 1, false, 3500, 3500),
  ('10000000-0000-0000-0000-000000000007', '07-operational-procedures/07-04-environment-standards.md', 'environment-standards', 'Environment Standards', 'Estándares de Ambiente', 'operational-procedures', ARRAY['environment','standards','facility','maintenance'], 4, 1, false, 3500, 3500);

-- ============================================
-- GUEST SERVICES CHILDREN (level 1, parent = 08)
-- ============================================

INSERT INTO public.manual_sections (parent_id, file_path, slug, title_en, title_es, category, tags, sort_order, level, is_category, word_count_en, word_count_es)
VALUES
  ('10000000-0000-0000-0000-000000000008', '08-guest-services/README.md', 'guest-services-overview', 'Guest Services Overview', 'Visión General de Servicios a Huéspedes', 'guest-services', ARRAY['guest-services','overview','communication','support'], 0, 1, false, 2000, 2000),
  ('10000000-0000-0000-0000-000000000008', '08-guest-services/08-01-telephone-etiquette.md', 'telephone-etiquette', 'Telephone Etiquette', 'Etiqueta Telefónica', 'guest-services', ARRAY['telephone','etiquette','communication','professional'], 1, 1, false, 3000, 3000),
  ('10000000-0000-0000-0000-000000000008', '08-guest-services/08-02-reservation-management.md', 'reservation-management', 'Reservation Management', 'Gestión de Reservas', 'guest-services', ARRAY['reservations','management','booking','guest'], 2, 1, false, 3500, 3500),
  ('10000000-0000-0000-0000-000000000008', '08-guest-services/08-03-guest-recovery.md', 'guest-recovery', 'Guest Recovery', 'Recuperación de Huéspedes', 'guest-services', ARRAY['guest-recovery','problem-resolution','service-recovery'], 3, 1, false, 3500, 3500),
  ('10000000-0000-0000-0000-000000000008', '08-guest-services/08-04-frequently-asked.md', 'frequently-asked', 'Frequently Asked Questions', 'Preguntas Frecuentes', 'guest-services', ARRAY['FAQ','questions','information','guest'], 4, 1, false, 3000, 3000);

-- ============================================
-- APPENDIX CHILDREN (level 1, parent = 10)
-- ============================================

INSERT INTO public.manual_sections (parent_id, file_path, slug, title_en, title_es, category, tags, sort_order, level, is_category, word_count_en, word_count_es)
VALUES
  ('10000000-0000-0000-0000-000000000010', '10-appendix/README.md', 'appendix-overview', 'Appendix Overview', 'Visión General del Apéndice', 'appendix', ARRAY['appendix','overview','reference','resources'], 0, 1, false, 2000, 2000),
  ('10000000-0000-0000-0000-000000000010', '10-appendix/10-01-terminology.md', 'terminology', 'Restaurant Terminology', 'Terminología del Restaurante', 'appendix', ARRAY['terminology','vocabulary','abbreviations','restaurant-terms'], 1, 1, false, 4000, 4000),
  ('10000000-0000-0000-0000-000000000010', '10-appendix/10-02-checklists.md', 'checklists', 'Daily Operational Checklists', 'Listas de Verificación Operacional Diaria', 'appendix', ARRAY['checklists','daily-procedures','opening','closing'], 2, 1, false, 4000, 4000),
  ('10000000-0000-0000-0000-000000000010', '10-appendix/10-03-contact-info.md', 'contact-info', 'Important Contacts and Resources', 'Contactos Importantes y Recursos', 'appendix', ARRAY['contacts','resources','emergency','vendors'], 3, 1, false, 3000, 3000);

COMMIT;
