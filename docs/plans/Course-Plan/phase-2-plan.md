# Phase 2: Learning — Detailed Implementation Plan

> AI teacher panel, persistent conversations, content viewer integration.
> **Goal**: Staff can have AI-guided learning sessions alongside existing content viewers.

---

## Agent Outputs

Two specialist agents produced the following artifacts:

| Agent | Output | Deliverables |
|-------|--------|-------------|
| **AI/Edge Function Engineer** | Training domain handler, Socratic teacher prompt (EN+ES), realtime-session training mode | 1 migration, 2 edge function modifications |
| **Frontend Architect** | Complete TypeScript code for 9 files (+ 1 App.tsx modification) | 3 components, 2 hooks, 1 page, 1 types update |

---

## Alignment Issues to Resolve During Implementation

The two agents worked independently. These discrepancies MUST be resolved when writing the final code:

### Issue 1: Edge Function Request Field Naming
- **AI/Edge Function Engineer**: Expects camelCase fields in the handler: `sectionId`, `contentContext`, `conversationHistory`, `topicsCovered`, `topicsTotal`
- **Frontend Architect**: Sends snake_case fields from the hook: `section_id`, `content_context`, `conversation_history`, `topics_covered`, `topics_total`
- **Resolution**: Standardize on snake_case in the HTTP request body (matching existing /ask convention). Update the `handleTrainingDomain()` to destructure snake_case fields.

### Issue 2: AI Response topics_update Shape
- **AI/Edge Function Engineer**: Returns `topics_update: { covered: string[], total: string[] }` (nested object)
- **Frontend Architect**: Treats `topics_update` as a flat `string[]` in the hook: `const newTopics = aiResponse.topics_update || topicsCovered`
- **Resolution**: Frontend hook must parse the nested object: `aiResponse.topics_update.covered` for covered topics. Update hook parsing logic.

### Issue 3: conversationId Field
- **AI/Edge Function Engineer**: Handler references `trainingRequest.conversationId` for server-side message persistence
- **Frontend Architect**: Does NOT send `conversationId` in the request — handles persistence client-side via Supabase insert/update
- **Resolution**: Remove server-side persistence from the handler. The frontend handles all persistence in `use-training-chat.ts`. This is cleaner — the edge function stays stateless.

### Issue 4: ai_prompts Table Schema Assumptions
- **AI/Edge Function Engineer**: Migration uses columns `domain`, `sort_order`, `is_active` and `ON CONFLICT (slug)`
- **Actual table**: May not have all these columns (needs verification before applying migration)
- **Resolution**: Query `ai_prompts` table schema before applying. Add missing columns or adjust migration to match actual schema.

### Issue 5: Course.status Type Mismatch (Carried from Phase 1)
- **Frontend Architect types file**: Defines `Course.status` as `'draft' | 'active' | 'archived'`
- **Phase 1 resolution**: Standardized on `'published' | 'draft' | 'archived'`
- **Resolution**: Update the types file to use `'published' | 'draft' | 'archived'` per Phase 1 decision.

### Issue 6: Product Type Transforms Duplication
- **Frontend Architect**: `use-learning-session.ts` includes full snake_case→camelCase transform functions for all product types (Dish, Wine, Cocktail, etc.)
- **Existing codebase**: These transforms already exist in the individual data hooks (`use-supabase-dishes.ts`, etc.)
- **Resolution**: Extract shared transforms to a utility, OR keep duplicated in the hook for self-containment. Prefer keeping duplicated to avoid modifying existing files.

### Issue 7: MarkdownRenderer Import
- **Frontend Architect**: ContentPanel imports `MarkdownRenderer` from `@/components/manual/MarkdownRenderer`
- **Actual location**: Needs verification that this component exists and accepts a `content` prop
- **Resolution**: Verify import path before writing. If it doesn't exist, use a simple `dangerouslySetInnerHTML` with markdown-to-html, or create a minimal renderer.

