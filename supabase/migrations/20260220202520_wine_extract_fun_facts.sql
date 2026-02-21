-- =============================================================================
-- MIGRATION: wine_extract_fun_facts
-- Update ingest-extract-wine prompt so producerNotes captures fun facts,
-- anecdotes, and conversation starters — not just dry winery history.
-- =============================================================================

-- Update EN producerNotes field description
UPDATE public.ai_prompts
SET
  prompt_en = replace(
    prompt_en,
    '- **producerNotes**: Background about the producer, winery history, winemaking philosophy. Leave empty string if not discussed.',
    '- **producerNotes**: Background about the producer, winery history, winemaking philosophy, and **fun facts** — interesting stories, celebrity connections, quirky history, unique winemaking techniques, or surprising trivia that servers would enjoy sharing with guests at the table. Leave empty string if not discussed.'
  ),
  prompt_es = replace(
    prompt_es,
    '- **producerNotes**: Informacion sobre el productor, historia de la bodega, filosofia de vinificacion. Deja cadena vacia si no se discutio.',
    '- **producerNotes**: Informacion sobre el productor, historia de la bodega, filosofia de vinificacion, y **datos curiosos** — historias interesantes, conexiones con celebridades, historia peculiar, tecnicas unicas de vinificacion, o trivia sorprendente que los meseros disfrutarian compartir con los comensales en la mesa. Deja cadena vacia si no se discutio.'
  ),
  updated_at = now()
WHERE slug = 'ingest-extract-wine';
