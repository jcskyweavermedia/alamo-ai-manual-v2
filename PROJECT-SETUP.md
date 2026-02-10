# Alamo Prime AI Manual - Project Setup

## 🔗 Connections & Services

### GitHub Repository
- **URL**: https://github.com/jcskyweavermedia/alamo-ai-manual-v2
- **Owner**: jcskyweavermedia
- **Branch**: main (default)
- **Status**: ✅ Connected

### Supabase Cloud Instance
- **Project ID**: `nxeorbwqsovybfttemrw`
- **Project URL**: https://nxeorbwqsovybfttemrw.supabase.co
- **Region**: US (default)
- **Status**: ✅ Connected via Supabase CLI
- **CLI Link**: Linked in `supabase/.temp/project-ref`

### OpenAI API
- **Model**: gpt-4o-mini
- **Usage**: AI assistant (ask function), embeddings (text-embedding-3-small)
- **Config**: API key stored as Supabase secret `OPENAI_API_KEY`
- **Status**: ✅ Configured in Edge Functions

---

## 🗄️ Database Status

### Migrations Applied
- ✅ 11 schema migrations (tables, RLS, functions, triggers)
- ✅ 1 seed migration (34 manual_sections structure rows)
- ✅ 2 content migrations (30 sections EN+ES content)
- ✅ 1 icon migration (34 section icons)

**Total**: 15 migrations

### Content Status
- **Manual Sections**: 34 rows (6 top-level + 4 categories + 24 children)
- **Content**: 30/30 sections with EN+ES content populated
- **Vector Embeddings**: ⚠️ Not yet generated (Phase 6 Step 6.3 pending)
- **Demo Group**: 1 group ("Demo Restaurant", slug: `demo-restaurant`)
- **Role Policies**: 3 policies (staff, manager, admin)

---

## 🚀 Edge Functions Deployed

All 6 functions deployed to Supabase:

1. **ask** - Text-based AI assistant (OpenAI gpt-4o-mini)
2. **transcribe** - Audio transcription (OpenAI Whisper)
3. **embed-sections** - Generate vector embeddings (OpenAI text-embedding-3-small)
4. **realtime-search** - Hybrid search with RRF ranking
5. **realtime-voice** - WebRTC voice interface
6. **realtime-session** - Session management

**Auth**: All functions have `verify_jwt = false` in config.toml

---

## 📋 Environment Configuration

### Local (.env)
```
VITE_SUPABASE_PROJECT_ID="nxeorbwqsovybfttemrw"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_eEPfgN9bd5jWRJ-ye1MnMw_p6V92UDs"
VITE_SUPABASE_URL="https://nxeorbwqsovybfttemrw.supabase.co"
```

### Supabase Secrets (Cloud)
- `OPENAI_API_KEY` - Set via `supabase secrets set`

### Auto-Injected Secrets (Edge Functions)
Supabase automatically injects these into all edge functions:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**⚠️ Do NOT manually set these as secrets** - they're auto-provided by Supabase.

---

## 👥 User Accounts

### Your Account
- **Email**: juancarlosmarchan@skyweavermedia.com
- **Name**: Juan Marchan
- **Role**: admin (upgraded from staff)
- **Group**: Demo Restaurant
- **Limits**: 100 daily / 2000 monthly AI questions, voice enabled

### Join Link
New users can sign up via: http://localhost:8080/join/demo-restaurant

---

## 🛠️ CLI Tools

### Supabase CLI
- **Installed**: ✅ npx supabase
- **Linked**: ✅ Project nxeorbwqsovybfttemrw
- **Commands**:
  - `npx supabase db push` - Push new migrations
  - `npx supabase functions deploy` - Deploy edge functions
  - `npx supabase secrets set KEY=value` - Set secrets

### GitHub CLI (gh)
- **Status**: Available for PR/issue management
- **Commands**: `gh pr create`, `gh pr view`, `gh issue create`

### Supabase MCP Server (Claude Code Integration)
- **Status**: ✅ Connected and authenticated
- **Scope**: User-level (available across all projects)
- **Transport**: HTTP (hosted at mcp.supabase.com)
- **Project**: nxeorbwqsovybfttemrw
- **Mode**: Read-only (safety enabled)
- **Authentication**: OAuth 2.1 (auto-refresh, stored in system keychain)