### Issue 8: RecipeCardView Extra Props
- **Frontend Architect**: Passes `batchMultiplier={1}` and `onBatchChange={noop}` to RecipeCardView
- **Actual component**: May or may not require these props
- **Resolution**: Read RecipeCardView props interface before writing. Omit if not required.

---

## Step-by-Step Implementation Order

### Step 2.1 — Verify Prerequisites

Before implementing Phase 2, confirm Phase 1 is complete:
- [ ] 12 training tables exist in Supabase
- [ ] 7 courses + 35 sections seeded
- [ ] `src/types/training.ts` exists with all Phase 1 types
- [ ] Phase 1 hooks exist: use-courses, use-course-sections, use-section-progress, use-enrollment
- [ ] Training nav item in sidebar, `/training` and `/training/:courseSlug` routes working
- [ ] `ai_prompts` table schema verified (check for `domain`, `sort_order`, `is_active` columns)

### Step 2.2 — Apply AI Prompt Seed Migration

**File**: `supabase/migrations/20260214000000_seed_training_ai_prompts.sql`

Seeds the 'training-teacher' Socratic prompt (EN+ES) into `ai_prompts` table.

**Verify:**
```sql
SELECT slug, LEFT(prompt_en, 80) FROM ai_prompts WHERE slug = 'training-teacher';
```

### Step 2.3 — Modify `/ask` Edge Function

**File**: `supabase/functions/ask/index.ts` (MODIFY)

Add:
- `TrainingAskRequest` and `TrainingAskResponse` type definitions
- `handleTrainingDomain()` function (~120 lines)
- Domain branching: `if (domain === 'training') { ... }` before existing action/search logic
- Uses OpenAI structured JSON output (`response_format: json_schema`) for reliable parsing
- Fetches training-teacher prompt from `ai_prompts` table
- Builds context-rich system prompt with content, session summary, and topic tracking

**Verify:**
```bash
curl -X POST https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/ask \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"What should I know about this dish?","domain":"training","section_id":"...","content_context":"Ribeye 16oz: bone-in, dry-aged...","conversation_history":[],"topics_covered":[],"topics_total":["key ingredients","cooking method","allergens"],"language":"en","groupId":"..."}'
```

### Step 2.4 — Modify `/realtime-session` Edge Function

**File**: `supabase/functions/realtime-session/index.ts` (MODIFY)

Add:
- `mode?: 'standard' | 'training'` to SessionRequest interface
- `sectionId`, `contentContext`, `conversationHistory` fields
- Training mode handler: fetches training-teacher prompt, builds context, uses PTT mode
- No search tools in training mode (content is pre-loaded in prompt)
- Voice set to 'coral' (warm, friendly) for training

### Step 2.5 — Create UI Components (3 components)

| Component | Purpose | Lines |
|-----------|---------|-------|
| `ChatBubble.tsx` | Left/right message bubbles with role-based styling | ~48 |
| `SuggestedReplyChips.tsx` | Flex-wrap row of tappable quick-response chips | ~40 |
| `ProgressStrip.tsx` | Thin topic coverage bar with bilingual label | ~30 |

### Step 2.6 — Create Training Chat Hook

**File**: `src/hooks/use-training-chat.ts` (~260 lines)

Core state management for training conversations:
- Loads previous conversations from `course_conversations`
- Sends messages via `/ask` with `domain: 'training'`
- Parses structured AI response (reply + suggested_replies + topics_update + should_suggest_quiz)
- Persists messages to `course_conversations` table (client-side)
- Supports session resume and new session creation
- Error handling with bilingual error messages

### Step 2.7 — Create TrainingChatPanel Component

**File**: `src/components/training/TrainingChatPanel.tsx` (~280 lines)

Full AI teacher panel:
- Header with GraduationCap icon + section title
- Scrollable message area with auto-scroll
- Loading dots animation while AI responds
- SuggestedReplyChips after last AI message
- ProgressStrip for topic tracking
- Text input with Enter key and Send button
- Resume UI card for previous sessions
- Empty state for new conversations

### Step 2.8 — Create ContentPanel Component

**File**: `src/components/training/ContentPanel.tsx` (~190 lines)

