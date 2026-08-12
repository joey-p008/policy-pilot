---
name: boot-program
description: Restarts Policy-Pilot frontend (Vite) and backend (NestJS), verifies Docker Postgres/Redis plus HTTP health, then reports clickable local URLs. Use when the user asks to boot, restart, start, or bring up the application, frontend, or backend.
---

# Boot Program

Restart Policy-Pilot locally, wait until it is healthy, then print frontend and backend URLs. Do not run prisma migrate, seed, or policy ingest. Do not add npm scripts or change Nest/Vite config.

Run all commands from the repository root unless a step says otherwise. Start long-running servers in background shells (`block_until_ms: 0`). Stop and report the failure if any step fails.

## Procedure

### 1. Env files

- If `apps/backend/.env` is missing, copy `apps/backend/.env.example` to `apps/backend/.env`.
- If `OPENAI_API_KEY` is empty in `apps/backend/.env`, continue but warn that RAG/chat will fail.
- If `apps/frontend/.env` is missing, copy `apps/frontend/.env.example` to `apps/frontend/.env`.
- Do not change `VITE_HITL_USE_MOCK_DATA`.

### 2. Infra

```bash
docker compose up -d
```

Wait until `policy-pilot-postgres` and `policy-pilot-redis` are healthy (retry about 30s):

```bash
docker compose ps
```

If Docker is not running, stop and tell the user to start Docker Desktop.

### 3. Free ports

Send SIGTERM to anything listening on 3000, 5173, or 5174. Ignore empty output. Use `kill -9` only if a process is still listening after a short wait.

```bash
lsof -ti tcp:3000,tcp:5173,tcp:5174 | xargs kill
```

### 4. Backend

Rebuild, then start in a background shell. npm workspace scripts run with cwd `apps/backend`, which is required so `ConfigModule` loads `.env`.

```bash
npm --workspace=@policy-pilot/backend run build
npm --workspace=@policy-pilot/backend start
```

Poll until JSON `status` is `ok`, or fail after about 45s with the backend log tail:

```bash
curl -sf http://127.0.0.1:3000/health
```

Expected: `{ "status": "ok", "service": "@policy-pilot/backend", ... }`.

### 5. Frontend

Start in a background shell:

```bash
npm --workspace=@policy-pilot/frontend run dev
```

Read the Vite log for the bound URL (`http://localhost:5173` or `http://localhost:5174` if 5173 is taken). Poll that origin until HTTP 200, or fail after about 30s with the Vite log tail.

### 6. Report URLs

Print markdown links using the actual Vite port:

```markdown
Frontend: http://localhost:5173
Backend:  http://localhost:3000
Health:   http://localhost:3000/health
```
