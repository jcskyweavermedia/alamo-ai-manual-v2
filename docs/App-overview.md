## APP NAME

**Alamo Prime AI Restaurant Ops (Restaurant Operations Manual + AI)**

## ONE-SENTENCE DESCRIPTION

A mobile-first restaurant operations manual that stores and serves your Markdown knowledge base from **Supabase**, delivering a premium reading experience and a voice-enabled AI assistant that answers only from approved content—in **English and Spanish**.

## WHO THIS APP IS FOR

* **Primary:** Restaurant staff (front-of-house, back-of-house, shift leads) who need fast, reliable answers during service (EN/ES)
* **Secondary:** Managers and operators who maintain standards, onboarding, and daily execution
* **Admin:** Corporate ops / training teams who add/edit manual content and manage access, usage, and language coverage

## PROBLEM BEING SOLVED

* Operational knowledge is scattered, outdated, or hard to find under pressure
* Traditional manuals aren’t used because they’re slow to navigate on mobile
* Staff ask managers repetitive questions, creating bottlenecks and inconsistency
* When new sections are added, it’s unclear what content is “live” vs. not yet indexed for AI answers
* Teams often need SOPs in **Spanish**, not just English
* Unrestricted AI can hallucinate or drift off-topic without strict guardrails

## SOLUTION OVERVIEW

* **Supabase-Backed Content Hub:** All manual content lives in **Supabase** as Markdown (MD), making **adding/editing content fast and simple** without redeploying the app.
* **Centralized Manual Reader:** The app pulls content directly from Supabase and presents it in a structured, easy-to-browse manual optimized for mobile/iPad, with desktop support.
* **Bilingual Manual + AI (EN/ES):** Users can read the manual and interact with the AI assistant in **English or Spanish**, with language selection that feels effortless.
* **AI Assistant with Grounded Answers:** Uses **hybrid retrieval** (vector-based semantic search + keyword search) to produce accurate answers grounded in the Supabase-stored manual content.
* **Content Sync & RAG Readiness Tracking:** Clearly surfaces which new/updated Markdown files or sections are **not yet processed/indexed** for retrieval—across both languages when applicable.
* **Voice-First Support:** Staff can ask questions by voice; AI responds in **text + voice**, defaulting to concise guidance with an optional **“Expand answer”** for deeper detail.
* **Safety & Control:** Domain-limited responses (restaurant ops only), usage limits (daily/monthly), higher limits for admins, and basic abuse prevention.
* **Frictionless Access:** Invite-link onboarding for simple account creation and fast rollout across locations.

## CORE VALUE PROPOSITION

**Instant, consistent answers and SOP access—on mobile, in English and Spanish—powered by a Supabase-managed manual that stays current and AI responses that stay grounded.**

## PRIMARY USER ACTION

**Ask a restaurant ops question (voice or text) and get a concise, manual-grounded answer in the chosen language—then optionally expand for step-by-step detail.**

## MONETIZATION MODEL (IF APPLICABLE)

* **B2B SaaS per location or per seat**

  * **Staff tier:** Standard monthly question limits (EN/ES access)
  * **Admin tier:** Higher limits + content management via Supabase + RAG sync/index status + analytics
* Optional add-ons:

  * Additional usage packs (overage)
  * Multi-location enterprise features (advanced roles, reporting, SSO later)

## FUTURE EXPANSION (OPTIONAL)

* **Translation workflow:** Admin tools to manage EN↔ES coverage, flag missing translations, and keep both languages in sync
* **Role-based experiences:** FOH/BOH/Manager views and tailored navigation + answers
* **Training mode:** Quizzes, checklists, certifications tied to manual sections (EN/ES)
* **Operational workflows:** Incident logs, shift notes, daily checklists linked to SOPs
* **Analytics:** Top questions, content gaps, and “no-answer found” reports to drive manual updates
* **Integrations:** POS/LMS/tools for contextual guidance (later phase)
