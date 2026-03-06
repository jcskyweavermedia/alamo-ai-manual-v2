import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Maps client mode strings → ai_prompts slug names
export const MODE_SLUG_MAP: Record<string, string> = {
  teach_me:           'mode-teach-me',
  quiz_me:            'mode-practice-questions',
  practice_questions: 'mode-practice-questions',
  ask_anything:       'mode-teach-me',
  cert_test:          'mode-cert-test',
  practice_tutor:     'mode-practice-tutor',
  live_trainer:       'mode-live-trainer',
};

/**
 * Fetch a prompt row from ai_prompts by slug.
 * Returns prompt_es if language='es' and it exists, else prompt_en.
 * Returns '' on error (does not throw).
 */
export async function fetchPromptBySlug(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  slug: string,
  language: 'en' | 'es' = 'en'
): Promise<string> {
  const { data, error } = await supabase
    .from('ai_prompts')
    .select('prompt_en, prompt_es')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    console.error(`[prompt-helpers] fetchPromptBySlug failed for slug="${slug}":`, error?.message);
    return '';
  }
  return (language === 'es' && data.prompt_es) ? data.prompt_es : data.prompt_en;
}

/**
 * Assemble a 4-layer XML-tagged system prompt:
 *   <rules>    → Layer 1: global rules (guardrails, tone, source-of-truth)
 *   <persona>  → Layer 2: teacher identity (domain, expertise, teaching style)
 *   <mode>     → Layer 3: mode-specific behavioral contract + response format
 *   <content>  → Layer 4: section content in readable markdown
 *   <session>  → Optional: topic tracking, session summary
 */
export function assembleSystemPrompt(opts: {
  globalRules:  string;
  persona:      string;
  modePrompt:   string;
  contentMd:    string;
  session?: {
    topics_covered?: string[];
    topics_total?: string[];
    session_summary?: string;
  } | null;
}): string {
  const parts = [
    `<rules>\n${opts.globalRules}\n</rules>`,
  ];
  // Only include persona tag if persona has content
  if (opts.persona?.trim()) {
    parts.push(`<persona>\n${opts.persona}\n</persona>`);
  }
  parts.push(
    `<mode>\n${opts.modePrompt}\n</mode>`,
    `<content>\n${opts.contentMd}\n</content>`,
  );
  if (opts.session) {
    parts.push(`<session>\n${JSON.stringify(opts.session)}\n</session>`);
  }
  return parts.filter(Boolean).join('\n\n');
}
