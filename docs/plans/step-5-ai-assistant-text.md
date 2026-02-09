# STEP 5 — AI ASSISTANT (TEXT ONLY)
## Alamo Prime AI Restaurant Ops

**Objective:** Implement a grounded AI assistant that answers questions strictly from manual content, with usage limits enforced by role policies and citations linking back to source sections.

> **Prerequisites:** Step 1 (Design System), Step 2 (Manual Reader), Step 3 (Auth & Roles), Step 4 (Search MVP) must be complete.  
> **References:** `docs/system-architecture.md`, `docs/design-specs.md`, `docs/App-overview.md`

---

## 1. OVERVIEW

### 1.1 What We're Building

A **text-based AI assistant** that:
- Answers questions using only manual content (grounded, not hallucinated)
- Uses keyword-based retrieval (FTS) to find relevant sections
- Enforces daily/monthly usage limits per role
- Returns concise answers with source citations
- Supports bilingual queries (EN/ES)
- Refuses off-topic questions gracefully

### 1.2 Core Principles (from Design Specs)

| Principle | Implementation |
|-----------|----------------|
| **Grounded answers** | AI only uses retrieved manual content as context |
| **Concise by default** | 1-2 sentences + bullets, "Expand" for more detail |
| **Citations always** | Every answer shows source section chips |
| **Confidence signaling** | If coverage is weak, say so; if off-topic, refuse |
| **Usage transparency** | Show remaining questions, warn at thresholds |

### 1.3 Success Criteria

- [ ] Edge function `/ask` accepts questions and returns grounded answers
- [ ] Retrieval uses existing `search_manual` FTS function
- [ ] Usage limits enforced (daily + monthly per role)
- [ ] Answers include source citations with section links
- [ ] Off-topic questions are gracefully refused
- [ ] Weak coverage triggers "I'm not sure" response
- [ ] Usage meter shows remaining questions
- [ ] Ask page integrates with AI panel (desktop) and inline (mobile)
- [ ] Language preference respected in retrieval and response

### 1.4 What We're NOT Building Yet

- Voice input/output (Step 7)
- Vector/semantic search (Step 8 - Phase 2)
- Conversation memory/threads (future)
- AI analytics (future)

---

## 2. ARCHITECTURE

### 2.1 Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AI ASSISTANT FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐    ┌─────────────────┐    ┌─────────────────┐                 │
│  │  Client  │───▶│ Edge Function   │───▶│ Usage Check     │                 │
│  │  (Ask)   │    │    /ask         │    │ (role_policies) │                 │
│  └──────────┘    └─────────────────┘    └────────┬────────┘                 │
│                                                   │                          │
│                         ┌─────────────────────────┼─────────────────────┐   │
│                         │                         ▼                     │   │
│                         │           ┌─────────────────────────┐         │   │
│                         │           │    Limit Exceeded?      │         │   │
│                         │           └─────────────────────────┘         │   │
│                         │              │ Yes              │ No          │   │
│                         │              ▼                  ▼             │   │
│                         │     ┌──────────────┐   ┌──────────────────┐   │   │
│                         │     │ Return Error │   │ Retrieve Context │   │   │
│                         │     │ (limit msg)  │   │ (search_manual)  │   │   │
│                         │     └──────────────┘   └────────┬─────────┘   │   │
│                         │                                 │             │   │
│                         │                                 ▼             │   │
│                         │           ┌─────────────────────────────┐     │   │
│                         │           │   Enough Context Found?     │     │   │
│                         │           └─────────────────────────────┘     │   │
│                         │              │ No               │ Yes         │   │
│                         │              ▼                  ▼             │   │
│                         │     ┌──────────────┐   ┌──────────────────┐   │   │
│                         │     │ Return "I'm  │   │ Call Lovable AI  │   │   │
│                         │     │ not sure"    │   │ (grounded prompt)│   │   │
│                         │     └──────────────┘   └────────┬─────────┘   │   │
│                         │                                 │             │   │
│                         │                                 ▼             │   │
│                         │           ┌─────────────────────────────┐     │   │
│                         │           │  Increment Usage Counter    │     │   │
│                         │           └─────────────────────────────┘     │   │
│                         │                                 │             │   │
│                         │                                 ▼             │   │
│                         │           ┌─────────────────────────────┐     │   │
│                         │           │  Return Answer + Citations  │     │   │
│                         │           └─────────────────────────────┘     │   │
│                         └───────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `/ask` edge function | `supabase/functions/ask/` | Orchestrates retrieval, limits, AI call |
| `usage_counters` table | Supabase DB | Tracks daily/monthly question counts |
| `useAskAI` hook | `src/hooks/use-ask-ai.ts` | Client-side API integration |
| `useUsageLimits` hook | `src/hooks/use-usage-limits.ts` | Fetches remaining questions |
| Ask page | `src/pages/Ask.tsx` | User interface (already scaffolded) |

