# Phase 5: Form Builder Admin -- Backend & Edge Functions

> **Status:** Planning
> **Date:** 2026-02-25
> **Estimated effort:** ~2 sessions (backend only -- frontend is a separate doc)
> **Dependencies:** Phase 1 (DB Foundation, complete), Phase 3 (AI Form Filling, complete)
> **Output:** 1 new edge function (`refine-form-instructions`), 1 new edge function (`generate-form-template`), 2-3 migrations, 0 new tables
> **Author:** Senior Backend Developer (Opus)

> **Note**: Limits and trigger logic in this document have been reconciled with the master plan.
> See `05-phase-form-builder-admin.md` Section "Conflict Resolutions" for authoritative values.
> Items marked ⚠️ SUPERSEDED have been replaced by the DB plan's approach.

---

## Table of Contents

1. [New Edge Function: `refine-form-instructions`](#1-new-edge-function-refine-form-instructions)
2. [Form Template CRUD API](#2-form-template-crud-api)
3. [AI-Assisted Template Generation](#3-ai-assisted-template-generation)
4. [Validation & Guardrails](#4-validation--guardrails)
5. [Search Functions Expansion](#5-search-functions-expansion)
6. [Migration Manifest](#6-migration-manifest)
7. [Verification Plan](#7-verification-plan)

---

## 1. New Edge Function: `refine-form-instructions`

### 1.1 Purpose

When an admin writes instructions for a form template (e.g., "Check employee handbook for rules broken"), the AI refines those instructions to be maximally useful for the **form-filling AI** (`ask-form`). The refined instructions explicitly reference available tools, field keys, and structured extraction patterns so that `ask-form` operates reliably.

This is a **conversational** interaction -- the admin sends raw instructions, the AI returns refined instructions **with an explanation** of what changed and why. The admin can iterate: "Make it shorter" or "Also mention searching contacts."

### 1.2 Request/Response Contract

```typescript
// POST /functions/v1/refine-form-instructions

interface RefineRequest {
  rawInstructions: string;          // Admin's draft instructions (free text)
  templateContext: {
    title: string;                  // Form title, e.g., "Employee Injury Report"
    fields: FieldSummary[];         // Subset: key, type, label, required, options
    enabledTools: string[];         // e.g., ["search_contacts", "search_manual"]
  };
  language: "en" | "es";
  conversationHistory?: Array<{     // For multi-turn refinement
    role: "user" | "assistant";
    content: string;
  }>;
  groupId: string;
}

interface FieldSummary {
  key: string;
  type: string;
  label: string;
  required: boolean;
  options?: string[];               // For select/radio/checkbox
  ai_hint?: string;
}

interface RefineResponse {
  refinedInstructions: string;      // The improved instructions text
  explanation: string;              // Why the AI made these changes
  suggestions: string[];            // Additional tips for the admin
  usage: {
    dailyUsed: number;
    dailyLimit: number;
    monthlyUsed: number;
    monthlyLimit: number;
  };
}
```

### 1.3 System Prompt Design

The system prompt teaches the AI what makes instructions effective for `ask-form`. It encodes knowledge of the available tools, field types, and the extraction engine's behavior.

```typescript
const REFINE_SYSTEM_PROMPT = `You are an AI instruction optimizer for Alamo Prime's form system. Your job is to take a restaurant manager's raw instructions for a form template and refine them so the form-filling AI (which reads these instructions at runtime) can do its job perfectly.

Today's date is YYYY-MM-DD.

## What You Know About the Form-Filling AI

The form-filling AI (ask-form) is an OpenAI gpt-4o-mini model that:
1. Reads the form's field definitions (key, type, label, required, options, ai_hint)
2. Reads the instructions you are now refining
3. Extracts structured field values from unstructured natural language (text, voice, image)
4. Has access to tools based on the form's ai_tools configuration
5. Returns a JSON object with fieldUpdates, missingFields, and a followUpQuestion

## Available Tools (the form-filling AI can call these)

AVAILABLE_TOOLS_BLOCK

## The Form's Fields

FIELDS_BLOCK

## Your Job

Take the admin's raw instructions and produce refined instructions that:

1. **Reference specific tools by name** -- If the instruction implies searching something, name the exact tool. Example: "Check the manual" -> "Use the search_manual tool to find relevant policies."

2. **Reference specific field keys** -- If the instruction mentions filling a field, reference the field key. Example: "Record the employee name" -> "Extract the employee's full name and populate the employee_name field."

3. **Include data format hints** -- Remind the AI about expected formats. Example: "Record the date" -> "Record the date in ISO format (YYYY-MM-DD) in the date_of_incident field."

4. **Handle conditional logic** -- If some steps depend on field values, make that explicit. Example: "If they went to the hospital, get the hospital info" -> "If transported_to_hospital is 'Yes', use the search_contacts tool with category 'medical' to find the nearest hospital and populate the hospital_contact field."

5. **Prioritize required fields** -- Mention which fields are required and should be asked about if missing.

6. **Keep it concise** -- The instructions are included in the system prompt, so shorter is better. Aim for 5-10 numbered steps.

7. **Preserve the admin's intent** -- Do not add steps the admin did not intend. Only clarify and make explicit what was implicit.

## Your Output

Respond with a JSON object:
{
  "refinedInstructions": "The improved step-by-step instructions (numbered list, plain text)",
  "explanation": "A friendly paragraph explaining what you changed and why, written to the admin",
  "suggestions": ["Optional additional tips for the admin, e.g., 'Consider enabling search_contacts to auto-fill hospital info'"]
}

LANGUAGE_INSTRUCTION`;
```

### 1.4 How the AI Knows About Available Tools

The system prompt contains a dynamic `AVAILABLE_TOOLS_BLOCK` that is populated based on the `templateContext.enabledTools` array. This block explicitly lists what each tool does and when to reference it:

```typescript
function buildToolDescriptions(enabledTools: string[]): string {
  const TOOL_DESCRIPTIONS: Record<string, string> = {
    search_contacts:
      "search_contacts(query, category?) -- Searches the restaurant's contact directory " +
      "(hospitals, emergency services, management, vendors, insurance). Use when the form " +
      "needs to look up phone numbers, addresses, or contact persons. Categories: " +
      "emergency, medical, management, vendor, government, insurance.",

    search_manual:
      "search_manual(query) -- Searches the restaurant operations manual for SOPs, " +
      "policies, safety protocols, and procedures. Use when the form instructions " +
      "reference company policies, standard procedures, or the employee handbook. " +
      "The actual RPC is search_manual_v2 (hybrid FTS + vector search).",

    search_products:
      "search_products(query, domain) -- Searches product databases. Domains: dishes, " +
      "wines, cocktails, recipes, beer_liquor. Use when the form relates to menu items, " +
      "food safety incidents, or product-related issues.",

    search_standards:
      "search_manual(query) -- (Alias) Searches the operations manual focusing on " +
      "restaurant standards, quality expectations, and service protocols. Same underlying " +
      "function as search_manual.",

    search_steps_of_service:
      "search_manual(query) -- (Alias) Searches the operations manual focusing on " +
      "steps of service, guest interaction protocols, and FOH procedures. Same underlying " +
      "function as search_manual, but instruction should hint the query toward service steps.",
  };

  const enabled = enabledTools
    .map((t) => TOOL_DESCRIPTIONS[t])
    .filter(Boolean);

  if (enabled.length === 0) {
    return "No tools are enabled for this form. The AI will extract values only from the user's input.";
  }

  return "The form-filling AI has access to:\n" +
    enabled.map((d, i) => `${i + 1}. ${d}`).join("\n");
}
```

### 1.5 Bilingual Handling

The function handles bilingual instructions by:

1. **Input language detection** -- The `language` parameter determines the AI's response language.
2. **Instructions are stored per-language** -- `instructions_en` and `instructions_es` are separate columns. The admin refines one language at a time.
3. **System prompt language switch** -- Same `LANGUAGE_INSTRUCTIONS` pattern as `ask-form`:

```typescript
const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  en: "Respond in English. The refined instructions should be in English.",
  es: "Responde en espanol. Las instrucciones refinadas deben estar en espanol.",
};
```

4. **Cross-language awareness** -- If the admin writes instructions in English but the form has `title_es`, the AI does not translate -- it refines in the requested language. Translation is a separate admin action (manual or future "translate instructions" button).

### 1.6 Multi-Turn Conversation

The function supports multi-turn refinement via `conversationHistory`. Flow:

```
Turn 1:
  Admin: "Check the handbook for rules broken"
  AI: Returns refined instructions + explanation

Turn 2:
  Admin: "Also add a step about notifying the regional manager"
  AI: Returns updated instructions incorporating the new step

Turn 3:
  Admin: "Make step 3 shorter"
  AI: Returns updated instructions with step 3 condensed
```

Implementation: The `conversationHistory` array is prepended to the messages list, capped at 6 messages (same as `ask-form`). Each turn builds on the previous refinement.

```typescript
const messages: ChatMessage[] = [
  { role: "system", content: systemPrompt },
  ...sanitizedHistory.slice(-6),
  { role: "user", content: rawInstructions },
];
```

### 1.7 Full Implementation Skeleton

```typescript
// supabase/functions/refine-form-instructions/index.ts

import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateWithClaims, AuthError } from "../_shared/auth.ts";
import { checkUsage, incrementUsage, UsageError } from "../_shared/usage.ts";

const MAX_INSTRUCTIONS_LENGTH = 5000;
const MAX_HISTORY_MESSAGES = 6;
const OPENAI_TIMEOUT_MS = 30_000;

// ... REFINE_SYSTEM_PROMPT, buildToolDescriptions, buildFieldsBlock ...

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Auth (admin-only)
    const { userId, supabase } = await authenticateWithClaims(req);

    // 2. Admin check
    const { data: membership } = await supabase
      .from("group_memberships")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (!membership || !["admin", "manager"].includes(membership.role)) {
      return errorResponse("forbidden", "Admin or manager access required", 403);
    }

    // 3. Parse + validate
    const body = await req.json();
    const { rawInstructions, templateContext, language = "en",
            conversationHistory = [], groupId } = body;

    if (!rawInstructions?.trim()) {
      return errorResponse("bad_request", "rawInstructions is required", 400);
    }
    if (rawInstructions.length > MAX_INSTRUCTIONS_LENGTH) {
      return errorResponse("bad_request",
        `Instructions must be ${MAX_INSTRUCTIONS_LENGTH} chars or fewer`, 400);
    }
    if (!templateContext?.title || !templateContext?.fields) {
      return errorResponse("bad_request",
        "templateContext with title and fields is required", 400);
    }

    // 4. Check usage
    const usage = await checkUsage(supabase, userId, groupId);
    if (!usage?.can_ask) {
      return errorResponse("limit_exceeded", "Usage limit reached", 429);
    }

    // 5. Build system prompt
    const toolBlock = buildToolDescriptions(templateContext.enabledTools || []);
    const fieldsBlock = buildFieldsSummary(templateContext.fields);
    const today = new Date().toISOString().split("T")[0];
    const langInstruction = LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS.en;

    const systemPrompt = REFINE_SYSTEM_PROMPT
      .replace("YYYY-MM-DD", today)
      .replace("AVAILABLE_TOOLS_BLOCK", toolBlock)
      .replace("FIELDS_BLOCK", fieldsBlock)
      .replace("LANGUAGE_INSTRUCTION", langInstruction);

    // 6. Assemble messages
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-MAX_HISTORY_MESSAGES),
      { role: "user", content: rawInstructions },
    ];

    // 7. Call OpenAI
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          response_format: { type: "json_object" },
          max_tokens: 1200,
          temperature: 0.4,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("[refine] OpenAI error:", response.status, errText);
        return errorResponse("ai_error", "Failed to refine instructions", 500);
      }

      const data = await response.json();

      // Check for truncated response before parsing
      if (data.choices[0].finish_reason === "length") {
        console.error("[refine] OpenAI response truncated (finish_reason: length)");
        return errorResponse(
          "ai_malformed",
          "The AI returned an invalid response. Please try again.",
          500
        );
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(data.choices[0].message.content);
      } catch (parseErr) {
        console.error("[refine] JSON.parse failed:", parseErr);
        return errorResponse(
          "ai_malformed",
          "The AI returned an invalid response. Please try again.",
          500
        );
      }

      // 8. Increment usage
      await incrementUsage(supabase, userId, groupId).catch(console.error);

      // 9. Return
      return jsonResponse({
        refinedInstructions: parsed.refinedInstructions || "",
        explanation: parsed.explanation || "",
        suggestions: parsed.suggestions || [],
        usage: {
          dailyUsed: usage.daily_count + 1,
          dailyLimit: usage.daily_limit,
          monthlyUsed: usage.monthly_count + 1,
          monthlyLimit: usage.monthly_limit,
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse("Unauthorized", error.message, 401);
    }
    if (error instanceof UsageError) {
      return errorResponse("server_error", error.message, 500);
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      return errorResponse("timeout", "AI request timed out", 504);
    }
    console.error("[refine] Unexpected error:", error);
    return errorResponse("server_error", "An unexpected error occurred", 500);
  }
});
```

### 1.8 Example Interaction

**Admin writes:**
> "Check employee handbook for rules broken"

**AI returns:**

```json
{
  "refinedInstructions": "1. Identify the employee and their role from the user's description. Extract employee_name, position, and department.\n2. Determine the type of violation from the user's input and set violation_type to the closest matching option (Attendance, Performance, Conduct, Policy, Safety, or Other).\n3. Assess the severity based on context. If the user mentions prior warnings, set severity accordingly and populate prior_warnings_count.\n4. Write a factual, professional incident description in the description field. Use only facts from the user's input -- no opinions or assumptions.\n5. Use the search_manual tool to query for the specific policy that was violated (e.g., 'attendance policy', 'conduct policy'). Reference the relevant policy in the corrective_action field.\n6. Suggest appropriate corrective action based on the violation type and severity. Populate corrective_action and improvement_timeline.\n7. If any required fields (employee_name, violation_type, severity, description, corrective_action) cannot be determined, ask about them in the followUpQuestion.",
  "explanation": "I refined your instructions to explicitly name the search_manual tool so the form-filling AI knows to look up specific policies. I also mapped each instruction step to the actual field keys (employee_name, violation_type, severity, etc.) and added the exact select/radio options the AI should use. This ensures the AI populates fields with valid values rather than free text. I added a final step about required fields so the AI knows what to ask about if information is missing.",
  "suggestions": [
    "Consider enabling search_contacts if you want the AI to auto-fill the supervisor's contact information.",
    "You could add an ai_hint to the violation_type field like 'Determine from keywords: late/absent=Attendance, rude=Conduct, unsafe=Safety' for better extraction accuracy."
  ]
}
```

### 1.9 Config File

```json
// supabase/functions/refine-form-instructions/config.toml
[function]
verify_jwt = false
```

---

## 2. Form Template CRUD API

### 2.1 Approach: Direct Supabase Client (No Edge Function Needed)

Form template CRUD does **not** need a dedicated edge function. The frontend uses the Supabase JS client directly, and RLS policies enforce authorization:

| Operation | Supabase Client Method | RLS Policy |
|-----------|----------------------|------------|
| **Create** | `supabase.from("form_templates").insert(...)` | Managers/admins in the same group |
| **Read (all)** | `supabase.from("form_templates").select("*").eq("group_id", groupId)` | Published: all authenticated. Drafts: manager/admin only |
| **Read (single)** | `.select("*").eq("id", templateId).single()` | Same as above |
| **Update** | `.update({...}).eq("id", templateId)` | Managers/admins in the same group |
| **Delete** | `.delete().eq("id", templateId)` | Admin only |

This is the same pattern used for product tables, training programs, and contacts. The existing RLS policies (from migration `20260223200000`) already enforce these rules.

### 2.2 Create Template

```typescript
// Frontend hook: useFormBuilder.ts

async function createTemplate(draft: FormTemplateDraft): Promise<string> {
  const { data, error } = await supabase
    .from("form_templates")
    .insert({
      group_id: groupId,
      slug: generateSlug(draft.title_en),
      title_en: draft.title_en,
      title_es: draft.title_es || null,
      description_en: draft.description_en || null,
      description_es: draft.description_es || null,
      icon: draft.icon || "ClipboardList",
      fields: draft.fields || [],           // JSONB array
      instructions_en: draft.instructions_en || null,
      instructions_es: draft.instructions_es || null,
      ai_tools: draft.ai_tools || [],       // TEXT[]
      status: "draft",                       // Always start as draft
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}
```

**Key points:**
- Slug is generated client-side from `title_en`. The unique constraint on `slug` prevents collisions (retry with suffix on conflict).
- Status always starts as `draft`. Publishing is a separate explicit action.
- `fields` is a JSONB array validated by the `trg_validate_form_template_fields` trigger.
- `created_by` links to the admin who created it.

### 2.3 Update Template (PATCH Fields, Instructions, AI Tools)

```typescript
async function updateTemplate(
  templateId: string,
  updates: Partial<FormTemplateDraft>
): Promise<void> {
  const { error } = await supabase
    .from("form_templates")
    .update({
      ...(updates.title_en !== undefined && { title_en: updates.title_en }),
      ...(updates.title_es !== undefined && { title_es: updates.title_es }),
      ...(updates.description_en !== undefined && { description_en: updates.description_en }),
      ...(updates.description_es !== undefined && { description_es: updates.description_es }),
      ...(updates.icon !== undefined && { icon: updates.icon }),
      ...(updates.fields !== undefined && { fields: updates.fields }),
      ...(updates.instructions_en !== undefined && { instructions_en: updates.instructions_en }),
      ...(updates.instructions_es !== undefined && { instructions_es: updates.instructions_es }),
      ...(updates.ai_tools !== undefined && { ai_tools: updates.ai_tools }),
      ...(updates.header_image !== undefined && { header_image: updates.header_image }),
    })
    .eq("id", templateId);

  if (error) throw error;
}
```

**Key points:**
- Partial updates only -- only send changed fields.
- The `updated_at` trigger auto-fires on any UPDATE.
- The `search_vector` trigger auto-updates FTS when title/description changes.
- The `fields` validation trigger runs on every UPDATE to `fields`.

### 2.4 Publish/Unpublish Toggle

```typescript
async function togglePublish(templateId: string, publish: boolean): Promise<void> {
  const updates: Record<string, unknown> = {
    status: publish ? "published" : "draft",
  };

  // If publishing, bump template_version (see Section 2.5)
  if (publish) {
    // Read current version first
    const { data: current } = await supabase
      .from("form_templates")
      .select("template_version, status")
      .eq("id", templateId)
      .single();

    // Only bump version if re-publishing (was published before, then edited)
    if (current?.status === "published" || current?.status === "draft") {
      // Version bump only on re-publish from a previously-published template
      // First publish keeps version 1
      if (current.status === "draft" && current.template_version > 1) {
        // Already bumped during edit -- no additional bump
      }
    }

    updates.status = "published";
  }

  const { error } = await supabase
    .from("form_templates")
    .update(updates)
    .eq("id", templateId);

  if (error) throw error;
}
```

### 2.5 Template Versioning: What Happens When a Published Template Is Edited

> **⚠️ SUPERSEDED -- DO NOT IMPLEMENT**
> The `bump_form_template_version()` trigger function defined below has been superseded by the DB plan's `handle_form_template_publish()` trigger function, which is the canonical approach chosen in the master plan (see `05-phase-form-builder-admin.md` Section "Conflict Resolutions"). The design rationale below is preserved for reference, but the SQL in this section must NOT be applied to any migration. Use `handle_form_template_publish()` from the DB plan instead.

**Strategy: Bump-on-publish, snapshot-on-submit.**

The system uses a simple integer version counter (`template_version`) combined with a fields snapshot on each submission:

1. **New template** -- Created with `template_version = 1`, `status = 'draft'`.
2. **First publish** -- Status changes to `published`. Version stays at 1.
3. **Admin edits a published template** -- The template is set back to `draft` (or stays published depending on UX choice). The edit is made directly to the same row.
4. **Re-publish after edit** -- `template_version` is incremented. This is done via a server-side trigger to guarantee atomicity:

> **⚠️ SUPERSEDED -- The trigger below is NOT to be implemented. See `handle_form_template_publish()` in the DB plan.**

```sql
-- SUPERSEDED: Migration: auto-bump template_version on re-publish
-- DO NOT APPLY -- use handle_form_template_publish() from the DB plan instead
CREATE OR REPLACE FUNCTION public.bump_form_template_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only bump when transitioning TO 'published' from a non-published state
  -- AND the template has been published before (version > 0 means it was published)
  IF NEW.status = 'published'
     AND OLD.status != 'published'
     AND OLD.template_version >= 1
     -- Only bump if fields or instructions actually changed
     AND (
       OLD.fields IS DISTINCT FROM NEW.fields
       OR OLD.instructions_en IS DISTINCT FROM NEW.instructions_en
       OR OLD.instructions_es IS DISTINCT FROM NEW.instructions_es
     )
  THEN
    NEW.template_version := OLD.template_version + 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bump_form_template_version
  BEFORE UPDATE ON public.form_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_form_template_version();
```

5. **Submissions record the version** -- When a form is submitted, `form_submissions.template_version` is set to the template's current version, and `form_submissions.fields_snapshot` stores a copy of the template's `fields` JSONB at that moment. This means:
   - Past submissions are always viewable with their original field structure.
   - The admin can compare which version a submission was filled against.
   - No data is lost when a template is updated.

**What about submissions in progress?** If a user has a draft submission open and the admin publishes a new version:
- The draft submission retains its `template_version` and `fields_snapshot`.
- When the user re-opens the draft, the frontend checks `draft.template_version < template.template_version` and shows a warning: "This form has been updated since you started. Your draft uses version X. Current version is Y."
- The user can continue with their draft or start fresh.

### 2.6 Archive vs. Delete

- **Archive** (`status = 'archived'`): Template is hidden from the `/forms` list but all past submissions remain accessible. Authenticated users can still read archived templates (for viewing past submissions). Preferred for compliance.
- **Delete**: Hard delete via `DELETE`. Only admins. The `ON DELETE RESTRICT` foreign key on `form_submissions.template_id` **prevents deletion** if any submissions exist. This protects compliance records.

Recommendation: The UI should offer "Archive" as the primary action and "Delete" only for never-published templates with zero submissions.

---

## 3. AI-Assisted Template Generation

### 3.1 New Edge Function: `generate-form-template`

When the admin uploads a photo of a paper form, describes a form via voice, or uploads a Word/PDF document, the AI generates a complete `fields` JSONB array plus instructions. This requires a **new edge function** because:

1. It uses vision (image analysis) -- different from `ingest-vision` which outputs product drafts.
2. It outputs a form template draft (fields array + instructions), not a product draft.
3. It needs a different structured output schema.

### 3.2 Request/Response Contract

```typescript
// POST /functions/v1/generate-form-template

interface GenerateTemplateRequest {
  // Exactly ONE of these input modes:
  description?: string;              // Text description of the form
  imageBase64?: string;              // Base64 data URL of paper form photo
  fileContent?: string;              // Extracted text from PDF/DOCX/TXT
  fileName?: string;                 // Original file name (for logging)

  language: "en" | "es";
  groupId: string;
}

interface GenerateTemplateResponse {
  draft: {
    title_en: string;
    title_es: string;
    description_en: string;
    description_es: string;
    icon: string;                    // Suggested Lucide icon
    fields: FormFieldDefinition[];   // Complete fields JSONB array
    instructions_en: string;         // AI-generated instructions
    instructions_es: string;
    ai_tools: string[];              // Recommended tools
  };
  confidence: number;                // 0-1 how confident the AI is
  missingFields: string[];           // What the AI could not determine
  aiMessage: string;                 // Explanation for the admin
  toolRecommendations: Array<{      // Why each tool was recommended
    tool: string;
    reason: string;
  }>;
}
```

### 3.3 OpenAI Structured Output Schema

The function uses OpenAI's `json_schema` response format (same pattern as `ingest-vision`) to guarantee valid output:

```typescript
const FORM_TEMPLATE_DRAFT_SCHEMA = {
  name: "form_template_draft",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title_en: { type: "string" },
      title_es: { type: "string" },
      description_en: { type: "string" },
      description_es: { type: "string" },
      icon: {
        type: "string",
        description: "Lucide icon name, e.g., ClipboardList, HeartPulse, AlertTriangle, FileText",
      },
      fields: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string", description: "snake_case unique identifier" },
            label: { type: "string", description: "Display label (English)" },
            label_es: { type: "string", description: "Display label (Spanish)" },
            type: {
              type: "string",
              enum: [
                "text", "textarea", "date", "time", "datetime",
                "select", "radio", "checkbox", "number", "phone",
                "email", "signature", "image", "file", "header",
                "instructions", "contact_lookup",
              ],
            },
            required: { type: "boolean" },
            placeholder: { type: "string" },
            section: { type: "string", description: "Visual grouping name" },
            hint: { type: "string" },
            ai_hint: { type: "string", description: "Extraction guidance for the AI" },
            options: {
              type: "array",
              items: { type: "string" },
              description: "For select/radio/checkbox types",
            },
            order: { type: "number" },
          },
          required: ["key", "label", "label_es", "type", "required", "placeholder",
                     "section", "hint", "ai_hint", "options", "order"],
          additionalProperties: false,
        },
      },
      instructions_en: { type: "string" },
      instructions_es: { type: "string" },
      ai_tools: {
        type: "array",
        items: { type: "string" },
        description: "Recommended tools: search_contacts, search_manual, search_products",
      },
      confidence: { type: "number" },
      missingFields: {
        type: "array",
        items: { type: "string" },
      },
      aiMessage: { type: "string" },
      toolRecommendations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tool: { type: "string" },
            reason: { type: "string" },
          },
          required: ["tool", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: [
      "title_en", "title_es", "description_en", "description_es", "icon",
      "fields", "instructions_en", "instructions_es", "ai_tools",
      "confidence", "missingFields", "aiMessage", "toolRecommendations",
    ],
    additionalProperties: false,
  },
};
```

### 3.4 System Prompt for Template Generation

```typescript
const GENERATE_SYSTEM_PROMPT = `You are a form template designer for Alamo Prime steakhouse. Given a description, image, or document of a form, produce a complete digital form template.

## Context
This is a restaurant operations app. Forms are used for: employee write-ups, injury reports, incident reports, daily checklists, food safety logs, equipment maintenance, etc. The forms are filled by managers, sometimes with AI assistance.

## Available Field Types
- text: Single-line text (names, titles, short answers)
- textarea: Multi-line text (descriptions, narratives, explanations)
- date: Date picker (ISO YYYY-MM-DD)
- time: Time picker (24h HH:MM)
- datetime: Date + time
- select: Dropdown single-select (provide options array)
- radio: Radio buttons single-select (provide options array, use for Yes/No or 3-5 options)
- checkbox: Multi-select checkboxes (provide options array)
- number: Numeric input
- phone: Phone number
- email: Email address
- signature: Finger/stylus signature pad (use for sign-off fields)
- image: Camera photo upload (use for evidence photos)
- file: File attachment
- header: Section header (display only, for visual grouping)
- instructions: Read-only text block (special instructions within the form)
- contact_lookup: Auto-populated from contacts DB (use for hospital, manager lookups)

## Field Design Rules
- field.key: Use snake_case, descriptive, unique (e.g., employee_name, date_of_incident)
- field.section: Group related fields (e.g., "Employee Information", "Incident Details", "Signatures")
- field.order: Sequential integers starting at 1
- field.ai_hint: Write a short instruction for the AI that fills this field (e.g., "Extract the full legal name of the employee from the user's description")
- For select/radio/checkbox: Provide complete options arrays
- Start each major section with a header field for visual structure
- Place signature fields at the end
- Place image/file fields in an "Attachments" or "Evidence" section near the end
- Use radio for Yes/No questions, select for 4+ options
- Use contact_lookup when the field needs to search the contacts database (hospitals, managers)

## Tool Recommendation Rules
- If any field mentions "hospital", "doctor", "medical", "emergency", or the form title contains "injury" -> recommend search_contacts
- If the form involves policies, procedures, handbooks, or compliance -> recommend search_manual
- If the form involves menu items, food safety, or product issues -> recommend search_products
- If none apply, recommend at minimum search_manual (most forms benefit from policy lookup)

## Instructions Design
Write numbered step-by-step instructions that tell the form-filling AI how to process user input for this form. Reference specific field keys and tool names. Keep to 5-10 steps.

## Output
Generate a complete form template with:
- Bilingual titles and descriptions
- All fields with proper types, labels (EN + ES), sections, and ai_hints
- Refined instructions referencing tools and field keys
- Tool recommendations with explanations

LANGUAGE_INSTRUCTION`;
```

### 3.5 Input Modes

**Text description:**
```typescript
messages.push({
  role: "user",
  content: `Create a form template based on this description:\n\n${description}`,
});
```

**Image (paper form photo):**
```typescript
messages.push({
  role: "user",
  content: [
    {
      type: "text",
      text: "Extract the form structure from this image. Identify all fields, " +
            "their types, sections, and any instructions visible on the form.",
    },
    {
      type: "image_url",
      image_url: { url: imageBase64, detail: "high" },
    },
  ],
});
```

**File content (pre-extracted text from PDF/DOCX/TXT):**
```typescript
messages.push({
  role: "user",
  content: `Create a form template from this document content:\n\n${fileContent}`,
});
```

### 3.6 Vision Model Selection

For image inputs, use `gpt-4o-mini` (not `gpt-5.2` as in `ingest-vision`). Rationale:

- Form structure extraction (boxes, labels, sections) is simpler than recipe ingredient extraction.
- `gpt-4o-mini` handles form layout recognition well and costs significantly less.
- If accuracy proves insufficient, we can upgrade to `gpt-4o` or `gpt-5.2` later.

For text/file inputs, use `gpt-4o-mini` consistently.

### 3.7 Auth & Admin Check

Same pattern as `refine-form-instructions`: admin or manager role required. Uses `authenticateWithClaims` + group membership check.

### 3.8 Config File

```json
// supabase/functions/generate-form-template/config.toml
[function]
verify_jwt = false
```

---

## 4. Validation & Guardrails

### 4.1 Server-Side Validation on `fields` JSONB (Existing)

The existing `trg_validate_form_template_fields` trigger (from migration `20260223200000`) enforces:

1. `fields` must be a JSONB array (`chk_fields_is_array` CHECK constraint).
2. Every element must have a non-empty `key` property.
3. Every element must have a non-empty `type` property.
4. No duplicate `key` values within the array.

### 4.2 Enhanced Validation (New Migration)

The existing trigger is minimal. For Phase 5, we add stricter validation:

```sql
-- Migration: enhance_form_field_validation

CREATE OR REPLACE FUNCTION public.validate_form_template_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  field_keys    TEXT[];
  field_key     TEXT;
  field_record  JSONB;
  field_type    TEXT;
  field_index   INT := 0;
  options_count INT;
  valid_types   TEXT[] := ARRAY[
    'text', 'textarea', 'date', 'time', 'datetime',
    'select', 'radio', 'checkbox', 'number', 'phone',
    'email', 'signature', 'image', 'file', 'header',
    'instructions', 'contact_lookup'
  ];
BEGIN
  -- Empty array is valid (new/blank template)
  IF NEW.fields = '[]'::JSONB OR jsonb_array_length(NEW.fields) = 0 THEN
    RETURN NEW;
  END IF;

  -- Max 50 fields per template
  IF jsonb_array_length(NEW.fields) > 50 THEN
    RAISE EXCEPTION 'Maximum 50 fields per template (found %)',
      jsonb_array_length(NEW.fields);
  END IF;

  field_keys := '{}';

  FOR field_record IN SELECT jsonb_array_elements(NEW.fields)
  LOOP
    field_index := field_index + 1;

    -- Every field must have a non-empty 'key'
    IF field_record->>'key' IS NULL OR field_record->>'key' = '' THEN
      RAISE EXCEPTION 'Field #% must have a non-empty "key" property', field_index;
    END IF;

    -- Every field must have a non-empty 'type'
    field_type := field_record->>'type';
    IF field_type IS NULL OR field_type = '' THEN
      RAISE EXCEPTION 'Field #% must have a non-empty "type" property', field_index;
    END IF;

    -- Type must be from the allowed list
    IF NOT (field_type = ANY(valid_types)) THEN
      RAISE EXCEPTION 'Field #% has invalid type "%". Allowed: %',
        field_index, field_type, array_to_string(valid_types, ', ');
    END IF;

    -- Select/radio/checkbox must have options array
    IF field_type IN ('select', 'radio', 'checkbox') THEN
      IF field_record->'options' IS NULL
         OR jsonb_typeof(field_record->'options') != 'array'
         OR jsonb_array_length(field_record->'options') = 0
      THEN
        RAISE EXCEPTION 'Field "%" (%) requires a non-empty options array',
          field_record->>'key', field_type;
      END IF;

      options_count := jsonb_array_length(field_record->'options');

      -- Max 50 options per field
      IF options_count > 50 THEN
        RAISE EXCEPTION 'Field "%" has % options (max 50)',
          field_record->>'key', options_count;
      END IF;
    END IF;

    -- Duplicate key check
    field_key := field_record->>'key';
    IF field_key = ANY(field_keys) THEN
      RAISE EXCEPTION 'Duplicate field key "%" in fields array', field_key;
    END IF;

    field_keys := array_append(field_keys, field_key);
  END LOOP;

  RETURN NEW;
END;
$$;
```

**New validations added:**
- **Max 50 fields** per template (resolved limit; the injury report has ~25 fields).
- **Type whitelist** -- Only the 17 supported field types are accepted.
- **Options required** for select/radio/checkbox (currently not checked).
- **Max 50 options** per select/radio/checkbox field.

### 4.3 Limits Summary

| Limit | Value | Rationale |
|-------|-------|-----------|
| Max fields per template | 50 | Largest real-world OSHA form is ~40 fields |
| Max options per select/radio/checkbox | 50 | Covers all US states with room; usually 3-10 |
| Max instructions length | ~10,000 chars | TEXT column, no artificial limit needed (but UI should warn at 5,000+) |
| Max templates per group | No hard limit | RLS + storage naturally limits; could add CHECK if needed |
| Valid field types | 17 (whitelisted) | Prevents garbage types from corrupting the renderer |

### 4.4 What Happens with "Weird" Forms

**All textarea, no structured fields:**
- Allowed. The form is valid but the AI will have less to extract into. The AI will populate the textareas with narrative text.
- The `refine-form-instructions` function would suggest: "Consider breaking the large text area into structured fields (date, select, etc.) to improve AI extraction accuracy."

**No required fields:**
- Allowed. The form can be submitted empty (as a draft). The AI will not generate `missingFields` for optional fields.

**No AI tools enabled:**
- Allowed. The AI will extract values purely from the user's input without searching any external data sources. The `refine-form-instructions` function would flag this as a suggestion.

**Only display fields (headers + instructions):**
- Allowed but useless for AI filling. The frontend should show a warning: "This form has no fillable fields."

### 4.5 Ensuring AI-Fillability

The system does **not** enforce AI-fillability at the database level. Instead, it uses **advisory signals** at the UI level:

1. **AI Fillability Score** (computed client-side):
   ```typescript
   function computeAiFillabilityScore(fields: FormFieldDef[]): {
     score: number; // 0-100
     issues: string[];
   } {
     const fillable = fields.filter(f => !NON_FILLABLE_TYPES.has(f.type));
     const issues: string[] = [];

     if (fillable.length === 0) {
       issues.push("No fillable fields -- AI cannot extract any values.");
       return { score: 0, issues };
     }

     let score = 60; // Base score for having fillable fields

     // Bonus: structured fields (select, radio, checkbox) are easier for AI
     const structured = fillable.filter(f =>
       ["select", "radio", "checkbox", "date", "time", "number"].includes(f.type)
     );
     score += Math.min(20, structured.length * 3);

     // Bonus: ai_hints present
     const hinted = fillable.filter(f => f.ai_hint?.trim());
     score += Math.min(10, Math.round(hinted.length / fillable.length * 10));

     // Bonus: required fields marked
     const required = fillable.filter(f => f.required);
     score += required.length > 0 ? 5 : 0;

     // Penalty: all textareas (hard for AI to know what goes where)
     const allTextarea = fillable.every(f => f.type === "textarea");
     if (allTextarea) {
       score -= 20;
       issues.push("All fields are textareas. Consider adding structured fields (select, radio, date) for better AI extraction.");
     }

     // Penalty: no ai_hints
     if (hinted.length === 0) {
       score -= 10;
       issues.push("No fields have ai_hint set. AI hints improve extraction accuracy.");
     }

     return { score: Math.max(0, Math.min(100, score)), issues };
   }
   ```

2. **Builder UI displays the score** as a progress ring with color coding (red < 40, yellow 40-70, green > 70).

3. **Smart recommendations panel** (keyword-based, computed client-side):

   | Signal | Recommendation |
   |--------|---------------|
   | Field type `contact_lookup` present | "Enable search_contacts for auto-fill" |
   | Title contains "injury", "medical", "safety" | "Enable search_manual + search_contacts" |
   | Title contains "write-up", "violation", "discipline" | "Enable search_manual for policy references" |
   | Title contains "food", "recipe", "menu", "allergen" | "Enable search_products" |
   | No ai_tools enabled | "Consider enabling at least search_manual" |

---

## 5. Search Functions Expansion

### 5.1 Current State of Search Functions

| Function | Exists | Search Type | Available as AI Tool |
|----------|--------|------------|---------------------|
| `search_contacts` | Yes (Phase 1) | FTS only | Yes (in `ask-form`) |
| `search_manual_v2` | Yes (pre-Phase 1) | Hybrid FTS + vector | Yes (in `ask-form` as `search_manual`) |
| `search_dishes` | Yes | Hybrid FTS + vector | Yes (in `ask-form` as `search_products`) |
| `search_wines` | Yes | Hybrid FTS + vector | Yes |
| `search_cocktails` | Yes | Hybrid FTS + vector | Yes |
| `search_recipes` | Yes | Hybrid FTS + vector | Yes |
| `search_beer_liquor` | Yes | Hybrid FTS + vector | Yes |
| `search_forms` | Yes (Phase 1) | FTS only | Yes (in `/ask` main chat) |
| `search_standards` | **No (alias needed)** | N/A | Pending |
| `search_steps_of_service` | **No (alias needed)** | N/A | Pending |

### 5.2 Mapping `search_standards` and `search_steps_of_service`

These are **not new database functions**. They are **tool aliases** that route to the existing `search_manual_v2` function with domain-specific query hints. The mapping lives in the edge function's tool execution layer.

**Why aliases instead of new RPC functions?**

1. The restaurant standards content lives in `manual_sections` -- the same table `search_manual_v2` searches.
2. The steps of service content lives in `manual_sections` under a specific parent section.
3. Creating separate RPC functions would duplicate the hybrid search logic.
4. The AI tool description and query hint are sufficient to scope the search.

**Implementation in `ask-form`:**

Add these to the `TOOL_REGISTRY` and `executeTool` function:

```typescript
// New tool definitions (add to TOOL_REGISTRY)

const TOOL_SEARCH_STANDARDS = {
  type: "function",
  function: {
    name: "search_standards",
    description:
      "Search the restaurant's quality standards, dress code, appearance guidelines, " +
      "professionalism expectations, and service standards. Use when the form involves " +
      "employee evaluations, performance reviews, or standards compliance.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'Search query -- e.g., "dress code", "professionalism standards", "quality expectations"',
        },
      },
      required: ["query"],
    },
  },
};

const TOOL_SEARCH_STEPS_OF_SERVICE = {
  type: "function",
  function: {
    name: "search_steps_of_service",
    description:
      "Search the restaurant's steps of service, guest interaction protocols, " +
      "greeting procedures, tableside service techniques, and FOH service flow. " +
      "Use when the form involves service quality incidents or FOH performance.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'Search query -- e.g., "greeting procedure", "table touch timing", "check presentation"',
        },
      },
      required: ["query"],
    },
  },
};
```

**Execution routing (in `executeTool`):**

```typescript
case "search_standards":
case "search_steps_of_service": {
  // Both route to search_manual_v2 -- the query + tool description
  // naturally scopes the results to the right manual sections.
  const embedding = await getQueryEmbedding(args.query, apiKey);
  if (!embedding) {
    return { results: [], citation: null };
  }

  const { data, error } = await supabase.rpc("search_manual_v2", {
    search_query: args.query,
    query_embedding: JSON.stringify(embedding),
    search_language: language,
    result_limit: 3,
  });

  if (error) {
    console.error(`[ask-form] ${toolName} error:`, error.message);
    return { results: [], citation: null };
  }

  const results = data || [];
  const citation: FormCitation | null = results.length > 0
    ? {
        source: toolName === "search_standards"
          ? "manual/standards"
          : "manual/service",
        title: results[0].name || results[0].slug,
        snippet: results[0].snippet?.replace(/<\/?mark>/g, "") || "",
      }
    : null;

  return { results, citation };
}
```

### 5.3 Making the Tool List Extensible

The current `TOOL_REGISTRY` pattern already supports extensibility. To add a new tool:

1. Define the OpenAI function calling schema (tool description + parameters).
2. Add a `case` in `executeTool` for the new tool name.
3. Add the tool name to the form template's `ai_tools` TEXT[] array.

**For true plug-and-play extensibility**, we can move the tool registry to the database. This is a **Phase 7+ enhancement**:

```sql
-- Future: ai_tool_definitions table
CREATE TABLE ai_tool_definitions (
  id          UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,            -- "search_contacts"
  label_en    TEXT NOT NULL,                   -- "Search Contacts"
  label_es    TEXT,
  description TEXT NOT NULL,                   -- OpenAI function description
  parameters  JSONB NOT NULL,                  -- OpenAI parameters schema
  handler     TEXT NOT NULL,                   -- "rpc:search_contacts" or "alias:search_manual_v2"
  handler_config JSONB DEFAULT '{}',           -- Extra config for the handler
  is_active   BOOLEAN DEFAULT true,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

This would let admins add new search tools without code changes. But for now, the code-level registry is sufficient and simpler.

### 5.4 Full Updated Tool Registry (for `ask-form`)

After Phase 5, the complete tool registry in `ask-form/index.ts`:

```typescript
const TOOL_REGISTRY: Record<string, any> = {
  search_contacts:             TOOL_SEARCH_CONTACTS,
  search_manual:               TOOL_SEARCH_MANUAL,
  search_products:             TOOL_SEARCH_PRODUCTS,
  search_standards: TOOL_SEARCH_STANDARDS,
  search_steps_of_service:     TOOL_SEARCH_STEPS_OF_SERVICE,
};
```

The form template's `ai_tools` array can now contain any of:
- `"search_contacts"`
- `"search_manual"`
- `"search_products"`
- `"search_standards"`
- `"search_steps_of_service"`

The builder UI presents these as toggle switches with descriptions.

---

## 6. Migration Manifest

### 6.1 New Migrations

| # | File | Lines | Description |
|---|------|-------|-------------|
| 1 | `YYYYMMDD_enhance_form_field_validation.sql` | ~80 | Replace `validate_form_template_fields()` with stricter version: type whitelist, options validation, max field/option counts |
| 2 | `YYYYMMDD_add_form_template_version_trigger.sql` | ~30 | Add `bump_form_template_version()` trigger for auto-versioning on re-publish |

### 6.2 New Edge Functions

| # | Directory | Config | Description |
|---|-----------|--------|-------------|
| 1 | `supabase/functions/refine-form-instructions/` | `verify_jwt: false` | AI instruction refiner for form builder |
| 2 | `supabase/functions/generate-form-template/` | `verify_jwt: false` | AI template generation from text/image/file |

### 6.3 Modified Edge Functions

| # | File | Changes |
|---|------|---------|
| 1 | `supabase/functions/ask-form/index.ts` | Add `search_standards` and `search_steps_of_service` to `TOOL_REGISTRY` and `executeTool` switch |

### 6.4 No New Tables

All data structures needed for Phase 5 already exist:
- `form_templates` -- stores templates (Phase 1)
- `form_submissions` -- stores submissions with version + snapshot (Phase 1)
- `contacts` -- searchable contact directory (Phase 1)
- `ai_prompts` -- system prompts (pre-existing)
- `group_memberships` -- admin role check (pre-existing)

---

## 7. Verification Plan

### 7.1 `refine-form-instructions` Edge Function

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Basic refinement | raw: "Check handbook for rules" | refinedInstructions references `search_manual` by name |
| 2 | Tool awareness | enabledTools: ["search_contacts"], raw: "Look up hospital" | refinedInstructions mentions `search_contacts` tool with category "medical" |
| 3 | Field key references | fields include employee_name, raw: "Get the employee name" | refinedInstructions references `employee_name` field key |
| 4 | Multi-turn | Turn 1: basic. Turn 2: "Also add step for contacts" | Turn 2 response includes contact lookup step |
| 5 | Spanish language | language: "es", raw: "Buscar politicas" | refinedInstructions in Spanish |
| 6 | No tools enabled | enabledTools: [], raw: "Check everything" | Explanation mentions no tools are enabled; suggestion to enable some |
| 7 | Auth: non-admin | Regular user token | 403 Forbidden |
| 8 | Auth: no token | Missing Authorization header | 401 Unauthorized |
| 9 | Usage limit | At daily limit | 429 limit_exceeded |
| 10 | Empty input | raw: "" | 400 bad_request |

### 7.2 `generate-form-template` Edge Function

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Text description | "A form for tracking daily kitchen temperatures" | Draft with fields: date, text (area), number (temp), select (station), signature |
| 2 | Image (paper form) | Photo of a standard injury report form | Draft with ~20+ fields matching the visible form layout |
| 3 | File content | Extracted text from a Word doc write-up template | Draft matching the document structure |
| 4 | Tool recommendations | Title "Employee Injury Report" | ai_tools includes "search_contacts" + "search_manual" |
| 5 | Bilingual output | language: "en" | Both title_en and title_es populated |
| 6 | Icon suggestion | Title "Medical Incident Report" | icon: "HeartPulse" or similar medical icon |
| 7 | Auth: non-admin | Regular user token | 403 Forbidden |
| 8 | Confidence score | Clear input | confidence > 0.7 |
| 9 | Ambiguous input | "A form" (very vague) | confidence < 0.5, missingFields populated |
| 10 | Large form | Complex multi-section form description | Fields array with proper sections and ordering |

### 7.3 Enhanced Field Validation

| # | Test | SQL | Expected |
|---|------|-----|----------|
| 1 | Valid fields | `UPDATE form_templates SET fields = '[{"key":"name","type":"text"}]' WHERE ...` | Success |
| 2 | Invalid type | `... fields = '[{"key":"x","type":"foobar"}]'` | Exception: invalid type |
| 3 | Missing options | `... fields = '[{"key":"x","type":"select"}]'` | Exception: requires options |
| 4 | Too many fields | 51-element array | Exception: maximum 50 fields |
| 5 | Too many options | select with 51 options | Exception: max 50 options |
| 6 | Duplicate keys | Two fields with key "name" | Exception: duplicate key |
| 7 | Empty array | `fields = '[]'` | Success (blank template) |
| 8 | Missing key | `fields = '[{"type":"text"}]'` | Exception: must have key |

### 7.4 Version Trigger

| # | Test | Action | Expected |
|---|------|--------|----------|
| 1 | First publish | Set status from 'draft' to 'published' | template_version stays 1 |
| 2 | Edit published | Update fields on published template, re-publish | template_version becomes 2 |
| 3 | Publish without changes | Set status from 'draft' to 'published' (no field/instruction changes) | template_version stays same |
| 4 | Multiple edits | Publish -> edit fields -> re-publish -> edit instructions -> re-publish | template_version = 3 |

### 7.5 Tool Aliases in `ask-form`

| # | Test | Tool Call | Expected |
|---|------|-----------|----------|
| 1 | search_standards | query: "dress code" | Calls search_manual_v2, returns manual sections about dress code |
| 2 | search_steps_of_service | query: "greeting procedure" | Calls search_manual_v2, returns service-related manual sections |
| 3 | Unknown tool | query to unregistered tool | Warning logged, empty results returned |

---

## Appendix A: File Manifest

### New Files

```
supabase/functions/refine-form-instructions/
  index.ts             (~250 lines)
  config.toml          (verify_jwt = false)

supabase/functions/generate-form-template/
  index.ts             (~350 lines)
  config.toml          (verify_jwt = false)

supabase/migrations/
  YYYYMMDD_enhance_form_field_validation.sql    (~80 lines)
  YYYYMMDD_add_form_template_version_trigger.sql (~30 lines)
```

### Modified Files

```
supabase/functions/ask-form/index.ts
  - Add TOOL_SEARCH_STANDARDS definition
  - Add TOOL_SEARCH_STEPS_OF_SERVICE definition
  - Update TOOL_REGISTRY with 2 new entries
  - Add 2 cases to executeTool switch
  (~50 new lines, ~5 modified lines)
```

### Deployment Order

1. Push migrations (`npx supabase db push`)
2. Deploy modified `ask-form` (`npx supabase functions deploy ask-form`)
3. Deploy new `refine-form-instructions` (`npx supabase functions deploy refine-form-instructions`)
4. Deploy new `generate-form-template` (`npx supabase functions deploy generate-form-template`)

---

## Appendix B: Security Summary

| Concern | Mitigation |
|---------|-----------|
| Non-admin creating templates | RLS policies restrict INSERT/UPDATE to manager/admin role |
| Non-admin refining instructions | Edge function checks `group_memberships.role` |
| Prompt injection in instructions | AI output is a structured JSON (not executed as code). Instructions are read-only context for `ask-form`. |
| Excessive API usage | Shared usage counters (daily/monthly limits) via `checkUsage`/`incrementUsage` |
| Invalid field types in JSONB | Server-side trigger validates type whitelist |
| JSONB injection | PostgreSQL JSONB is type-safe; no SQL injection vector |
| Cross-group template access | RLS `group_id = get_user_group_id()` on all operations |
| Template deletion with submissions | `ON DELETE RESTRICT` FK prevents deletion if submissions exist |

---

*This document covers the backend and edge function design for Phase 5: Form Builder Admin. It is paired with a separate frontend/UX plan that covers the builder UI, drag-and-drop field editor, AI tools panel, and instructions editor.*