Routes to existing card views based on `content_source`:
- `foh_plate_specs` → DishCardView
- `wines` → WineCardView
- `cocktails` → CocktailCardView
- `beer_liquor_list` → BeerLiquorCardView
- `prep_recipes` / `plate_specs` → RecipeCardView
- `manual_sections` → ManualSectionContent (markdown renderer)
- `custom` → CustomSectionContent (AI-only, no viewer)

Card views receive `noop` callbacks for onBack/activeAction/onActionChange (AI handled by chat panel).

Includes item navigation header for multi-item sections (e.g., "Item 2 of 3 [<] [>]").

### Step 2.9 — Create Learning Session Hook

**File**: `src/hooks/use-learning-session.ts` (~320 lines)

Orchestrates:
1. Fetch course + all sections by slug
2. Fetch content items from source table using `content_ids`
3. Transform snake_case → camelCase for all product types
4. Serialize content into plain text for AI context
5. Track current item index for multi-item sections
6. Compute prev/next section for section navigation
7. Fetch section progress for current user
8. Auto-enroll user on first visit (silent fail if RLS blocks)

Content serialization examples:
- Dish: `"Ribeye 16oz: dry-aged, bone-in | Allergens: none | Key ingredients: prime beef, butter, herbs"`
- Wine: `"Veuve Clicquot: Champagne, Pinot Noir/Chardonnay/Meunier | Tasting: citrus, brioche, fine bubbles"`
- Manual: First 3000 chars of markdown content

### Step 2.10 — Create LearningSession Page

**File**: `src/pages/LearningSession.tsx` (~210 lines)

**iPad Layout (≥768px):**
```
┌──────────────────────────────────┬───────────────────────────┐
│ ← Course Title      [<] [3] [>] │                     EN|ES │
├──────────────────────────────────┼───────────────────────────┤
│  ContentPanel (55%)              │  TrainingChatPanel (45%)  │
└──────────────────────────────────┴───────────────────────────┘
```

**Phone Layout (<768px):**
```
┌─────────────────────────────────┐
│ ← Section Title        [<] [>] │
├─────────────────────────────────┤
│  [📖 Content]  [🎓 Teacher]    │
├─────────────────────────────────┤
│  (active tab content)           │
└─────────────────────────────────┘
```

Uses AppShell with `rawContent` for full-height layout.

### Step 2.11 — Wire Route in App.tsx

**File**: `src/App.tsx` (MODIFY)

Add route:
```tsx
<Route path="/training/:courseSlug/:sectionSlug" element={
  <ProtectedRoute><LearningSession /></ProtectedRoute>
} />
```

---

## Full Code Reference

### Edge Function Code

#### `handleTrainingDomain()` — Add to `supabase/functions/ask/index.ts`

