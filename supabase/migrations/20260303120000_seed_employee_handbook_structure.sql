-- ============================================
-- SEED EMPLOYEE HANDBOOK: Structural entries (no content yet)
--
-- Creates 8 rows:
--   1 category folder (employee-handbook, sort_order 10)
--   7 child sections
--
-- Also bumps Appendix from sort_order 10 → 11
-- so Employee Handbook slots between Brand Standards (9) and Appendix (11).
--
-- Fixed UUID for category folder:
--   employee-handbook: 10000000-0000-0000-0000-000000000011
-- ============================================

BEGIN;

-- ============================================
-- BUMP APPENDIX: sort_order 10 → 11
-- ============================================

UPDATE public.manual_sections
SET sort_order = 11
WHERE slug = 'appendix';

-- ============================================
-- EMPLOYEE HANDBOOK CATEGORY FOLDER (level 0, is_category = true)
-- ============================================

INSERT INTO public.manual_sections (id, file_path, slug, title_en, title_es, category, tags, sort_order, level, is_category)
VALUES
  ('10000000-0000-0000-0000-000000000011', '11-employee-handbook', 'employee-handbook', 'Employee Handbook', 'Manual del Empleado', 'employee-handbook', ARRAY['employee-handbook','hr','policies','conduct','attendance'], 10, 0, true);

-- ============================================
-- EMPLOYEE HANDBOOK CHILDREN (level 1, parent = 11)
-- ============================================

INSERT INTO public.manual_sections (parent_id, file_path, slug, title_en, title_es, category, tags, sort_order, level, is_category, word_count_en, word_count_es)
VALUES
  ('10000000-0000-0000-0000-000000000011', '11-employee-handbook/README.md',                          'employee-handbook-overview',  'Employee Handbook Overview',       'Visión General del Manual del Empleado', 'employee-handbook', ARRAY['handbook','overview','welcome','introduction'],               0, 1, false, 1500, 1500),
  ('10000000-0000-0000-0000-000000000011', '11-employee-handbook/11-01-attendance-punctuality.md',    'attendance-punctuality',      'Attendance & Punctuality',         'Asistencia y Puntualidad',               'employee-handbook', ARRAY['attendance','punctuality','tardiness','absences','scheduling'], 1, 1, false, 1200, 1200),
  ('10000000-0000-0000-0000-000000000011', '11-employee-handbook/11-02-professional-conduct.md',      'professional-conduct',        'Professional Conduct & Attitude',  'Conducta Profesional y Actitud',         'employee-handbook', ARRAY['conduct','attitude','teamwork','respect','professionalism'],   2, 1, false, 1200, 1200),
  ('10000000-0000-0000-0000-000000000011', '11-employee-handbook/11-03-dress-code-appearance.md',     'dress-code-appearance',       'Dress Code & Appearance',          'Código de Vestimenta y Apariencia',      'employee-handbook', ARRAY['dress-code','uniform','appearance','grooming','hygiene'],      3, 1, false, 1000, 1000),
  ('10000000-0000-0000-0000-000000000011', '11-employee-handbook/11-04-time-off-vacation.md',         'time-off-vacation',           'Time Off & Vacation',              'Tiempo Libre y Vacaciones',              'employee-handbook', ARRAY['time-off','vacation','pto','sick-leave','holidays'],           4, 1, false, 1200, 1200),
  ('10000000-0000-0000-0000-000000000011', '11-employee-handbook/11-05-performance-standards.md',     'performance-standards',       'Performance Standards',            'Estándares de Desempeño',               'employee-handbook', ARRAY['performance','standards','evaluations','goals','feedback'],    5, 1, false, 1200, 1200),
  ('10000000-0000-0000-0000-000000000011', '11-employee-handbook/11-06-disciplinary-policy.md',       'disciplinary-policy',         'Disciplinary Policy',              'Política Disciplinaria',                 'employee-handbook', ARRAY['discipline','policy','violations','progressive','termination'], 6, 1, false, 1200, 1200);

COMMIT;
