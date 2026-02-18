---
allowed-tools: Bash(netstat:*), Bash(taskkill:*), Bash(npm:*), Bash(curl:*), Bash(sleep:*), Bash(tasklist:*)
description: Kill stale servers, start Vite dev server, verify the app is live on localhost:8080
---

# /startup — Spin up a fresh local instance of Alamo Prime AI Manual

One-shot command: kill stale processes, start the Vite dev server, verify the app is responding.

## Environment

| Detail | Value |
|--------|-------|
| Platform | Windows (PowerShell / Git Bash) |
| Frontend | Vite + React on port **8080** |
| Backend | Supabase Cloud (no local API server) |
| Package manager | npm |
| Working directory | `C:\Users\juanc\CascadeProjects\Restaurant App\alamo-ai-manual-v2` |

## Your Task

### Step 1 — Check current state

Check if anything is already listening on port 8080 and if any node processes are running:

```bash
netstat -ano | findstr ":8080" | findstr "LISTEN"
tasklist | findstr /i "node"
```

### Step 2 — Kill stale dev servers (if any)

If port 8080 is occupied or orphaned node processes exist from previous sessions, kill them:

```bash
# On Windows, find PID on port 8080 and kill it
for /f "tokens=5" %a in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTEN"') do taskkill /PID %a /F
```

Also kill any orphaned node processes from this project:

```bash
taskkill /F /IM node.exe 2>nul
```

Wait 2 seconds for the port to free up.

### Step 3 — Start the Vite dev server

Start the dev server in the background from the project directory:

```bash
cd "C:\Users\juanc\CascadeProjects\Restaurant App\alamo-ai-manual-v2" && npm run dev
```

Run this as a **background task** so it doesn't block the conversation.

### Step 4 — Wait for server to be ready

Wait 5 seconds for Vite to compile, then poll until it responds (max ~15 seconds):

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080
```

Expected: HTTP **200**. If it fails after 15 seconds, read the background task output and report the error.

### Step 5 — Verify and report

Read the background task output to confirm Vite started cleanly (look for "VITE ready" and the local URL).

Tell the user:
- Dev server running on **http://localhost:8080**
- Network URL (if shown in Vite output)
- Any warnings or errors from the startup log
- Ready to use — open the URL in a browser