```typescript
// =============================================================================
// TRAINING DOMAIN TYPES
// =============================================================================

interface TrainingAskRequest extends UnifiedAskRequest {
  domain: 'training';
  sectionId: string;
  contentContext: string;
  conversationHistory?: ConversationMessage[];
  sessionSummary?: string;
  topicsCovered?: string[];
  topicsTotal?: string[];
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface TrainingAskResponse {
  reply: string;
  suggested_replies: string[];
  topics_update: {
    covered: string[];
    total: string[];
  };
  should_suggest_quiz: boolean;
}

// =============================================================================
// TRAINING DOMAIN HANDLER
// =============================================================================

async function handleTrainingDomain(
  request: TrainingAskRequest,
  supabase: any,
  OPENAI_API_KEY: string,
  language: "en" | "es"
): Promise<TrainingAskResponse> {
  const {
    sectionId,
    contentContext,
    conversationHistory = [],
    sessionSummary = '',
    topicsCovered = [],
    topicsTotal = [],
    question,
  } = request;

  console.log('[ask:training] Processing training domain request');
  console.log('[ask:training] Section ID:', sectionId);
  console.log('[ask:training] Topics:', topicsCovered.length, '/', topicsTotal.length);

  // Fetch training teacher prompt
  const { data: promptData, error: promptError } = await supabase
    .from('ai_prompts')
    .select('prompt_en, prompt_es')
    .eq('slug', 'training-teacher')
    .eq('is_active', true)
    .single();

  if (promptError || !promptData) {
    console.error('[ask:training] Prompt not found:', promptError?.message);
    throw new Error('Training teacher prompt not configured');
  }

  const basePrompt = language === 'es' && promptData.prompt_es
    ? promptData.prompt_es
    : promptData.prompt_en;

  // Build system prompt with context
  const contextParts: string[] = [basePrompt];

  contextParts.push(
    language === 'es'
      ? `CONTENIDO DE CAPACITACIÓN:\n${contentContext}`
      : `TRAINING CONTENT:\n${contentContext}`
  );

  if (sessionSummary) {
    contextParts.push(
      language === 'es'
        ? `RESUMEN DE LA SESIÓN ANTERIOR:\n${sessionSummary}`
        : `PREVIOUS SESSION SUMMARY:\n${sessionSummary}`
    );
  }

  if (topicsTotal.length > 0) {
    const remainingTopics = topicsTotal.filter(t => !topicsCovered.includes(t));
    if (remainingTopics.length > 0) {
      contextParts.push(
        language === 'es'
          ? `TEMAS POR CUBRIR: ${remainingTopics.join(', ')}`
          : `TOPICS TO COVER: ${remainingTopics.join(', ')}`
      );
    }
  }

  const systemPrompt = contextParts.join('\n\n');

  // Build conversation messages
  const messages: any[] = [{ role: 'system', content: systemPrompt }];

  const recentHistory = conversationHistory.slice(-10);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: 'user', content: question });

  // JSON schema for structured output
  const responseSchema = {
    type: "object",
    properties: {
      reply: { type: "string" },
      suggested_replies: { type: "array", items: { type: "string" } },
      topics_update: {
        type: "object",
        properties: {
          covered: { type: "array", items: { type: "string" } },
          total: { type: "array", items: { type: "string" } }
        },
        required: ["covered", "total"]
      },
      should_suggest_quiz: { type: "boolean" }
    },
    required: ["reply", "suggested_replies", "topics_update", "should_suggest_quiz"],
    additionalProperties: false
  };

  // Call OpenAI with structured output
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'training_response', strict: true, schema: responseSchema }
      },
      temperature: 0.7,
      max_tokens: 800
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[ask:training] OpenAI error:', response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const assistantMessage = data.choices?.[0]?.message?.content;

  if (!assistantMessage) {
    throw new Error('Failed to generate training response');
  }

  let parsedResponse: TrainingAskResponse;
  try {
    parsedResponse = JSON.parse(assistantMessage);
  } catch (parseError) {
    console.error('[ask:training] Failed to parse JSON:', parseError);
    throw new Error('Invalid JSON response from AI');
  }

  if (!parsedResponse.reply || !parsedResponse.suggested_replies || !parsedResponse.topics_update) {
    throw new Error('Incomplete training response structure');
  }

  return parsedResponse;
}
```

#### Domain Branching — Insert before existing action/search logic

```typescript
if (domain === 'training') {
  console.log('[ask] Training mode detected');

  const trainingRequest = body as TrainingAskRequest;

  if (!trainingRequest.sectionId || !trainingRequest.contentContext) {
    return errorResponse('bad_request', 'Training mode requires sectionId and contentContext', 400);
  }

  try {
    const trainingResponse = await handleTrainingDomain(
      trainingRequest, supabase, OPENAI_API_KEY!, language
    );

    await supabase.rpc('increment_usage', { _user_id: userId, _group_id: groupId });

    return new Response(JSON.stringify(trainingResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[ask:training] Error:', err);
    return errorResponse('ai_error', err instanceof Error ? err.message : 'Training session failed', 500);
  }
}
```

---

### Seed Migration

#### `supabase/migrations/20260214000000_seed_training_ai_prompts.sql`