---

## 3. DATABASE SCHEMA

### 3.1 Usage Counters Table

```sql
-- ============================================
-- USAGE_COUNTERS: Track AI usage per user/role
-- ============================================
CREATE TABLE public.usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  
  -- Period tracking
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'monthly')),
  period_start DATE NOT NULL,
  
  -- Count
  count INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: one counter per user/group/period
  UNIQUE (user_id, group_id, period_type, period_start)
);

-- Indexes
CREATE INDEX idx_usage_counters_user ON public.usage_counters(user_id);
CREATE INDEX idx_usage_counters_period ON public.usage_counters(period_type, period_start);

-- Enable RLS
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view own usage"
  ON public.usage_counters FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Edge function (service role) can insert/update all
-- (No policy needed - service role bypasses RLS)
```

### 3.2 Helper Functions

```sql
-- ============================================
-- GET CURRENT USAGE: Returns daily and monthly counts
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_usage(
  _user_id UUID,
  _group_id UUID
)
RETURNS TABLE (
  daily_count INTEGER,
  monthly_count INTEGER,
  daily_limit INTEGER,
  monthly_limit INTEGER,
  can_ask BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_daily_count INTEGER := 0;
  v_monthly_count INTEGER := 0;
  v_daily_limit INTEGER;
  v_monthly_limit INTEGER;
BEGIN
  -- Get user's role in this group
  SELECT gm.role INTO v_role
  FROM public.group_memberships gm
  WHERE gm.user_id = _user_id AND gm.group_id = _group_id;
  
  -- Get limits from role_policies
  SELECT rp.daily_ai_limit, rp.monthly_ai_limit 
  INTO v_daily_limit, v_monthly_limit
  FROM public.role_policies rp
  WHERE rp.group_id = _group_id AND rp.role = v_role;
  
  -- Default limits if no policy found
  v_daily_limit := COALESCE(v_daily_limit, 20);
  v_monthly_limit := COALESCE(v_monthly_limit, 500);
  
  -- Get today's count
  SELECT COALESCE(uc.count, 0) INTO v_daily_count
  FROM public.usage_counters uc
  WHERE uc.user_id = _user_id 
    AND uc.group_id = _group_id
    AND uc.period_type = 'daily'
    AND uc.period_start = CURRENT_DATE;
  
  -- Get this month's count
  SELECT COALESCE(uc.count, 0) INTO v_monthly_count
  FROM public.usage_counters uc
  WHERE uc.user_id = _user_id 
    AND uc.group_id = _group_id
    AND uc.period_type = 'monthly'
    AND uc.period_start = date_trunc('month', CURRENT_DATE)::DATE;
  
  RETURN QUERY SELECT 
    v_daily_count,
    v_monthly_count,
    v_daily_limit,
    v_monthly_limit,
    (v_daily_count < v_daily_limit AND v_monthly_count < v_monthly_limit);
END;
$$;

-- ============================================
-- INCREMENT USAGE: Atomically increase counters
-- ============================================
CREATE OR REPLACE FUNCTION public.increment_usage(
  _user_id UUID,
  _group_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Upsert daily counter
  INSERT INTO public.usage_counters (user_id, group_id, period_type, period_start, count)
  VALUES (_user_id, _group_id, 'daily', CURRENT_DATE, 1)
  ON CONFLICT (user_id, group_id, period_type, period_start)
  DO UPDATE SET count = usage_counters.count + 1, updated_at = now();
  
  -- Upsert monthly counter
  INSERT INTO public.usage_counters (user_id, group_id, period_type, period_start, count)
  VALUES (_user_id, _group_id, 'monthly', date_trunc('month', CURRENT_DATE)::DATE, 1)
  ON CONFLICT (user_id, group_id, period_type, period_start)
  DO UPDATE SET count = usage_counters.count + 1, updated_at = now();
  
  RETURN TRUE;
END;
$$;
```

