# AGENTS.md — Policy-Pilot Repository Guide

## Overview

Policy-Pilot is a production-grade, AI-powered system that processes self-service access requests using RAG over policy PDFs and PostgreSQL entitlement registries, delivering structured recommendations to a React Human-in-the-Loop (HITL) dashboard.

## Tech Stack Baseline

- Runtime: TypeScript on Node.js 22+
- Backend: NestJS, Zod DTO validation, PostgreSQL + pgvector, BullMQ async queue
- Frontend: React + Vite + TanStack React Query + Tailwind CSS
- Testing & Evals: Jest, custom golden dataset evaluation runner

## Core Development Loop (ECC Loop)

1. Explore: Before writing code, read existing files, verify database schemas, and confirm architectural boundaries.
2. Code: Implement modular, type-safe code strictly adhering to `.cursor/rules/`. Never use placeholders or `// rest of code unchanged`.
3. Commit & Verify: Run formatting, linting, type-checks, and tests (`npm run format && npm run lint && npm run type-check && npm test`) before declaring a task complete.

## Non-Negotiable System Guardrails

- LLM Suggests, Human Approves: The LLM produces recommendations (APPROVE/DENY/ESCALATE). It MUST NEVER execute access grants or revocations directly.
- PII Masking: Scrub or mask `employee_id` and `cost_center` in all logs and telemetry traces.
- Idempotency & Audit: All incoming webhooks and access execution events must use idempotency tables and append-only audit logging in Postgres.
