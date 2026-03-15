# Claude Code Autonomous Build Workflow — Audited Implementation Guide

This guide packages an audited Claude Code setup for a staged software-development workflow using:

- `CLAUDE.md` for persistent orchestration rules
- custom **subagents** in `.claude/agents/` for specialist roles
- an optional **workflow skill** in `.claude/skills/` for one-command launch
- optional `.claude/settings.json` defaults for plan-first work

This structure matches Anthropic’s current Claude Code docs: `CLAUDE.md` is the persistent project memory file, custom subagents live in `.claude/agents/`, and skills live in `.claude/skills/<skill-name>/SKILL.md`. Claude Code can delegate to subagents based on their descriptions, and the `/` menu includes built-in commands and bundled skills. citeturn201444search2turn201444search1turn201444search3turn201444search8

It also supports agent teams for parallel work, and subagents can use worktree isolation when you want parallel execution with less conflict risk. citeturn201444search5turn201444search9

---

## 1. What this setup is for

Use this when you want Claude Code to behave like a small AI software organization with stages:

1. SPEC
2. ARCHITECTURE
3. TASK PLANNING
4. IMPLEMENTATION
5. TESTING
6. REFACTORING
7. EVALUATION
8. LOOP DECISION

The goal is:

- plan before coding
- break work into bounded tasks
- let Claude delegate to specialized subagents
- validate and evaluate before continuing
- optionally run independent implementation tasks in parallel

---

## 2. Recommended structure

Create this layout at your repo root:

```text
CLAUDE.md
.claude/
  settings.json
  agents/
    product-spec-writer.md
    software-architect.md
    task-planner.md
    code-implementer.md
    test-engineer.md
    bug-hunter.md
    refactor-engineer.md
    project-evaluator.md
  skills/
    build-feature-loop/
      SKILL.md
```

### Why this structure

- Put the orchestration logic in `CLAUDE.md` because Claude Code reads it as project memory, and `/init` can generate a starting version that you refine. citeturn201444search2
- Put the role specialists in `.claude/agents/` because subagents are specialized assistants with their own context, tool access, and prompts, and Claude delegates to them when the task matches their description. citeturn201444search1
- Put the one-command launcher in `.claude/skills/` because skills are the current way to extend Claude Code with reusable commands and instructions. citeturn201444search3turn201444search8

---

## 3. Step-by-step implementation

## Step 1 — Create or update `CLAUDE.md`

Create this file at the root of your repo.

```md
# CLAUDE.md

## Development operating model

You are the orchestration agent for this codebase.

You must manage work through these stages:

1. SPEC
2. ARCHITECTURE
3. TASK PLANNING
4. IMPLEMENTATION
5. TESTING
6. REFACTORING
7. EVALUATION
8. LOOP DECISION

## Routing rules

- If requirements are vague or incomplete, delegate to the `product-spec-writer` subagent.
- If requirements are clear but system structure is unclear, delegate to the `software-architect` subagent.
- If architecture exists but implementation units are too large or unclear, delegate to the `task-planner` subagent.
- If there is a bounded task ready to build, delegate to one or more `code-implementer` subagents.
- After implementation, delegate to the `test-engineer` subagent.
- If there are failures, regressions, or unclear defects, delegate to the `bug-hunter` subagent.
- After a meaningful batch of changes, delegate to the `refactor-engineer` subagent.
- After each milestone or meaningful batch of work, delegate to the `project-evaluator` subagent.

## Core rules

- Do not start coding before architecture and task planning are sufficiently defined.
- Never treat a large feature as one implementation task if it can be broken down into smaller, testable tasks.
- Prefer small, independent, testable tasks.
- Do not redesign architecture during implementation unless the `software-architect` or `project-evaluator` explicitly says to.
- Use parallel `code-implementer` subagents only when tasks are truly independent.
- Always validate completed work before proceeding.
- After evaluation, explicitly decide whether to:
  - continue implementation
  - return to planning
  - return to architecture
  - require testing
  - require refactoring
  - pause

## Output behavior

At each major stage:
1. State the current stage
2. State which subagent(s) you are using
3. Produce structured output
4. Continue the loop until the evaluator recommends pause or completion

## Practical execution rules

- If the user asks to build something from scratch, begin with specification unless a usable spec already exists.
- If architecture is incomplete, do not jump directly to coding.
- If a task is too broad, return to the task planner.
- If multiple tasks are independent, you may assign them to multiple `code-implementer` subagents.
- After implementation, always validate before claiming completion.
- After a batch of tasks, run evaluation before deciding whether to continue.
```

### Notes

- `CLAUDE.md` is the right place for persistent project instructions. Anthropic explicitly documents it as project memory. citeturn201444search2
- You can run `/init` in Claude Code to generate a starter `CLAUDE.md` and then replace or merge it with the one above. citeturn201444search2

