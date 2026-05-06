# AIFT — AI Finance Tracker

A personal finance tracker with AI-powered transaction categorization, monthly summaries, and savings recommendations. Built as a hands-on learning project to level up modern backend infrastructure — deployment, caching, rate limiting, queues, observability — on a real running system.

> **Status:** Phase 1 of 8 — deployed live on free-tier infrastructure.
>
> **Live URL:** https://ai-finance-tracker-seven-opal.vercel.app *(Render free tier — first request after 15min idle takes ~30s to wake the backend)*
>
> See [`docs/superpowers/specs/2026-04-28-backend-leveling-up-roadmap-design.md`](docs/superpowers/specs/2026-04-28-backend-leveling-up-roadmap-design.md) for the full roadmap and per-phase plans.
>
> This is **not a product**. There are no real users and there is no plan to acquire any. The interesting thing here is the deliberate, phased evolution of the backend — each phase teaches a specific cluster of concepts.

## Stack

- **Backend:** Node 18+, Express 5, Mongoose, JWT (access + refresh), bcrypt, multer, Gemini 2.5 Flash, node-cron, helmet, morgan
- **Frontend:** React 18, Vite, Tailwind, Zustand, recharts, axios *(generated with AI assistance — backend is the focus of this project)*
- **Infra (planned):** AWS App Runner, S3, MongoDB Atlas, Redis (Upstash), BullMQ, GitHub Actions, Sentry

## Quickstart

### Prerequisites

- Node.js 18+ and npm
- MongoDB (local or [Atlas free tier](https://www.mongodb.com/cloud/atlas))
- A [Gemini API key](https://aistudio.google.com/app/apikey)
- *(Optional)* Cloudinary account for receipt uploads — being replaced with S3 in Phase 1

### Setup

```bash
# 1. Clone
git clone git@github.com:Ayushhj21/AI-Finance-Tracker.git
cd AI-Finance-Tracker

# 2. Install everything (root, backend, frontend)
npm run install-all

# 3. Configure backend environment
cp backend/.env.example backend/.env
# Then edit backend/.env and fill in:
#   - MONGODB_URI
#   - JWT_ACCESS_SECRET   (generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
#   - JWT_REFRESH_SECRET  (generate the same way)
#   - GEMINI_API_KEY
#   - CLOUDINARY_*        (only if you want to test receipt uploads)

# 4. Run dev (backend + frontend, both at once)
npm run dev
```

Open http://localhost:5173 — the Vite dev server proxies `/api` to the backend on `:3001`.

### Health check

```bash
curl http://localhost:3001/api/health
# {"status":"ok","db":"connected","uptime":3}
```

## Repository layout

```
AIFT/
├── backend/             # Express API
│   ├── controllers/     # Route handlers per domain
│   ├── middleware/      # Auth (JWT) middleware
│   ├── models/          # Mongoose schemas
│   ├── routes/          # Express routers
│   ├── services/        # AI (Gemini), notifications
│   ├── utils/           # JWT helpers
│   └── server.js        # Entry point — middleware chain + routes + cron
├── frontend/            # React + Vite + Tailwind
│   └── src/
│       ├── components/  # Reusable UI
│       ├── pages/       # Route-level views
│       ├── services/    # axios API wrappers
│       └── stores/      # Zustand state
├── docs/superpowers/    # Roadmap spec + per-phase implementation plans
└── package.json         # Root scripts (concurrently runs backend + frontend)
```

## API surface

All endpoints under `/api`. Authenticated routes require `Authorization: Bearer <accessToken>`.

| Prefix | Auth | Purpose |
|---|---|---|
| `/api/auth` | mostly public | register, login, refresh, logout, me |
| `/api/transactions` | private | CRUD + receipt upload |
| `/api/budgets` | private | per-category monthly budgets |
| `/api/savings-goals` | private | named savings goals with deadlines |
| `/api/analytics` | private | dashboard, trends, categories, cashflow, patterns |
| `/api/ai` | private | Gemini-powered categorize / summary / predict / recommend |
| `/api/notifications` | private | budget alerts, unusual spending, high-value |
| `/api/health` | public | db-aware liveness / readiness — 200 when connected, 503 when degraded |

## Scripts

```bash
npm run dev            # both backend and frontend
npm run server         # backend only (nodemon)
npm run client         # frontend only (vite)
npm run install-all    # install root + backend + frontend deps
```

## Deployment

Currently deployed on free-tier infrastructure as part of Phase 1 of the roadmap. AWS App Runner migration is planned for a later phase.

```
┌──────────────┐         ┌────────────────────────┐
│   Vercel     │  HTTPS  │  Render free web       │
│ (React CDN)  │ ──────> │  service (Docker)      │
│ ai-finance-  │         │  ai-finance-tracker-   │
│ tracker-     │         │  y1fu.onrender.com     │
│ seven-opal   │         └───────────┬────────────┘
└──────────────┘                     │ TLS
                                     ▼
                         ┌────────────────────────┐
                         │  MongoDB Atlas M0      │
                         │  (free tier shared)    │
                         └────────────────────────┘
```

**Service map:**

| Layer | Provider | Tier | Cost |
|---|---|---|---|
| Frontend (React build) | Vercel | Hobby | Free |
| Backend (Express in Docker) | Render | Free Web Service | Free |
| Database | MongoDB Atlas | M0 Shared | Free |
| AI | Google Gemini API | Free quota | Free |
| Receipt storage | Cloudinary | Free tier | Free |

**Known limitations of free tier:**
- Backend spins down after 15 min idle; cold start ~30s on first request
- Atlas M0: 512 MB storage, no backups, shared CPU
- Cloudinary free: 25 GB storage / 25 GB bandwidth per month
- Atlas IP rule allows `0.0.0.0/0` (acceptable for learning project; flagged for revisit in Phase 7)
- Gemini 2.5 Flash returns transient `503 UNAVAILABLE` under load; backend silently falls back to `Other Expense` (will be properly surfaced to the user in Phase 2)

## Roadmap

8-phase plan focused on backend learning. Each phase teaches a specific cluster of concepts and ends with the system in a clean, deployable state.

| Phase | Focus | Status |
|---|---|---|
| **0** | Pre-deploy hygiene — port parity, casing, leaked logs, category SSOT, helmet/morgan, deeper health, README | **Done** |
| **1** | Get it live — Docker, MongoDB Atlas, Render web service, Vercel (Path B; AWS App Runner / S3 deferred to a future mini-phase) | **Done** |
| **2** | Backend hardening — refresh token rotation, rate limiting, Zod validation, structured logging (pino), centralized error handling | |
| **3** | Reliability + perf — Redis cache layer, idempotency keys, Mongo transactions, pagination | |
| **4** | Async architecture — BullMQ jobs, SES email, optionally Kafka for one event flow | |
| **5** | Quality + DevOps — Jest + Supertest, GitHub Actions CI/CD, OpenAPI docs, API versioning | |
| **6** | Observability — Sentry, CloudWatch metrics, ready/health split | |
| **7** | Stretch — Terraform, WebSockets, k6 load tests, multi-environment | |

Per-phase implementation plans live in [`docs/superpowers/specs/`](docs/superpowers/specs/).

## License

MIT — personal project.