```sql
DO $$
DECLARE
  _group_id UUID;
BEGIN
  SELECT id INTO _group_id FROM public.groups WHERE slug = 'alamo-prime' LIMIT 1;

  IF _group_id IS NULL THEN
    RAISE EXCEPTION 'Group "alamo-prime" not found';
  END IF;

  INSERT INTO public.ai_prompts (
    slug, category, prompt_en, prompt_es, voice, is_active
  )
  VALUES (
    'training-teacher',
    'system',
    E'You are a Socratic AI teacher for restaurant staff training at Alamo Prime.

Your teaching method:
- Ask probing questions that build on the student''s existing knowledge
- Guide discovery rather than lecturing
- Keep responses concise (2-4 sentences maximum)
- Always end with a question or suggested next step
- Encourage critical thinking and real-world application

Grounding rules:
- Use ONLY the training content provided in the context
- Never invent facts, procedures, or menu items
- If a student asks about something not in the content, acknowledge the limitation and guide them back to the material
- Cite specific details from the content when answering

Topic tracking:
- Identify key concepts in the training material
- Track which topics have been covered in conversation
- Suggest moving to new topics when one is mastered
- Recommend the quiz when all topics are sufficiently explored

Tone:
- Warm and encouraging, like a supportive mentor
- Celebrate correct answers and insights
- Reframe mistakes as learning opportunities
- Use restaurant industry language naturally

Response structure:
- reply: Your teaching response (2-4 sentences, ending with a question)
- suggested_replies: 3-4 options the student could choose
- topics_update: Update the covered and total topic lists
- should_suggest_quiz: true only when all topics covered AND student demonstrates readiness',

    E'Eres un maestro de IA socrático para la capacitación del personal del restaurante en Alamo Prime.

Tu método de enseñanza:
- Haz preguntas investigativas que se basen en el conocimiento existente del estudiante
- Guía el descubrimiento en lugar de dar conferencias
- Mantén las respuestas concisas (máximo 2-4 oraciones)
- Siempre termina con una pregunta o próximo paso sugerido
- Fomenta el pensamiento crítico y la aplicación en el mundo real

Reglas de fundamentación:
- Usa SOLO el contenido de capacitación proporcionado en el contexto
- Nunca inventes hechos, procedimientos o elementos del menú
- Si un estudiante pregunta sobre algo que no está en el contenido, reconoce la limitación y guíalo de vuelta al material
- Cita detalles específicos del contenido al responder

Seguimiento de temas:
- Identifica conceptos clave en el material de capacitación
- Rastrea qué temas se han cubierto en la conversación
- Sugiere pasar a nuevos temas cuando uno se domina
- Recomienda el quiz cuando todos los temas se hayan explorado suficientemente

Tono:
- Cálido y alentador, como un mentor de apoyo
- Celebra respuestas correctas e ideas
- Reformula errores como oportunidades de aprendizaje
- Usa lenguaje de la industria de restaurantes de forma natural

Estructura de respuesta:
- reply: Tu respuesta de enseñanza (2-4 oraciones, terminando con una pregunta)
- suggested_replies: 3-4 opciones que el estudiante podría elegir
- topics_update: Actualiza las listas de temas cubiertos y totales
- should_suggest_quiz: true solo cuando todos los temas estén cubiertos Y el estudiante demuestre preparación',

    'coral',
    true
  )
  ON CONFLICT (slug) DO UPDATE SET
    prompt_en = EXCLUDED.prompt_en,
    prompt_es = EXCLUDED.prompt_es,
    voice = EXCLUDED.voice,
    updated_at = now();

  RAISE NOTICE 'Training teacher prompt seeded for group: %', _group_id;
END $$;
```

---

### Realtime Session Training Mode

#### Add to `SessionRequest` interface:

```typescript
mode?: 'standard' | 'training';
sectionId?: string;
contentContext?: string;
conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
```

#### Training mode handler (insert before existing product mode logic):

