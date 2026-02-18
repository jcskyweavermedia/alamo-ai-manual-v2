# Alamo Prime Training System - Unified Overview

> Synthesized from 7 specialist analyses: Technical Architect, Database Engineer, AI/ML Engineer, UX/UI Designer, Educational Designer, Restaurant Operations Advisor, Devil's Advocate

---

## 1. Vision Statement

Transform the existing Alamo Prime knowledge base into an **interactive AI-powered training platform** where restaurant staff learn through conversation (voice + text) with an AI teacher, take quizzes, and receive continuous evaluation — while managers get a 30-second dashboard view of team readiness.

**Design Principles:**
- Build for 1 restaurant, architect for multi-tenant from day one
- Voice AND text always available (never force one mode)
- AI evaluates learning; humans verify competency
- Mobile-first, noisy-restaurant-aware
- Cost is secondary to quality

---

## 2. What We're Building

### 2.1 Staff Experience

A new **"Training"** tab in the left sidebar (GraduationCap icon) that opens:

1. **Course Listing Page** (`/training`) — Card grid showing all available courses with progress rings, estimated time, and status badges (Not Started / In Progress / Completed)

2. **Course Detail Page** (`/training/:courseSlug`) — Section list with progress indicators, showing which sections are done, which have quizzes available, and the overall course grade

3. **Learning Session** (`/training/:courseSlug/:sectionSlug`) — Split-screen: content panel (left/top) + AI chat panel (right/bottom). The AI teacher:
   - Explains concepts from the knowledge base
   - Asks probing questions to check understanding
   - Remembers what this student has learned across sessions
   - Available in both voice (WebRTC) and text simultaneously
   - Generates dual feedback: student-facing (empowering) and manager-facing (actionable)

4. **Quiz Page** (`/training/:courseSlug/:sectionSlug/quiz`) — Hybrid assessment:
   - Multiple choice questions (AI-generated + manager-curated)
   - Voice evaluation questions (demonstrate knowledge verbally)
   - Immediate feedback with explanations
   - Minimum 70% to pass (configurable per course)

5. **Progress Dashboard** (`/training/progress`) — Student self-view of completed courses, scores, badges, and areas to review

### 2.2 Manager Experience

6. **Manager Training Dashboard** (`/admin/training`) — At-a-glance team view:
   - Team completion rates with color coding (red/yellow/green)
   - AI-generated insights ("Juan needs help with wine pairings")
   - Individual drill-down to see conversation history and evaluation details
   - Quick actions: assign courses, extend deadlines, add quiz questions

7. **Rollout Wizard** (`/admin/training/rollout`) — Create time-bounded training packages:
   - Select courses/sections to include
   - Set training deadline (e.g., "Complete by March 15")
   - Set item expiry (e.g., "This rollout expires April 1")
   - Assign to specific roles, individuals, or entire team
   - Track rollout completion rates

### 2.3 AI Teacher Persona

The AI teacher adapts its approach:
- **Bilingual**: Responds in the language the student uses (EN/ES)
- **Encouraging but honest**: "Great start! Let's refine your description of the aging process..."
- **Context-aware**: Knows what section the student is studying, their past performance, and the restaurant's specific products
- **Grounded**: Only teaches from the knowledge base — never invents menu items or procedures
- **Dual feedback**: Every interaction generates both a student view and a manager view

---

## 3. Course Structure

### 3.1 Server 101 Curriculum (7 Courses)

Based on the existing knowledge base and educational design analysis:

| # | Course | Sections | Est. Time | Priority |
|---|--------|----------|-----------|----------|
| 1 | Culture & Standards | 5 | 20 min | Highest |
| 2 | Entrees & Steaks | 7 | 30 min | High |
| 3 | Appetizers & Sides | 5 | 20 min | High |
| 4 | Wine Program | 6 | 25 min | Medium |
| 5 | Cocktails & Bar | 5 | 20 min | Medium |
| 6 | Beer & Liquor | 4 | 15 min | Medium |
| 7 | Desserts & After-Dinner | 3 | 10 min | Lower |