---

## 4. EDGE FUNCTION: `/ask`

### 4.1 Function Structure

```typescript
// supabase/functions/ask/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AskRequest {
  question: string;
  language: 'en' | 'es';
  groupId: string;
}

interface Citation {
  id: string;
  slug: string;
  title: string;
}

interface AskResponse {
  answer: string;
  citations: Citation[];
  usage: {
    daily: { used: number; limit: number };
    monthly: { used: number; limit: number };
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse request
    const { question, language, groupId }: AskRequest = await req.json();

    if (!question?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Question is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check usage limits
    const { data: usageData, error: usageError } = await supabase
      .rpc('get_user_usage', { _user_id: user.id, _group_id: groupId });

    if (usageError) throw usageError;

    const usage = usageData[0];
    if (!usage.can_ask) {
      const limitType = usage.daily_count >= usage.daily_limit ? 'daily' : 'monthly';
      return new Response(
        JSON.stringify({ 
          error: 'limit_exceeded',
          message: limitType === 'daily' 
            ? 'Daily question limit reached. Try again tomorrow.'
            : 'Monthly question limit reached.',
          usage: {
            daily: { used: usage.daily_count, limit: usage.daily_limit },
            monthly: { used: usage.monthly_count, limit: usage.monthly_limit },
          }
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Retrieve relevant content using FTS
    const { data: searchResults, error: searchError } = await supabase
      .rpc('search_manual', { 
        search_query: question, 
        search_language: language,
        result_limit: 5 
      });

    if (searchError) throw searchError;

    // 5. Check if we have enough context
    if (!searchResults || searchResults.length === 0) {
      // No relevant content found - return "I'm not sure" response
      return new Response(
        JSON.stringify({
          answer: language === 'es'
            ? 'No encontré información relevante en el manual sobre esta pregunta. Intenta reformularla o busca directamente en el manual.'
            : "I couldn't find relevant information in the manual about this question. Try rephrasing or search the manual directly.",
          citations: [],
          usage: {
            daily: { used: usage.daily_count, limit: usage.daily_limit },
            monthly: { used: usage.monthly_count, limit: usage.monthly_limit },
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Build context from search results
    const context = searchResults.map((r: any) => 
      `## ${r.title}\n${r.snippet.replace(/<\/?mark>/g, '')}`
    ).join('\n\n---\n\n');

    const citations: Citation[] = searchResults.map((r: any) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
    }));

    // 7. Call Lovable AI with grounded prompt
    const systemPrompt = language === 'es'
      ? `Eres un asistente de operaciones de restaurante. Responde SOLO usando la información del manual proporcionada.
Reglas:
- Sé conciso: 1-2 oraciones + viñetas si es necesario
- Si la información no está en el contexto, di "No tengo información sobre esto en el manual"
- Nunca inventes procedimientos o políticas
- Usa español profesional pero accesible`
      : `You are a restaurant operations assistant. Answer ONLY using the manual information provided.
Rules:
- Be concise: 1-2 sentences + bullets if needed
- If information isn't in the context, say "I don't have information about this in the manual"
- Never make up procedures or policies
- Use professional but accessible English`;

    const userPrompt = language === 'es'
      ? `Pregunta: ${question}\n\nContenido del manual:\n${context}`
      : `Question: ${question}\n\nManual content:\n${context}`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.3, // Low temperature for factual answers
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'AI service rate limited. Please try again shortly.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error('AI service unavailable');
    }

    const aiData = await aiResponse.json();
    const answer = aiData.choices?.[0]?.message?.content || 'Unable to generate answer';

    // 8. Increment usage counter
    await supabase.rpc('increment_usage', { _user_id: user.id, _group_id: groupId });

    // 9. Return response
    return new Response(
      JSON.stringify({
        answer,
        citations,
        usage: {
          daily: { used: usage.daily_count + 1, limit: usage.daily_limit },
          monthly: { used: usage.monthly_count + 1, limit: usage.monthly_limit },
        }
      } as AskResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Ask function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### 4.2 Off-Topic Detection (Optional Enhancement)

Add a pre-check to detect obviously off-topic questions before using AI credits:

```typescript
// Simple keyword-based off-topic detection
const OFF_TOPIC_PATTERNS = [
  /weather|clima/i,
  /news|noticias/i,
  /sports|deportes/i,
  /politics|política/i,
  /stock|acciones/i,
  /joke|chiste/i,
];

function isOffTopic(question: string): boolean {
  return OFF_TOPIC_PATTERNS.some(pattern => pattern.test(question));
}

// In the handler, before retrieval:
if (isOffTopic(question)) {
  return new Response(
    JSON.stringify({
      answer: language === 'es'
        ? 'Solo puedo ayudarte con preguntas sobre operaciones del restaurante y procedimientos del manual.'
        : 'I can only help with restaurant operations and manual procedures.',
      citations: [],
      usage: { /* current usage, not incremented */ }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

---

## 5. CLIENT HOOKS

### 5.1 useAskAI Hook

```typescript
// src/hooks/use-ask-ai.ts

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { toast } from 'sonner';

interface Citation {
  id: string;
  slug: string;
  title: string;
}

interface UsageInfo {
  daily: { used: number; limit: number };
  monthly: { used: number; limit: number };
}

interface AskResult {
  answer: string;
  citations: Citation[];
  usage: UsageInfo;
}

interface UseAskAIReturn {
  ask: (question: string) => Promise<AskResult | null>;
  isLoading: boolean;
  error: string | null;
}

export function useAskAI(): UseAskAIReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, primaryGroup } = useAuth();
  const { language } = useLanguage();

  const ask = async (question: string): Promise<AskResult | null> => {
    if (!user || !primaryGroup) {
      toast.error('Please sign in to use AI assistant');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ask', {
        body: {
          question,
          language,
          groupId: primaryGroup.groupId,
        },
      });

      if (fnError) throw fnError;

      if (data.error) {
        if (data.error === 'limit_exceeded') {
          toast.error(data.message);
          setError(data.message);
          return null;
        }
        throw new Error(data.error);
      }

      return data as AskResult;
    } catch (err: any) {
      const message = err.message || 'Failed to get answer';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { ask, isLoading, error };
}
```

### 5.2 useUsageLimits Hook

```typescript
// src/hooks/use-usage-limits.ts

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