**Setup Command** (one-time):
```bash
claude mcp add --scope user --transport http supabase \
  "https://mcp.supabase.com/mcp?project_ref=nxeorbwqsovybfttemrw&read_only=true"
```

**Re-authenticate** (if needed):
```bash
/mcp
```

**Available Tools** (within Claude Code):
- `get_logs` - Retrieve logs by service (edge-function, postgres, api, auth, storage, realtime)
- `get_advisors` - Get security/performance advisory notices
- `search_docs` - Search Supabase documentation
- `list_tables` - List database tables by schema
- `execute_sql` - Run SQL queries (read-only mode)
- `apply_migration` - Apply database migrations
- `generate_typescript_types` - Generate TypeScript types from schema
- Plus: Edge Functions, Branches, and Project management tools

**Benefits**:
- Claude can directly inspect edge function logs for debugging
- Security and performance advisories accessible during development
- Database schema inspection without context switching
- Documentation search integrated into conversation

---

## 📦 Tech Stack

### Frontend
- **Framework**: Vite + React 18 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **State**: React Query (TanStack Query)
- **Routing**: React Router v6
- **Icons**: Lucide React

### Backend
- **Database**: PostgreSQL 15 (Supabase)
- **Auth**: Supabase Auth (magic link)
- **Storage**: Supabase Storage (future use)
- **Edge Functions**: Deno runtime
- **Search**:
  - Full-text search (tsvector, GIN index)
  - Vector similarity (pgvector, HNSW index, 1536 dimensions)
  - Hybrid ranking (Reciprocal Rank Fusion)

### AI/ML
- **LLM**: OpenAI gpt-4o-mini (text assistant)
- **Embeddings**: OpenAI text-embedding-3-small (1536d)
- **Transcription**: OpenAI Whisper (audio to text)
- **Voice**: OpenAI Realtime API (future WebRTC integration)

---

## 🔐 Security & Access

### Row Level Security (RLS)
- ✅ Enabled on all tables
- ✅ Policies for user-scoped access (group memberships)
- ✅ Service role key bypasses RLS (admin queries only)

### API Keys
- **Anon Key**: Safe for browser (RLS enforced)
- **Service Role Key**: ⚠️ Never expose to browser (bypasses RLS)

---

## 📝 Development Workflow

### Local Development
```bash
cd "C:\Users\juanc\CascadeProjects\Restaurant App\alamo-ai-manual-v2"
npm run dev
# Dev server: http://localhost:8080
```

### Database Changes
```bash
# Create new migration
npx supabase migration new migration_name

# Push to cloud
npx supabase db push
```

### Edge Function Deployment
```bash
# Deploy single function
npx supabase functions deploy ask

# Deploy all functions
npx supabase functions deploy
```

### Git Workflow
```bash
git add .
git commit -m "Your message"
git push origin main
```

---

## ⚠️ Known Limitations

1. **Bookmarks**: Removed (not needed for this project)
2. **Vector Embeddings**: Not yet generated for content (Phase 6 Step 6.3 pending)
3. **Group Name**: Still "Demo Restaurant" - should be renamed to "Alamo Prime" (Phase 6 Step 6.1)
4. **Original Project**: Fully decoupled from Lovable (no dependency)

---

## 🎯 Next Steps (Phase 6 Remaining)

- [ ] 6.1: Rename "Demo Restaurant" group to "Alamo Prime"
- [ ] 6.3: Generate vector embeddings for all 30 content sections
- [ ] Phase 7: Full testing checklist
- [ ] Phase 8: Final commit and push to GitHub

---

## 📞 Support

- **GitHub Issues**: https://github.com/jcskyweavermedia/alamo-ai-manual-v2/issues
- **Supabase Dashboard**: https://supabase.com/dashboard/project/nxeorbwqsovybfttemrw

---

*Last Updated: 2026-02-09*
*Project: Alamo Prime AI Manual v2*
*Owner: Juan Carlos Marchan / Skyweaver Media*