**Total estimated training time: ~2.5 hours** (realistic for restaurant staff across 2-3 weeks)

### 3.2 Content Sourcing

Courses pull content from existing tables — no content duplication:
- `manual_sections` → Culture, procedures, service standards
- `plate_specs` + `foh_plate_specs` → Dish knowledge (entrees, appetizers)
- `prep_recipes` → Kitchen preparation details
- `wines` → Wine program
- `cocktails` → Cocktail program
- `beer_liquor_list` → Beer & liquor knowledge

### 3.3 Progression Model

- **Flexible ordering**: Students can take courses in any order
- **Quizzes are mandatory**: Must pass quiz (70%+) to mark a section complete
- **Section interactions are optional**: Students may skip AI conversation and go straight to quiz
- **Fast-track option**: Experienced staff can "challenge test" — take the quiz immediately without the learning session
- **Spaced repetition**: System resurfaces concepts the student struggled with

---

## 4. Technical Architecture

### 4.1 New Database Tables (12 tables)

```
courses                    — Course definitions (slug, title, description, order)
course_sections            — Section definitions linked to content sources
course_enrollments         — Student enrollment tracking per course
section_progress           — Per-section completion, scores, time spent
course_conversations       — Persistent chat history (AI teacher sessions)
quiz_questions             — MC + voice questions (AI-generated + manual)
quiz_attempts              — Quiz session tracking
quiz_attempt_answers       — Individual answer records
evaluations                — AI evaluation snapshots (student + manager views)
rollouts                   — Training package definitions with deadlines
rollout_assignments        — Per-user rollout assignment tracking
content_change_log         — MD5 hash tracking for content updates
```

**Key design decisions:**
- All tables scoped by `group_id` (multi-tenant ready)
- `course_conversations` stores full chat history for persistence
- `evaluations` stores dual JSON: `student_feedback` + `manager_feedback`
- Content change detection via MD5 hashes (not triggers on source tables)
- Estimated storage: ~51MB per restaurant per 6 months

### 4.2 New/Modified Edge Functions

| Function | Purpose |
|----------|---------|
| `course-evaluate` (NEW) | AI evaluation of student responses, dual feedback generation |
| `course-quiz-generate` (NEW) | AI quiz question generation from content |
| `ask` (MODIFY) | Add `training` domain support |
| `realtime-session` (MODIFY) | Add training context for voice sessions |

### 4.3 Frontend Components (~15 new)

**Pages (5):**
- `TrainingHome` — Course listing with progress
- `CourseDetail` — Section list within a course
- `LearningSession` — AI-powered learning interface
- `QuizPage` — Hybrid MC + voice quiz
- `ManagerTrainingDashboard` — Team oversight

**Components (10+):**
- `CourseCard` — Progress ring, status badge
- `SectionList` — Checkmarks, quiz status
- `TrainingChatPanel` — Persistent AI conversation (reuses existing patterns)
- `QuizMCQuestion` — Multiple choice with feedback
- `QuizVoiceQuestion` — Voice response with evaluation
- `ProgressRing` — Circular progress indicator
- `CompetencyBadge` — Achievement display
- `TeamProgressTable` — Manager grid view
- `RolloutWizard` — Multi-step rollout creation
- `EvaluationCard` — Dual-view feedback display

### 4.4 Memory Architecture (4 Tiers)

1. **Immediate Context** — Current conversation messages (in-session)
2. **Session Summary** — AI-generated summary stored when session ends
3. **Evaluation Context** — Running scores, strengths/weaknesses per section
4. **Cross-Section Awareness** — What student knows from other sections (for connections)

Memory is stored in `course_conversations` and `evaluations` tables, loaded into AI context at session start.

### 4.5 Microphone Handling for Noisy Environments

- **Push-to-Talk (PTT)** as default mode in training (not voice-activity detection)
- **Visual noise indicator** — Shows ambient noise level
- **Auto-pause** — If connection drops, session state is preserved
- **Fallback to text** — If voice quality is poor, prompt suggests switching to text
- **Mute button** always visible and accessible