interface UsageLimits {
  daily: { used: number; limit: number; remaining: number };
  monthly: { used: number; limit: number; remaining: number };
  canAsk: boolean;
}

export function useUsageLimits() {
  const { user, primaryGroup } = useAuth();

  return useQuery({
    queryKey: ['usage-limits', user?.id, primaryGroup?.groupId],
    queryFn: async (): Promise<UsageLimits> => {
      if (!user || !primaryGroup) {
        return {
          daily: { used: 0, limit: 20, remaining: 20 },
          monthly: { used: 0, limit: 500, remaining: 500 },
          canAsk: false,
        };
      }

      const { data, error } = await supabase.rpc('get_user_usage', {
        _user_id: user.id,
        _group_id: primaryGroup.groupId,
      });

      if (error) throw error;

      const usage = data[0];
      return {
        daily: {
          used: usage.daily_count,
          limit: usage.daily_limit,
          remaining: Math.max(0, usage.daily_limit - usage.daily_count),
        },
        monthly: {
          used: usage.monthly_count,
          limit: usage.monthly_limit,
          remaining: Math.max(0, usage.monthly_limit - usage.monthly_count),
        },
        canAsk: usage.can_ask,
      };
    },
    enabled: !!user && !!primaryGroup,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refresh every minute
  });
}
```

---

## 6. UI COMPONENTS

### 6.1 Updated Ask Page

The existing `src/pages/Ask.tsx` needs to be updated to:
- Use `useAskAI` hook instead of mock timeout
- Use `useUsageLimits` for real usage data
- Handle loading and error states properly
- Link citations to manual sections

### 6.2 AI Answer Card Updates

Update `src/components/ui/ai-answer-card.tsx` to:
- Accept `onSourceClick` with section slug navigation
- Show loading skeleton during AI processing
- Display confidence indicators for weak results

### 6.3 Usage Meter Updates

Update `src/components/ui/usage-meter.tsx` to:
- Accept `UsageLimits` from hook
- Show warning states at 80% and 95% thresholds
- Display appropriate messaging when limit reached

---

## 7. SECURITY CONSIDERATIONS

### 7.1 Rate Limiting

| Protection | Implementation |
|------------|----------------|
| **Per-user daily limit** | Enforced in DB via `role_policies` |
| **Per-user monthly limit** | Enforced in DB via `role_policies` |
| **Request validation** | Edge function validates auth + input |
| **AI gateway limits** | Lovable AI has built-in rate limiting |

### 7.2 Prompt Injection Prevention

- User questions are clearly delimited in the prompt
- Context is from trusted (database) source only
- System prompt instructs to refuse off-topic requests
- No user content is executed as instructions

### 7.3 Data Access

- Edge function uses service role for DB access
- User token verified before processing
- Usage counters scoped to user + group
- Manual content already protected by RLS

---

## 8. TESTING PLAN

### 8.1 Unit Tests

| Test | Description |
|------|-------------|
| `ask-basic` | Question returns answer + citations |
| `ask-no-results` | Question with no matching content returns "not sure" |
| `ask-off-topic` | Off-topic question is refused |
| `ask-daily-limit` | 429 returned when daily limit exceeded |
| `ask-monthly-limit` | 429 returned when monthly limit exceeded |
| `ask-no-auth` | 401 returned without auth header |
| `ask-bilingual` | Spanish question returns Spanish answer |

### 8.2 Integration Tests

| Test | Description |
|------|-------------|
| Full flow | Ask question → get answer → usage incremented → citations clickable |
| Limit reset | Usage resets at day/month boundary |
| Role-based limits | Staff vs admin limits correctly applied |

### 8.3 Manual Testing Checklist

- [ ] Ask a relevant question, get grounded answer
- [ ] Click citation chip, navigate to manual section
- [ ] Ask off-topic question, see refusal
- [ ] Reach daily limit, see limit message
- [ ] Switch language, ask in Spanish
- [ ] Check usage meter updates after each question

---

## 9. IMPLEMENTATION PHASES

### Phase 1: Database Setup
1. Create `usage_counters` table migration
2. Create `get_user_usage` function
3. Create `increment_usage` function
4. Test functions via SQL

### Phase 2: Edge Function
1. Create `supabase/functions/ask/index.ts`
2. Implement auth verification
3. Implement usage limit check
4. Implement FTS retrieval
5. Implement Lovable AI call
6. Implement usage increment
7. Test via curl / Supabase dashboard

### Phase 3: Client Integration
1. Create `useAskAI` hook
2. Create `useUsageLimits` hook
3. Update `Ask.tsx` page to use real hooks
4. Update AI answer card for citations
5. Update usage meter for real data

### Phase 4: Polish
1. Add off-topic detection
2. Add streaming support (optional)
3. Add "Expand answer" feature
4. Add keyboard shortcuts
5. Test all edge cases

---

## 10. FUTURE ENHANCEMENTS (NOT IN SCOPE)

| Feature | Step |
|---------|------|
| Voice input (speech-to-text) | Step 7 |
| Voice output (TTS) | Step 7 |
| Semantic search (embeddings) | Step 8 |
| Conversation memory | Future |
| AI usage analytics | Future |
| "Ask about this section" from Manual | Phase 4 enhancement |

---

## 11. FILES TO CREATE/MODIFY

### New Files
| File | Purpose |
|------|---------|
| `supabase/functions/ask/index.ts` | Edge function for AI assistant |
| `src/hooks/use-ask-ai.ts` | Client hook for asking questions |
| `src/hooks/use-usage-limits.ts` | Client hook for usage data |

### Modified Files
| File | Changes |
|------|---------|
| `supabase/config.toml` | Add `/ask` function config |
| `src/pages/Ask.tsx` | Replace mock with real hooks |
| `src/components/ui/ai-answer-card.tsx` | Add citation navigation |
| `src/components/ui/usage-meter.tsx` | Add threshold warnings |
| `src/components/manual/AskAboutButton.tsx` | Enable button, add navigation |

### Database Migration
| Migration | Purpose |
|-----------|---------|
| `create_usage_counters.sql` | Usage tracking table + functions |

---

## 12. ESTIMATED EFFORT

| Phase | Effort |
|-------|--------|
| Phase 1: Database | 1-2 hours |
| Phase 2: Edge Function | 2-3 hours |
| Phase 3: Client Integration | 2-3 hours |
| Phase 4: Polish | 1-2 hours |
| **Total** | **6-10 hours** |
