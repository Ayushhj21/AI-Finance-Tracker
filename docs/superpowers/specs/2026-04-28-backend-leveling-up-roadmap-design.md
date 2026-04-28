# AIFT Backend Leveling-Up Roadmap

- **Date:** 2026-04-28
- **Status:** Draft, awaiting user review
- **Owner:** Ayush Jain
- **Project:** AIFT (`~/Desktop/AIFT`) — personal MERN finance tracker, separate from any work repos

## 1. Goal

Turn AIFT into a publicly-deployed, production-leaning backend that doubles as a hands-on curriculum for the owner to learn modern backend infrastructure. Secondary outcome: a portfolio piece a senior engineer would respect.

The frontend is intentionally out of scope — it was AI-built and is "good enough." All learning effort goes into the backend and adjacent infra.

**How to use this document:** This is a roadmap, not a single implementation plan. Each phase below will spawn its own implementation plan when we start it. The spec defines the *order*, *scope*, and *learning goals* per phase, so plans stay aligned and we don't accidentally skip foundational work.

## 2. Non-goals

- Multi-tenancy. Single-user-per-account is fine.
- Real money / payment processing.
- Mobile apps, native clients.
- A "rewrite" — we evolve the existing Express + Mongoose codebase, we don't replace it.
- Replacing React/Vite/Tailwind on the frontend.
- Replacing MongoDB with Postgres just for the sake of it. (Mongo Atlas is fine; we'll touch SQL only if a phase explicitly motivates it.)

## 3. Constraints

| Constraint | Value |
|---|---|
| Time budget | ~1 hr/day weekdays, larger blocks on weekends. ~7-12 hrs/week. |
| Pace | Weekend-warrior, queued backlog. No fixed deadline. |
| Prior experience | Some Docker, has deployed to Vercel/Railway, knows of Redis. |
| Cost ceiling | ~$5-15 / month for AWS during learning. |
| Audience | Self primarily, then senior engineers / interviewers. |

## 4. Approach: deploy first, then layer

Three orderings were considered:

1. **Deploy first, then layer (chosen)** — Get a basic version live in Phase 1, then every subsequent phase improves a real running system. Highest motivation, fastest first dopamine, every concept is grounded in "I can see why this matters."
2. **Build everything locally first, then deploy a polished version** — Cleaner final state but defers the live URL by months and risks loss of momentum.
3. **Topic-by-topic curriculum** (testing → docker → caching → ...) — Cleanest pedagogy but feels like school and decouples concepts from a real running system.

We pick option 1. Tradeoff accepted: the first deployed version will have known rough edges (no rate limiting, no caching, basic logging). Each subsequent phase pays down those edges in a deliberate order.

## 5. Target end state (after all phases)

```
                    ┌──────────────────────┐
                    │   Vercel / Netlify   │  React build + CDN
                    │   (frontend)         │
                    └──────────┬───────────┘
                               │ /api → custom domain
                               ▼
                    ┌──────────────────────┐
                    │   AWS App Runner     │  containerized Express
                    │   + Auto HTTPS       │  with structured logging
                    └──┬────────┬──────────┘
                       │        │
        ┌──────────────┘        └─────────────┐
        ▼                                     ▼
  ┌──────────────┐                    ┌────────────────┐
  │ MongoDB      │                    │ Redis          │
  │ Atlas (M0)   │                    │ Upstash /      │
  │ + transactions│                   │ ElastiCache    │
  └──────────────┘                    └────────┬───────┘
                                               │ BullMQ
                                               ▼
                                       ┌────────────────┐
                                       │ Worker process │
                                       │ (AI, notify,   │
                                       │  scheduled)    │
                                       └────────────────┘

  Side services:
   - S3 (receipts)             - SES (email)
   - CloudWatch Logs           - Sentry (errors)
   - GitHub Actions (CI/CD)    - OpenAPI docs
   - Optional: Kafka (MSK Serverless) for one event flow
```

## 6. Phased backlog

Each phase is sized in "weekends" (~6-10 hours of focused work). With ~7-12 hrs/week available, expect each phase to span 1-2 calendar weeks.

### Phase 0 — Pre-deploy hygiene (1 weekend)

Blocking fixes plus a baseline of secure defaults.

**Tasks:**
- Fix port mismatch: Vite proxy targets `:3001`, backend default is `:5000`. Pick one, document.
- Fix lowercase route imports (`aicontroller.js`, `analyticscontroller.js`) — case-sensitive Linux will reject these.
- Remove leaked logs: `console.log(apiKey, ...)` in `backend/services/aiService.js`, dead `console.log` on line 13.
- Reconcile category enums: `Transactionmodel.js` enum, `aiService.js` AI prompt categories, frontend `TransactionModal.jsx` `CATEGORIES` are all different. Pick one source of truth.
- Add `helmet` middleware.
- Add `morgan` request logging (replace later with `pino`).
- Create `backend/.env.example` and a real top-level `README.md` with setup steps.
- Tighten `.gitignore` (verify no `.env` ever committed).
- Add a `/api/health` deeper check (db connectivity, not just `OK`).

**Learning:** dev/prod parity, Linux case-sensitivity, secrets hygiene, baseline web-security middleware.

### Phase 1 — Get it live (2 weekends)

**Tasks:**
- Write `Dockerfile` and `.dockerignore` for backend; multi-stage build, small image.
- Provision MongoDB Atlas M0 (free), set up IP allowlist, create read/write user.
- Provision AWS App Runner service from the GitHub repo (auto-build from Dockerfile). Inject env vars via App Runner config.
- Move file uploads from Cloudinary to **S3** with pre-signed URL upload pattern (frontend POSTs directly to S3, backend stores key only).
- Frontend → Vercel; configure prod env to point at App Runner URL.
- Custom domain + HTTPS (Route53 or any registrar → CNAME to App Runner; Vercel auto-HTTPS for frontend domain).
- Seed a demo user (`demo@aift.app` / known password) with sample transactions for visitors.
- Document the deploy in `README.md`.

**Learning:** Docker basics for production images, AWS IAM users + access keys, App Runner config, S3 + pre-signed URLs, DNS, env-var hygiene.

### Phase 2 — Backend hardening (3-4 weekends)

**Tasks:**
- **Auth hardening:**
  - Refresh token rotation: revoke previous refresh on every refresh call (single-use refresh tokens).
  - Move tokens to **httpOnly cookies** (`SameSite=lax`, `Secure` in prod).
  - Token blacklist on logout (Redis-backed, TTL = remaining access token TTL).
  - Password reset flow with email link (will use SES once Phase 4 lands; for now, log link to console).
- **Rate limiting:** `express-rate-limit` with Redis store. Stricter limits on `/api/auth/*` (5/min) than general API (100/min). IP-based with optional user-based tier.
- **Input validation:** introduce **Zod** schemas. Wire via shared `validate(schema)` middleware. Replace ad-hoc `if (!field)` checks across all controllers.
- **Centralized error handling:** `AppError` class, `asyncHandler` HOF, single error middleware that formats `{ success, code, message, requestId }` consistently. Map known error types (Zod, Mongoose, JWT) to appropriate status codes.
- **Structured logging:** **`pino`** with `pino-http`. Each request gets a request ID (UUID v7), propagated through logs and returned in response header `X-Request-ID`.
- **Security middleware:** helmet config audit, CORS allowlist (env-driven), `express.json({ limit: '100kb' })`, disable `x-powered-by`.

**Learning:** OWASP-grade auth thinking, schema-driven validation, structured logging, defense in depth.

### Phase 3 — Reliability + performance (2-3 weekends)

**Tasks:**
- Provision **Upstash Redis** (free tier, ~10K commands/day) — defer ElastiCache until cost / scale demands it.
- **Cache analytics endpoints** with cache-aside pattern. Key: `${userId}:analytics:dashboard:${YYYY-MM}`. TTL 5 min. Invalidate on transaction create/update/delete.
- **Cache AI responses** by hash of `(prompt + context)`. TTL 1 day. Avoids redundant Gemini calls + saves cost.
- **Idempotency keys** on `POST /api/transactions`. Header `Idempotency-Key`. Store key → response in Redis for 24h.
- **MongoDB transactions** for the `createTransaction` flow — currently the transaction insert + budget `$inc` are not atomic. Use a Mongo session.
- **Pagination** on `GET /api/transactions` (cursor-based, `?cursor=<lastId>&limit=20`).

**Learning:** caching patterns (cache-aside, TTL, invalidation), idempotency semantics, ACID on Mongo, cursor pagination.

### Phase 4 — Async architecture (3-4 weekends)

**Phase 4a — BullMQ:**
- Run a separate worker container (`backend/worker.js`) wired into App Runner as a second service or a sidecar.
- Move AI categorization to a background job: `POST /api/transactions` enqueues an AI categorize job; result merged on completion via WebSocket/poll.
- Notification fan-out: budget alert / unusual spending / high-value detection move from inline to BullMQ jobs.
- Replace `node-cron` budget sweep with a BullMQ recurring job.
- Add Bull Board (or arena) at `/admin/queues` (basic-auth gated).

**Phase 4b — SES email:**
- Provision SES (sandbox first, request production access).
- Implement password reset email + budget alert email (user opt-in).

**Phase 4c — Kafka (optional, only if still wanted):**
- Provision **AWS MSK Serverless** OR **Redpanda Cloud** (free tier).
- Mirror one event flow (`transaction.created`) through Kafka. Consumer that updates a per-day `dailySpend` materialized collection.
- Document in `README.md` *why* this is dual-purpose with BullMQ — explicitly call out the queue-vs-log distinction.

**Learning:** event-driven architecture, at-least-once delivery, dead-letter queues, retries with backoff, idempotent consumers, Kafka log semantics vs queue semantics.

### Phase 5 — Quality + DevOps (2-3 weekends)

**Tasks:**
- **Test stack:** Jest + Supertest. `mongodb-memory-server` for integration tests. Target ~60% controller coverage.
- **Test types written:**
  - Unit: utility functions (jwt utils, AI prompt builders).
  - Integration: each route file × happy path + 2 error paths.
  - Contract: validate Zod schemas accept/reject realistic payloads.
- **GitHub Actions CI/CD:**
  - On PR: lint → test → docker build (no push).
  - On `main` push: lint → test → docker build/push to ECR → App Runner auto-deploys.
- **OpenAPI/Swagger:** `swagger-jsdoc` + `swagger-ui-express`. Mount at `/api/docs`. Auto-generate from JSDoc comments + Zod schemas (`zod-to-openapi`).
- **API versioning:** introduce `/api/v1/...` prefix. Document deprecation policy.

**Learning:** writing testable code, mocking vs real-deps tradeoff, declarative CI pipelines, contract-first APIs.

### Phase 6 — Observability (2 weekends)

**Tasks:**
- **Sentry** for backend error tracking + frontend errors.
- **CloudWatch Logs Insights** queries — save 3-5 useful queries (errors by route, slow endpoints, failed AI calls).
- **Custom metrics** (CloudWatch embedded metric format):
  - `aift.transactions.created` (count)
  - `aift.ai.gemini.latency_ms` (histogram)
  - `aift.cache.hit_ratio` (gauge)
- `/api/health` (already in Phase 0) + `/api/ready` distinguishing liveness vs readiness.
- **UptimeRobot** (free) hitting `/api/health` every 5 min.

**Learning:** SRE basics, the difference between logs/metrics/traces, what an on-call actually looks at.

### Phase 7 — Stretch / advanced

Not committed to a fixed order. Pick by interest:

- **Terraform** for IaC (App Runner, S3, IAM, Route53 records).
- **WebSockets** (or SSE) — push notifications and AI-job-complete events to the frontend in real time.
- **k6 load testing** + a `LOAD-TEST.md` with results.
- **Multi-environment** (dev/staging/prod) — feature branch deploys, separate Atlas DBs.
- **Atlas Search** — semantic search over transactions and descriptions.
- **GraphQL gateway** — optional, only if the user has a clear "why."

## 7. Open questions / deferred decisions

- **Demo data freshness.** Should the demo user's transactions auto-regenerate weekly so visitors see "current" data? *Decision deferred until Phase 1 is live.*
- **Multi-region.** Not needed for v1. Revisit only if the project grows beyond personal scope.
- **Auth: cookies vs Bearer.** Phase 2 moves to httpOnly cookies. CSRF protection (double-submit token) added at the same time. *Confirmed direction.*
- **Worker hosting.** Phase 4a — App Runner does not support multi-process services well. Likely solution: a second App Runner service running `worker.js` against the same Redis. Decided in Phase 4 planning.
- **Domain name.** TBD by user before Phase 1 lands.

## 8. Risks

- **App Runner cost creep.** Always-on services incur cost even when idle. Budget alarm at $20/mo via AWS Budgets. Mitigation: scale to zero acceptable; if costs grow, fall back to Render/Fly.io free tiers.
- **Atlas free tier eviction.** M0 has 512 MB; transaction history will eventually exceed it. Plan: paid tier upgrade ($9/mo M2) when needed, or migrate to RDS Postgres if Phase 7 SQL learning is wanted.
- **Phase fatigue.** 7-12 hrs/week is reasonable but distractions happen. Mitigation: phases are independent — skipping or pausing a phase doesn't break previous work.

## 9. Success criteria

By end of Phase 6, AIFT should:

- Have a public live URL with HTTPS.
- Pass `npm test` with >50% coverage.
- Have green CI on every push to `main`.
- Page if down (UptimeRobot).
- Surface metrics + structured logs to CloudWatch.
- Survive a casual code review by a senior backend engineer who would say "this was clearly a learning project but the choices are sound."

## 10. References

- Current backend entry: `backend/server.js`
- Current AI service: `backend/services/aiService.js` (will be substantially refactored in Phase 0 + Phase 4)
- Current auth middleware: `backend/middleware/authMiddleware.js`
- Current models: `backend/models/*`
- Current routes: `backend/routes/*` (lowercase imports to be fixed in Phase 0)
- Cron entrypoint: `backend/server.js:50` (will be replaced in Phase 4a)