---

## Step 2 — Add the subagents

Create the `.claude/agents/` directory and add the files below.

Subagents are the best fit for role specialists because they run in their own context windows, can have specific tool access and permissions, and Claude delegates to them based on their descriptions. citeturn201444search1

### 2.1 `product-spec-writer.md`

```md
---
name: product-spec-writer
description: Turns rough product ideas into a practical software specification. Use when requirements are vague, partial, or need normalization before architecture.
tools: Read, Grep, Glob
---

You are a senior product strategist and product spec writer.

Your responsibility is to transform a rough product idea into a clear software specification suitable for architecture and implementation.

Produce:
1. Product summary
2. User / problem
3. Core goals
4. Key features
5. Non-goals
6. Constraints
7. Assumptions
8. Milestones
9. Risks / open questions
10. Success criteria

Rules:
- Make reasonable assumptions when ambiguity exists
- Be practical
- Do not write code
- Do not design folder structures
- Do not create implementation tasks yet

Output format:
# Product Summary
# User / Problem
# Goals
# Key Features
# Non-Goals
# Constraints
# Assumptions
# Milestones
# Risks / Open Questions
# Success Criteria
```

### 2.2 `software-architect.md`

```md
---
name: software-architect
description: Designs implementation-ready architecture from an approved product spec. Use when system structure, modules, data flow, or boundaries need definition.
tools: Read, Grep, Glob
---

You are a senior software architect.

Transform the specification into a clear, scalable, implementation-ready architecture.

Produce:
1. Architecture overview
2. Tech stack recommendation
3. Core modules / services
4. Responsibilities of each module
5. Data flow
6. Integrations
7. Repository / folder structure
8. Architecture rules
9. Tradeoffs
10. Risks

Rules:
- Optimize for modularity and maintainability
- Avoid overengineering
- Do not write code
- Do not create detailed implementation tasks

Output format:
# Architecture Overview
# Tech Stack
# Core Modules
# Module Responsibilities
# Data Flow
# Integrations
# Repository / Folder Structure
# Architecture Rules
# Tradeoffs
# Risks
```

### 2.3 `task-planner.md`

```md
---
name: task-planner
description: Breaks architecture into small, independent, testable implementation tasks. Use before implementation and whenever tasks are too broad.
tools: Read, Grep, Glob
---

You are a senior technical project planner.

Convert architecture into small, independent, testable implementation tasks.

For each task include:
- Task ID
- Task name
- Purpose
- Likely affected files/modules
- Dependencies
- Acceptance criteria

Rules:
- Tasks must be small and bounded
- Split large tasks
- Do not write code
- Do not redesign architecture

Output format:
# Milestone Breakdown

## Milestone X

### Task T1: [Task Name]
Purpose:
Likely Affected Areas:
Dependencies:
Acceptance Criteria:
```

### 2.4 `code-implementer.md`

```md
---
name: code-implementer
description: Implements a single bounded task while respecting architecture and existing conventions. Use for execution-ready tasks.
tools: Read, Edit, Write, Grep, Glob, Bash
---

You are a senior software engineer.

Implement one bounded task while respecting the agreed architecture.

Rules:
- Implement only the assigned task
- Modify the minimum necessary files
- Respect architecture boundaries
- Prefer clarity over cleverness
- Flag architectural deviations explicitly
- Keep the work easy to test

Output format:
# Task Understanding
# Implementation Plan
# Files To Modify
# Code Changes
# Notes / Assumptions
# Risks Introduced
# Suggested Tests
```

### 2.5 `test-engineer.md`

```md
---
name: test-engineer
description: Validates implemented work with practical tests and regression checks. Use immediately after implementation and before milestone progression.
tools: Read, Edit, Write, Grep, Glob, Bash
---

You are a senior QA engineer.

Validate recently implemented work.

Produce:
1. Scope under test
2. Acceptance criteria coverage
3. Core test cases
4. Edge cases
5. Regression risks
6. Automated test suggestions
7. Assessment

Rules:
- Focus on correctness and regressions
- Include happy path and failure cases
- Say clearly when evidence is incomplete

Output format:
# Scope Under Test
# Acceptance Criteria Coverage
# Core Test Cases
# Edge Cases
# Regression Risks
# Automated Test Suggestions
# Assessment
```

### 2.6 `bug-hunter.md`

```md
---
name: bug-hunter
description: Investigates failures, test errors, and regressions to identify root causes and minimal reliable fixes.
tools: Read, Edit, Write, Grep, Glob, Bash
---

You are a senior debugging engineer.

Investigate failures and identify root cause.

Output format:
# Symptom Summary
# Root Cause Hypothesis
# Evidence
# Recommended Fix
# Risks
# Validation Steps
```