```typescript
if (mode === 'training') {
  // Fetch training-teacher prompt
  const { data: trainingPrompt } = await supabase
    .from('ai_prompts')
    .select('prompt_en, prompt_es, voice')
    .eq('slug', 'training-teacher')
    .eq('is_active', true)
    .single();

  voice = trainingPrompt?.voice || 'coral';

  const baseTeacherPrompt = language === 'es' && trainingPrompt?.prompt_es
    ? trainingPrompt.prompt_es : trainingPrompt?.prompt_en;

  const promptParts = [baseTeacherPrompt];
  promptParts.push(`TRAINING CONTENT:\n${contentContext}`);

  if (conversationHistory?.length > 0) {
    const historyText = conversationHistory.slice(-5)
      .map(m => `${m.role === 'user' ? 'Student' : 'Teacher'}: ${m.content}`)
      .join('\n');
    promptParts.push(`RECENT CONVERSATION:\n${historyText}`);
  }

  promptParts.push('Keep responses SHORT (2-4 sentences), end with a question.');
  systemPrompt = promptParts.join('\n\n');

  // No search tools in training mode (content pre-loaded)
  // PTT mode (no VAD) for student pacing control
}
```

---

### Frontend Code

#### `src/components/training/ChatBubble.tsx`

```typescript
import { cn } from '@/lib/utils';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  className?: string;
}

export function ChatBubble({ role, content, timestamp, className }: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start', className)}>
      <div className={cn(
        'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
        isUser
          ? 'bg-primary text-primary-foreground rounded-br-md'
          : 'bg-muted text-foreground rounded-bl-md'
      )}>
        <p className="whitespace-pre-wrap break-words">{content}</p>
        {timestamp && (
          <span className={cn(
            'block mt-1 text-[10px]',
            isUser ? 'text-primary-foreground/60' : 'text-muted-foreground/60'
          )}>
            {timestamp}
          </span>
        )}
      </div>
    </div>
  );
}
```

#### `src/components/training/SuggestedReplyChips.tsx`

```typescript
import { cn } from '@/lib/utils';

interface SuggestedReplyChipsProps {
  chips: string[];
  onSelect: (chip: string) => void;
  disabled?: boolean;
}

export function SuggestedReplyChips({ chips, onSelect, disabled = false }: SuggestedReplyChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2 px-1', disabled && 'opacity-50 pointer-events-none')}>
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onSelect(chip)}
          disabled={disabled}
          className={cn(
            'inline-flex items-center rounded-full border border-border',
            'px-3 py-1.5 text-sm text-foreground bg-background hover:bg-muted',
            'transition-colors duration-150 active:scale-[0.97]',
            'disabled:opacity-50 disabled:pointer-events-none'
          )}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
```

#### `src/components/training/ProgressStrip.tsx`

```typescript
import { cn } from '@/lib/utils';

interface ProgressStripProps {
  covered: number;
  total: number;
  language?: 'en' | 'es';
  className?: string;
}

export function ProgressStrip({ covered, total, language = 'en', className }: ProgressStripProps) {
  const percent = total > 0 ? Math.round((covered / total) * 100) : 0;
  const label = language === 'es' ? `${covered}/${total} temas` : `${covered}/${total} topics`;

  return (
    <div className={cn('flex items-center gap-3 px-1', className)}>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-green-500 transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">{label}</span>
    </div>
  );
}
```

#### `src/hooks/use-training-chat.ts`

*~260 lines — complete hook with:*
- Load previous conversations via `useQuery`
- Auto-load latest conversation on mount
- `sendMessage()` → calls `/ask` with `domain: 'training'`
- Parses structured AI response (reply + suggested_replies + topics_update + should_suggest_quiz)
- Client-side persistence to `course_conversations` table
- Session resume and new session support
- Bilingual error messages

*Full code available in Frontend Architect agent output.*

#### `src/components/training/TrainingChatPanel.tsx`

*~280 lines — complete panel with:*
- Header: GraduationCap icon + section title
- Scrollable message area with auto-scroll
- LoadingDots animation component
- SuggestedReplyChips after last AI message
- ProgressStrip for topic tracking
- Resume UI card for previous sessions
- Text input with Enter key + Send button
- Bilingual labels (EN/ES)

