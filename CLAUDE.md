# CLAUDE.md — Alamo Prime AI Manual

## Project context

Bilingual (EN/ES) restaurant operations manual with AI assistant for Alamo Prime steakhouse.
Mobile-first React app with Supabase backend, OpenAI integration, and hybrid search (FTS + vector embeddings).

## Key commands

- **Dev server**: `npm run dev` (port 8080)
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Typecheck**: `npx tsc --noEmit`
- **Test**: `npm test`
- **DB push**: `echo y | npx supabase db push`
- **Deploy functions**: `npx supabase functions deploy --no-verify-jwt`
- **Git**: `git push origin main`

## Project-specific rules

- Always deploy edge functions with `--no-verify-jwt` (auth is handled internally).
- Use `extensions.gen_random_uuid()` (not `gen_random_uuid()`) — pgcrypto lives in `extensions` schema.
- Supabase JS client `.rpc()` returns a `PostgrestFilterBuilder` (thenable), NOT a native Promise — use `try/catch`, not `.catch()`.
- Always check edge function logs before guessing at error causes.
- RLS is enforced for anon key; service role key bypasses RLS (never expose to browser).
- New format keys: `sb_publishable_...` (publishable), `sb_secret_...` (service role) — not JWT format.

## Settings
auto-commit: yes