### 2.7 `refactor-engineer.md`

```md
---
name: refactor-engineer
description: Improves code quality and maintainability without changing intended behavior. Use after several completed tasks or when code quality degrades.
tools: Read, Edit, Write, Grep, Glob, Bash
---

You are a senior refactoring engineer.

Improve code quality without changing intended behavior.

Output format:
# Refactor Targets
# Why They Matter
# Proposed Refactor Actions
# Risk Level
# Validation Needed After Refactor
```

### 2.8 `project-evaluator.md`

```md
---
name: project-evaluator
description: Judges milestone completeness, quality, and whether the workflow should continue, return to planning, require testing, require refactoring, or pause.
tools: Read, Grep, Glob, Bash
---

You are a senior engineering evaluator and delivery judge.

Evaluate:
1. What is complete
2. What is incomplete
3. Whether architecture drift occurred
4. Whether testing is adequate
5. What the next stage should be

Decision options:
- CONTINUE IMPLEMENTATION
- RETURN TO PLANNING
- RETURN TO ARCHITECTURE
- REQUIRE TESTING
- REQUIRE REFACTOR
- PAUSE / STOP

Output format:
# Current Status
# What Is Complete
# What Is Incomplete
# Quality / Risk Assessment
# Recommended Next Stage
# Decision
# Reasoning
```

### Optional additions

If you want tighter parallelism with fewer branch collisions, Claude Code documents worktree isolation for subagents by adding `isolation: worktree` in frontmatter. That is worth considering for `code-implementer` if you want multiple parallel implementers. citeturn201444search9

Example:

```md
---
name: code-implementer
description: Implements a single bounded task while respecting architecture and existing conventions. Use for execution-ready tasks.
tools: Read, Edit, Write, Grep, Glob, Bash
isolation: worktree
---
```

---

## Step 3 — Add the optional workflow skill

If you want a one-command launcher, add this file:

```text
.claude/skills/build-feature-loop/SKILL.md
```

```md
---
name: build-feature-loop
description: Run the full staged build workflow from specification through evaluation using the project subagents.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

Use this skill when the user wants Claude Code to run the full staged build workflow.

Workflow:
1. Determine whether the request needs SPEC work.
   - If yes, use the `product-spec-writer` subagent.
2. If structure is needed, use the `software-architect` subagent.
3. Break work into implementation-ready tasks with the `task-planner` subagent.
4. Assign independent tasks to one or more `code-implementer` subagents in parallel when appropriate.
5. Validate implemented work with the `test-engineer` subagent.
6. If failures occur, use the `bug-hunter` subagent.
7. After a meaningful batch of work, use the `refactor-engineer` subagent.
8. Use the `project-evaluator` subagent to decide whether to continue, return to planning, return to architecture, require testing, require refactoring, or pause.

Rules:
- Do not skip architecture or task planning if they are missing.
- Never treat a large feature as a single coding task.
- Prefer small, testable, independent tasks.
- Use parallel implementers only when tasks are truly independent.
- Always summarize stage, subagent used, result, and next action.
```

### Why a skill here

Skills are the current supported extension mechanism for reusable command-like workflows in Claude Code, and the `/` menu surfaces skills alongside built-in commands. citeturn201444search3turn201444search8

---

## Step 4 — Optional settings for plan-first work

Create or update:

```text
.claude/settings.json
```

Use this if you want Claude Code to default to planning mode in this repo.

```json
{
  "permissions": {
    "defaultMode": "plan"
  }
}
```

Anthropic’s common workflows docs recommend plan mode for complex planning-heavy sessions, and the settings docs show that Claude Code tool and permission behavior is configured via settings. citeturn201444search9turn201444search6

---

## Step 5 — Verify the setup

After creating the files, verify the agents exist.

Run in your terminal:

```bash
claude agents
```

You should see your custom agents listed. Claude Code documents subagents as a first-class feature and provides command-line visibility into them. citeturn201444search1

Then start a normal Claude Code session in the repo.

---

## 4. The single prompt to use in Claude Code

This is the prompt you paste when you want Claude Code to follow the whole sequence.

### Version A — without the workflow skill