---

## 5. Assessment & Evaluation System

### 5.1 Quiz Types

**Multiple Choice (AI-generated + Manager-curated):**
- 5-10 questions per section
- AI generates questions from content, manager can edit/add
- Distractors based on common misconceptions
- Immediate feedback with explanations

**Voice Evaluation:**
- "Describe the dry-aging process to a guest"
- "Recommend a wine pairing for the ribeye"
- AI evaluates: accuracy, completeness, confidence, hospitality tone
- Rubric-scored (not just pass/fail)

### 5.2 Scoring & Competency

**4-Level Framework:**
1. **Novice** (0-59%) — Needs additional training
2. **Competent** (60-79%) — Meets basic expectations
3. **Proficient** (80-89%) — Exceeds expectations
4. **Expert** (90-100%) — Can train others

**Running Evaluation:**
- Updated after every interaction and quiz
- Tracks per-section scores and overall course grade
- AI identifies patterns: "Consistently strong on steaks, struggles with wine temps"

**Final Evaluation:**
- Generated when all quizzes in a course are passed
- Comprehensive report for manager review
- Includes: time spent, attempt counts, strengths, areas for improvement

### 5.3 Dual Feedback System

Every AI evaluation produces two views:

**Student Feedback** (empowering):
> "You showed great knowledge of our steak cuts! Your description of the dry-aging process was spot-on. For your next session, let's work on wine pairing confidence — you know the wines, you just need practice presenting them to guests."

**Manager Feedback** (actionable, quick-glance):
> ```json
> { "section": "Wine Program - Red Wines",
>   "competency": "Competent",
>   "score": 72,
>   "strengths": ["Knows varietals", "Good on regions"],
>   "gaps": ["Temperature service", "Food pairing confidence"],
>   "recommendation": "Pair with experienced server for 2 wine services" }
> ```

---

## 6. Rollout System

### 6.1 How Rollouts Work

Managers create training packages that combine:
- **Course/section selection** — Which content to train on
- **Training deadline** — "Complete by March 15" (staff sees countdown)
- **Item expiry** — "This rollout deactivates April 1" (auto-archive)
- **Assignment** — Specific roles, individuals, or all staff

### 6.2 Rollout Use Cases

- **New hire onboarding**: Assign all 7 courses, 3-week deadline
- **Menu update**: "New spring cocktails" — assign Cocktails course sections, 1-week deadline
- **Seasonal refresh**: Re-assign Wine Program before holiday season
- **Performance remediation**: Assign specific sections to individuals who scored low

### 6.3 Dynamic Content Updates

When menu items change in the product tables:
- Content change log detects MD5 hash differences
- Affected course sections are flagged
- Manager gets notification: "Wine list updated — 2 course sections may need review"
- Manager decides whether to: update quiz questions, re-assign sections, or acknowledge

---

## 7. Design Decisions (Finalized)

### 7.1 Voice Transcription Retention
**Decision: Store with 90-day auto-expiry**
- Voice answers are transcribed via Whisper; server reviews transcript before submission
- Full transcriptions stored for 90 days (coaching + dispute resolution)
- After 90 days, transcriptions auto-deleted; AI evaluations kept long-term
- Raw audio is NEVER stored — only text transcriptions
- Voice consent dialog required on first use; consent timestamped in DB
- Text mode always available as full alternative

### 7.2 AI Quiz Questions
**Decision: Auto-live, no manager gate**
- AI generates questions from knowledge base content — they go live immediately
- Managers CAN edit, add, or disable questions at any time
- Low-performing questions (high miss rates) are auto-flagged for review
- Keeps rollouts fast; avoids the manager bottleneck

### 7.3 Evaluation Transparency
**Decision: Separate views + manager private notes**
- Students see their own empowering feedback (strengths-first, growth-oriented)
- Managers see a separate detailed assessment (scores, gaps, actionable recommendations)
- Managers can add private notes that students never see
- **Critical guardrail**: Student feedback must never contradict manager feedback — less detailed and more encouraging, but directionally consistent

