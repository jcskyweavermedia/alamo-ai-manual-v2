# Alamo Prime AI Restaurant Ops  
**Simplified Architecture & Build Plan (Lovable + Supabase)**

This document defines a **non-overengineered**, implementation-ready architecture for a **free**, mobile-first restaurant operations manual with a **grounded AI assistant**.  
The focus is **design-first**, **frontend-first**, and **minimal admin control**.

---

## SYSTEM ARCHITECTURE OVERVIEW (SIMPLIFIED)

### Frontend (Lovable / React)
- App Shell + Navigation (mobile → iPad → desktop)
- Manual Reader (Markdown-based SOPs)
- Keyword Search
- AI Assistant (text-first, optional voice)
- Minimal Admin Panel

### Backend (Supabase)
- **Auth:** Supabase Auth (magic link + optional invite)
- **Database:** Postgres (content, users, roles, limits)
- **Search:**  
  - Phase 1: Keyword search (simple or FTS)  
  - Phase 2: Hybrid keyword + vector (pgvector)
- **AI Gateway:** Supabase Edge Function `/ask`
  - Enforces limits, role rules, voice toggle
  - Performs retrieval + response grounding
- **Voice:**  
  - MVP: Device/browser speech-to-text + device TTS

---

## CORE MODULES (LEAN SET)

---

### 1. DESIGN SYSTEM FOUNDATION (FIRST & REQUIRED)

**Purpose**  
Translate the design document into reusable UI primitives so every screen is consistent.

**Inputs**
- Color tokens (light/dark)
- Typography scale
- Spacing + radius rules
- Interaction principles

**Outputs**
- Shared UI components and themes

**Database Interaction**
- None

**UI Components**
- Buttons, Inputs, Toggles
- Cards, List Rows
- Modals / Sheets
- Tabs / Sidebar
- Typography styles (H1/H2/Body/Caption)
- SOP callout blocks
- Loading / Empty states

---

### 2. AUTHENTICATION & ROLES

**Purpose**  
Secure access with simple role-based control.

**Inputs**
- Email
- Invite token (optional)
- Language preference

**Outputs**
- Session
- User profile
- Role assignment

**Database Interaction**
- `profiles`
- `groups`
- `group_memberships`
- `role_policies`

**UI Components**
- Sign-in (magic link)
- Invite acceptance
- Role-based route guards

---

### 3. APP SHELL & NAVIGATION

**Purpose**  
Provide calm, fast navigation optimized for service environments.

**Inputs**
- User role
- Device size
- Last opened section

**Outputs**
- Navigation state
- Active routes

**Database Interaction**
- `user_preferences` (optional)

**UI Components**
- Bottom tabs (mobile)
- Sidebar split view (iPad / desktop)
- Header with search + AI entry point

---

### 4. MANUAL READER (MARKDOWN)

**Purpose**  
Allow staff to read SOPs quickly under pressure.

**Inputs**
- `section_id`
- Language (EN / ES)

**Outputs**
- Rendered Markdown
- Table of contents
- Related sections

**Database Interaction**
- `manual_sections`
- `manual_documents`

**UI Components**
- Section tree
- Markdown viewer
- In-page TOC
- Bookmark / Quick actions
- “Ask AI about this” shortcut

---

### 5. SEARCH (KEYWORD)

**Purpose**  
Instantly find SOPs without AI.

**Inputs**
- Search query
- Language
- Optional role filter

**Outputs**
- Ranked result list

**Database Interaction**
- `manual_documents`
- Optional Postgres FTS index

**UI Components**
- Global search bar
- Results list with highlights

---

### 6. AI ASSISTANT (GROUNDED, SIMPLE)

**Purpose**  
Answer questions strictly from the manual, concise by default.

**Inputs**
- Question (text or voice transcript)
- Language
- Role
- Group policy

**Outputs**
- Concise answer
- Citations (section links)
- Optional expanded answer
- Optional voice playback

**Database Interaction**
- `usage_counters`
- `role_policies`
- Optional: `ai_messages`, `ai_citations`