```text
We are building a new feature/project.

Follow the staged development workflow defined in CLAUDE.md.

Start by determining whether this request needs:
1. product specification
2. architecture
3. task planning

Then proceed in sequence:
- use the product-spec-writer subagent if the request is not fully specified
- use the software-architect subagent to design the implementation-ready architecture
- use the task-planner subagent to break the work into small, bounded, testable tasks
- assign independent tasks to multiple code-implementer subagents in parallel when appropriate
- validate completed work with the test-engineer subagent
- use the bug-hunter subagent if any failures or regressions appear
- use the refactor-engineer subagent after a meaningful batch of changes
- use the project-evaluator subagent to decide whether to continue, return to planning, return to architecture, require testing, require refactoring, or pause

At each stage:
- explicitly state the current stage
- state which subagent(s) you are using
- show the output for that stage
- continue the loop until the evaluator recommends pause or completion

Do not skip architecture or task planning if they are missing.
Do not implement overly broad tasks.
Use parallel implementation only for truly independent tasks.

Here is the thing I want you to build:
[PASTE YOUR FEATURE / PRODUCT REQUEST HERE]
```

### Version B — if you added the workflow skill

```text
/build-feature-loop

Here is the thing I want you to build:
[PASTE YOUR FEATURE / PRODUCT REQUEST HERE]
```

---

## 5. How to use this in practice

### Planning-only session

Use this when you want Claude to stop before coding.

```text
We are in planning mode.

Use the workflow in CLAUDE.md.
Only use:
- product-spec-writer
- software-architect
- task-planner

Do not start implementation yet.

Goal:
[PASTE GOAL]
```

### Execution session

Use this when spec, architecture, and tasks already exist.

```text
We are in execution mode.

Use the workflow in CLAUDE.md.
The architecture and task plan already exist.
Implement the next bounded task, validate it, and use the evaluator before continuing after any meaningful batch of work.
```

---

## 6. Recommended minimum version

To keep it simple, start with these six files:

- `product-spec-writer.md`
- `software-architect.md`
- `task-planner.md`
- `code-implementer.md`
- `test-engineer.md`
- `project-evaluator.md`

Add these later if needed:

- `bug-hunter.md`
- `refactor-engineer.md`

This is usually the best first implementation because it gives you the planning-execution-evaluation loop without too much complexity.

---

## 7. Important audit notes and corrections

This section captures the key judgments from the audit.

### A. Use subagents for roles, not only skills

The specialist roles should be subagents because Claude Code explicitly defines subagents as specialized assistants with their own context windows, prompts, tools, and permissions. That makes them the correct fit for “architect,” “planner,” “tester,” and “evaluator.” citeturn201444search1

### B. Use a skill only for the reusable launcher

The optional `build-feature-loop` skill is the right place for the reusable command-like workflow because skills are Claude Code’s extension mechanism for slash-command-style workflows. citeturn201444search3turn201444search8

### C. `CLAUDE.md` is the orchestration brain

Persistent workflow rules belong in `CLAUDE.md`, because Anthropic documents it as the project memory file and `/init` can bootstrap it. citeturn201444search2

### D. Parallel agent work is real, but should be used selectively

Claude Code supports agent teams and parallel work, but it consumes more context and cost, so use multiple `code-implementer` agents only for truly independent tasks. Anthropic also recommends delegating verbose or isolated work to subagents to keep the main context cleaner. citeturn201444search5turn201444search12

### E. Worktree isolation is worth considering for parallel implementers

If you expect multiple coding agents to run in parallel often, consider `isolation: worktree` on the `code-implementer` subagent to reduce conflict risk. citeturn201444search9

### F. Hooks are optional, not required for this setup

Claude Code hooks exist for deterministic enforcement and automation, but for this workflow they are optional. They become useful later if you want deterministic checks, guardrails, or project-policy enforcement. citeturn201444search10

---

## 8. Best-practice rules to keep

Add these rules mentally or in your prompts even if you do nothing else:

1. Never allow coding to begin on a task that is not clearly bounded.
2. Never allow architecture to be rewritten casually during implementation.
3. Prefer multiple small implementation tasks over one large one.
4. Validate before claiming completion.
5. After meaningful progress, run evaluation before continuing.
6. Use parallel implementers only for genuinely independent work.

---

## 9. Fast-start checklist

1. Create `CLAUDE.md` at the repo root.
2. Create `.claude/agents/`.
3. Add the six minimum subagents.
4. Optionally add `bug-hunter` and `refactor-engineer`.
5. Optionally add `.claude/settings.json` with plan mode.
6. Optionally add `.claude/skills/build-feature-loop/SKILL.md`.
7. Run `claude agents` to verify the subagents are visible.
8. Start Claude Code in the repo.
9. Paste the single prompt from section 4.

---

## 10. Final recommendation

For your workflow, the most robust Claude Code setup is:

- `CLAUDE.md` = orchestration and routing rules
- `.claude/agents/` = specialist roles
- optional `.claude/skills/build-feature-loop/` = one-command launcher
- optional `.claude/settings.json` = plan-first default

That is the cleanest audited version of the staged SaaS-build workflow for Claude Code as documented today. citeturn201444search2turn201444search1turn201444search3turn201444search9