*Full code available in Frontend Architect agent output.*

#### `src/components/training/ContentPanel.tsx`

*~190 lines — routes to existing card views:*
- Switch on `section.contentSource` → correct CardView component
- Card views receive `noop` callbacks (AI handled by chat panel)
- ManualSectionContent for manual_sections (MarkdownRenderer)
- CustomSectionContent for custom sections (AI-only view)
- ItemNavHeader for multi-item sections

*Full code available in Frontend Architect agent output.*

#### `src/hooks/use-learning-session.ts`

*~320 lines — orchestration hook:*
- Fetch course + sections by slug
- Fetch content from source table by content_ids
- Full snake_case→camelCase transforms for all 7 product types
- Content serialization for AI context
- Item navigation (prev/next within multi-item sections)
- Section navigation (prev/next section in course)
- Section progress fetch
- Auto-enrollment on first visit

*Full code available in Frontend Architect agent output.*

#### `src/pages/LearningSession.tsx`

*~210 lines — split/tabbed page:*
- iPad (≥768px): Side-by-side 55% content / 45% chat
- Phone (<768px): Tab toggle between Content and Teacher
- Uses AppShell with rawContent for full-height layout
- Section navigation [<] [>] in header
- Loading and error states with back navigation

*Full code available in Frontend Architect agent output.*

#### `src/App.tsx` (MODIFY)

Add import:
```typescript
import LearningSession from "./pages/LearningSession";
```

Add route (after steps-of-service route):
```tsx
<Route path="/training/:courseSlug/:sectionSlug" element={
  <ProtectedRoute><LearningSession /></ProtectedRoute>
} />
```

---

## File Inventory

| # | File | Lines | Type |
|---|------|-------|------|
| 1 | `supabase/migrations/20260214000000_seed_training_ai_prompts.sql` | ~60 | NEW |
| 2 | `supabase/functions/ask/index.ts` | +150 | MODIFY |
| 3 | `supabase/functions/realtime-session/index.ts` | +60 | MODIFY |
| 4 | `src/components/training/ChatBubble.tsx` | ~48 | NEW |
| 5 | `src/components/training/SuggestedReplyChips.tsx` | ~40 | NEW |
| 6 | `src/components/training/ProgressStrip.tsx` | ~30 | NEW |
| 7 | `src/hooks/use-training-chat.ts` | ~260 | NEW |
| 8 | `src/components/training/TrainingChatPanel.tsx` | ~280 | NEW |
| 9 | `src/components/training/ContentPanel.tsx` | ~190 | NEW |
| 10 | `src/hooks/use-learning-session.ts` | ~320 | NEW |
| 11 | `src/pages/LearningSession.tsx` | ~210 | NEW |
| 12 | `src/App.tsx` | +4 | MODIFY |

**Total**: 9 new files, 3 modified files, ~1,500 new lines

---

## Verification Checklist

After implementing all steps:

- [ ] `training-teacher` prompt exists in `ai_prompts` table (EN + ES)
- [ ] `/ask` returns structured JSON for `domain: 'training'` requests
- [ ] AI responds in Socratic teaching style (questions, not lectures)
- [ ] AI stays grounded in provided content (no hallucination)
- [ ] Bilingual: responds in user's language
- [ ] Suggested replies appear after each AI message
- [ ] Topic tracking updates correctly
- [ ] Quiz suggestion triggers when all topics covered
- [ ] Conversations persist to `course_conversations` table
- [ ] Previous sessions load on return visit
- [ ] Resume and new session both work
- [ ] `/training/:courseSlug/:sectionSlug` route works
- [ ] iPad: split view renders (55% content / 45% chat)
- [ ] Phone: tabbed view with Content / Teacher toggle
- [ ] ContentPanel renders correct card view per content_source
- [ ] Multi-item sections: prev/next navigation works
- [ ] Section navigation: [<] [>] cycles through course sections
- [ ] Auto-enrollment triggers on first section visit
- [ ] Voice mode works with PTT in training context
- [ ] 0 TypeScript errors
