-- =============================================================================
-- MIGRATION: update_cocktail_prompts_linked_recipes
-- Phase 6D: Adds linked prep recipe guidance to existing cocktail prompts.
--
-- Updates (appends to existing content):
-- 1. ingest-chat-cocktail    — House-made ingredient lookup guidance
-- 2. ingest-extract-cocktail — linkedPrepRecipes extraction rules
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. UPDATE ingest-chat-cocktail (EN) — append house-made ingredients section
-- ---------------------------------------------------------------------------

UPDATE public.ai_prompts
SET
  prompt_en = prompt_en || $append_en$

## House-Made Ingredients

When the user mentions a house-made ingredient (e.g., "our honey-ginger syrup", "house grenadine", "our lavender tincture"), **immediately call `search_recipes`** with `filter_department: "bar"` to find it in the prep recipes database.

If found: note the slug and name — these will be included in `linkedPrepRecipes` during extraction. Confirm the exact measurement with the user (e.g., "How much of the honey-ginger syrup? 0.75 oz?").
If not found: mention that the recipe doesn't exist yet in the system and suggest creating it as a bar prep recipe first, then linking it to this cocktail.

Always ask about measurements for house-made ingredients — they need exact quantities just like any other ingredient (e.g., "0.75 oz honey-ginger syrup", "2 dashes house bitters").$append_en$,

  prompt_es = prompt_es || $append_es$

## Ingredientes Caseros

Cuando el usuario mencione un ingrediente casero (ej., "nuestro jarabe de miel y jengibre", "granadina de la casa", "nuestra tintura de lavanda"), **llama inmediatamente a `search_recipes`** con `filter_department: "bar"` para encontrarlo en la base de datos de recetas de preparacion.

Si se encuentra: nota el slug y nombre — estos se incluiran en `linkedPrepRecipes` durante la extraccion. Confirma la medida exacta con el usuario (ej., "Cuanto del jarabe de miel y jengibre? 0.75 oz?").
Si no se encuentra: menciona que la receta aun no existe en el sistema y sugiere crearla primero como receta de preparacion de bar, luego vincularla a este coctel.

Siempre pregunta sobre las medidas de los ingredientes caseros — necesitan cantidades exactas como cualquier otro ingrediente (ej., "0.75 oz jarabe de miel y jengibre", "2 dashes bitters de la casa").$append_es$,

  updated_at = now()
WHERE slug = 'ingest-chat-cocktail';

-- ---------------------------------------------------------------------------
-- 2. UPDATE ingest-extract-cocktail (EN) — append linkedPrepRecipes rules
-- ---------------------------------------------------------------------------

UPDATE public.ai_prompts
SET
  prompt_en = prompt_en || $append_en$

## linkedPrepRecipes

When the chat mentions house-made ingredients that were found via search_recipes:
- Set `prep_recipe_ref` to the slug returned by the search
- Set `name` to the canonical recipe name from the search result
- Set `quantity` and `unit` from the conversation context (e.g., 0.75 oz, 2 dashes)
- These ingredients should ALSO appear in the `ingredients` text field — `linkedPrepRecipes` is a structured overlay for linking, not a replacement for the ingredient list
- If no house-made ingredients were mentioned or none were found in the database, set `linkedPrepRecipes` to an empty array `[]`

Example linkedPrepRecipes entry:
```json
{
  "prep_recipe_ref": "honey-ginger-syrup",
  "name": "Honey-Ginger Syrup",
  "quantity": 0.75,
  "unit": "oz"
}
```$append_en$,

  prompt_es = prompt_es || $append_es$

## linkedPrepRecipes

Cuando el chat mencione ingredientes caseros que fueron encontrados via search_recipes:
- Establece `prep_recipe_ref` al slug devuelto por la busqueda
- Establece `name` al nombre canonico de la receta del resultado de busqueda
- Establece `quantity` y `unit` del contexto de la conversacion (ej., 0.75 oz, 2 dashes)
- Estos ingredientes tambien DEBEN aparecer en el campo `ingredients` de texto — `linkedPrepRecipes` es una capa estructurada para vinculacion, no un reemplazo de la lista de ingredientes
- Si no se mencionaron ingredientes caseros o ninguno fue encontrado en la base de datos, establece `linkedPrepRecipes` como un arreglo vacio `[]`

Ejemplo de entrada en linkedPrepRecipes:
```json
{
  "prep_recipe_ref": "jarabe-miel-jengibre",
  "name": "Jarabe de Miel y Jengibre",
  "quantity": 0.75,
  "unit": "oz"
}
```$append_es$,

  updated_at = now()
WHERE slug = 'ingest-extract-cocktail';