### 7.4 Content Change Handling
**Decision: Never auto-reset completions**
- Completed sections stay completed even when underlying content changes
- System detects changes via MD5 hashes and flags affected sections
- Manager dashboard shows "Content updated" badge on affected sections
- Manager can offer an optional refresh quiz or create a rollout for re-training
- Server's `content_hash_at_completion` stored for audit trail

### 7.5 Data Retention Policy
**Decision: 90-day full retention, then summaries**
- Full chat conversations kept for 90 days
- Full voice transcriptions kept for 90 days (aligned with 7.1)
- After 90 days: only AI-generated summaries + evaluations retained
- Manager-flagged conversations kept indefinitely
- Consistent 90-day lifecycle across all training data types

---

## 8. Risk Mitigation (V1 Blockers)

From the Devil's Advocate analysis, these must be addressed in V1:

| # | Risk | Mitigation |
|---|------|------------|
| 1 | Voice consent legal | Consent dialog + text fallback |
| 2 | AI hallucination in training | Ground all responses in knowledge base content |
| 3 | Allergen misinformation | Allergen questions require dual approval |
| 4 | No text alternative | Voice is NEVER required; text always available |
| 5 | Content sync breaks | MD5 hash detection + manual review gate |
| 6 | Student games the system | Quiz randomization + voice evaluation |
| 7 | RLS data leaks | Test that staff can't see other staff's evaluations |
| 8 | Manager overload | 30-second dashboard design, AI summaries |
| 9 | Rate limiting | Per-user AI call limits (already in place) |
| 10 | Connection drops mid-quiz | Auto-save every answer, resume capability |

---

## 9. Cost Projections

For 1 restaurant with ~20 active servers training:

| Component | Monthly Cost |
|-----------|-------------|
| OpenAI text (gpt-4o-mini) | ~$45 |
| OpenAI voice (realtime) | ~$60 |
| OpenAI embeddings | ~$4 |
| Supabase (within existing plan) | $0 |
| **Total** | **~$109/month** |

This assumes ~15 AI interactions per server per week during active training periods. Cost drops significantly after initial training wave.

---

## 10. Phased Delivery Plan (Preview)

This will become the detailed master plan after you approve this overview:

| Phase | Scope | Key Deliverables |
|-------|-------|-----------------|
| **Phase 1: Foundation** | Database + basic UI | 12 tables, course listing page, enrollment |
| **Phase 2: Learning** | AI sessions + chat | Learning session page, persistent chat, AI teacher prompts |
| **Phase 3: Assessment** | Quizzes + evaluation | Quiz page, MC + voice questions, scoring, dual feedback |
| **Phase 4: Management** | Dashboard + rollouts | Manager dashboard, rollout wizard, team insights |

Each phase builds on the previous and is independently testable.

---

## 11. What This Reuses vs. What's New

### Reuses Existing (No Changes)
- WebRTC voice pipeline (`use-realtime-webrtc.ts`)
- Supabase auth + RLS patterns
- shadcn/ui component library
- AppShell layout with sidebar
- Product tables as content sources
- `ai_prompts` table pattern for prompt management

### Extends Existing (Modifications)
- `constants.ts` — Add Training nav item
- `App.tsx` — Add ~6 new routes
- `ask` edge function — Add training domain
- `realtime-session` — Add training context
- `auth.ts` types — Add training permissions

### Entirely New
- 12 database tables + RLS + indexes
- 2 new edge functions
- 5 new pages
- ~15 new components
- ~8 new hooks
- AI prompt templates for teacher/evaluator/quiz-generator
- Manager dashboard with AI insights

---

## Next Steps

Once you approve this overview (or request changes), I'll create the **detailed master plan** with:
- Exact file paths and code changes per phase
- Migration SQL for all 12 tables
- Edge function specifications
- Component hierarchy and props
- Hook interfaces
- Testing strategy per phase
- Estimated implementation order

**Please review and let me know:**
1. Does this overall vision match what you had in mind?
2. Your decisions on the 5 questions in Section 7
3. Anything you'd add, remove, or change