**UI Components**
- Chat interface
- Voice button (policy-controlled)
- “Expand answer” toggle
- Sources drawer

---

### 7. MINIMAL ADMIN PANEL (NO ANALYTICS)

**Purpose**  
Simple operational control—nothing more.

**Admin Can**
- Add / remove users
- Enable / disable users
- Assign role + group
- Set AI usage limits
- Enable / disable AI voice per role

**Inputs**
- Email
- Role
- Group
- Limit values

**Outputs**
- Updated access rules

**Database Interaction**
- `profiles`
- `groups`
- `group_memberships`
- `role_policies`

**UI Components**
- Users list
- Add user form
- Enable / disable toggle
- Group policy editor:
  - Daily AI question limit
  - Monthly AI question limit
  - Voice enable toggle per role

---

## DATABASE STRUCTURE (LEAN)

### Identity & Roles
- `profiles`  
  - `user_id`, `name`, `default_language`, `is_active`
- `groups`  
  - `id`, `name`
- `group_memberships`  
  - `group_id`, `user_id`, `role`
- `role_policies`  
  - `group_id`, `role`, `daily_limit`, `monthly_limit`, `voice_enabled`

---

### Manual Content
- `manual_sections`  
  - hierarchy, ordering
- `manual_documents`  
  - `section_id`, `language`, `markdown`, `version`, `updated_at`

---

### AI Enforcement
- `usage_counters`  
  - `group_id`, `user_id`, `role`, `period_type`, `period_start`, `count`
- Optional:
  - `ai_messages`
  - `ai_citations`

---

### Phase 2 (Optional RAG)
- `rag_chunks`  
  - `section_id`, `language`, `chunk_text`, `embedding`, `version_hash`

---

## BUILD ORDER (DESIGN-FIRST, FRONTEND-FIRST)

### STEP 1 — DESIGN SYSTEM + APP SHELL
- Implement themes (light/dark)
- Build reusable UI components
- Responsive navigation (mobile → desktop)

**Outcome:**  
Every future screen is fast to build and visually consistent.

---

### STEP 2 — MANUAL READER MVP
- Sections + Markdown rendering
- Language toggle
- Bookmarking

**Outcome:**  
App is already useful without AI.

---

### STEP 3 — AUTHENTICATION + ROLES
- Supabase Auth
- Group + role enforcement

**Outcome:**  
Controlled access before admin logic.

---

### STEP 4 — SEARCH MVP
- Keyword search UI
- Result → document navigation

**Outcome:**  
Fast SOP retrieval without AI cost or risk.

---

### STEP 5 — AI ASSISTANT (TEXT ONLY)
- Edge Function `/ask`
- Keyword-based retrieval
- Enforce limits via `role_policies`
- Return answers + citations

**Outcome:**  
Safe, grounded AI with minimal complexity.

---

### STEP 6 — MINIMAL ADMIN PANEL
- User management
- Role + group assignment
- AI limits + voice toggle

**Outcome:**  
Operators can control usage without dashboards or analytics.

---

### STEP 7 — VOICE (OPTIONAL)
- Device speech-to-text
- Device TTS
- Respect role policy toggles

**Outcome:**  
Hands-free support during service.

---

### STEP 8 — PHASE 2 (OPTIONAL)
- Chunking + embeddings
- Hybrid keyword + vector retrieval

**Outcome:**  
Improved AI accuracy once core UX is proven.

---

## WHAT WAS INTENTIONALLY REMOVED

- Billing / subscriptions
- Analytics dashboards
- Complex RAG pipelines in v1
- Translation workflow tooling
- Enterprise SSO
- Deep AI memory systems
- POS / LMS integrations

---

## FINAL PRINCIPLE

> **Design first. Manual first. AI second. Voice last.**  
> If the manual experience is excellent, the AI becomes a multiplier—not a crutch.

This structure is optimized for **Lovable**, **Supabase**, and **real restaurant usage under pressure**.
