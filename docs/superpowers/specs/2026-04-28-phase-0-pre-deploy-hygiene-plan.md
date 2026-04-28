# Phase 0 — Pre-Deploy Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix blocking bugs and add baseline secure defaults so AIFT is ready to deploy in Phase 1.

**Architecture:** No behavior changes — this phase is hygiene only. Single-source-of-truth fix for category enums, dev/prod parity for the port, baseline web-security middleware, and a real README.

**Tech Stack:** Node 18+, Express 5, Mongoose, Vite. Adds: `helmet`, `morgan`.

**Approval policy:** User has set "approval before any code change." Each task below is a unit of approval — wait for explicit "go" before starting a task. Within an approved task, proceed through its steps without re-asking.

---

## Source spec

`docs/superpowers/specs/2026-04-28-backend-leveling-up-roadmap-design.md` §6 Phase 0.

## File map

| File | Touched in task | Type |
|---|---|---|
| `backend/routes/airoutes.js` | 2 | modify |
| `backend/routes/analyticsroutes.js` | 2 | modify |
| `backend/services/aiService.js` | 3, 4 | modify |
| `backend/models/Transactionmodel.js` | 4 | modify |
| `frontend/src/components/TransactionModal.jsx` | 4 | modify |
| `.gitignore` | 5 | modify |
| `backend/.env.example` | 6 | create |
| `backend/server.js` | 7, 8 | modify |
| `backend/package.json` (+lock) | 7 | modify |
| `README.md` | 9 | create |

## Tasks at a glance

1. Verify port alignment (no code change — backend `.env` has `PORT=3001`, vite proxy already matches)
2. Fix case-sensitive route imports
3. Remove leaked logs in `aiService.js`
4. Reconcile category enums (single source of truth)
5. Tighten `.gitignore`
6. Add `backend/.env.example`
7. Add `helmet` and `morgan`
8. Deeper `/api/health` (db connectivity)
9. Write top-level `README.md`

Tasks 2-9 each end with a commit, so by the end of Phase 0 there will be 8 new commits on `main` (Task 1 is verification-only and has no commit).

---

## Task 1: Verify port alignment (no code change)

**Original assumption:** Backend defaults to `:5000` (`server.js:23` says `process.env.PORT || 5000`) while Vite dev proxy targets `:3001`.

**Reality discovered during execution:** Ayush's `backend/.env` already sets `PORT=3001`, so the running backend listens on `:3001`, which already matches the Vite proxy. **No mismatch existed; no code change is needed.**

**Decision:** Standardize on `:3001` for dev (it's already what works locally). Production will inject its own `PORT` via App Runner. All commands and example configs in the rest of this plan use `:3001`.

**Files:** none changed.

- [ ] **Step 1: Verify both services agree on `:3001`**

```bash
grep -E '^PORT=' backend/.env       # expect: PORT=3001
grep "target:" frontend/vite.config.js   # expect: target: 'http://localhost:3001',
```

- [ ] **Step 2: Verify dev works end-to-end**

Manual verification (Ayush runs locally):

```bash
# Terminal 1
cd backend && npm run dev
# expect: "Connected to MongoDB" and "Server running on port 3001"

# Terminal 2
cd frontend && npm run dev
# expect: Vite dev server on :5173

# In browser at http://localhost:5173
# Open DevTools → Network. Try logging in. The /api/auth/login request should return 200/401, NOT a 504/proxy error.
```

- [ ] **Step 3: No commit**

Nothing changed; nothing to commit. Move on to Task 2.

---

## Task 2: Fix case-sensitive route imports

**Bug:** `airoutes.js` and `analyticsroutes.js` import from lowercase paths that don't match the actual filenames. Works on macOS (case-insensitive) but breaks on Linux containers (case-sensitive) — i.e., it would crash on AWS in Phase 1.

**Files:**
- Modify: `backend/routes/airoutes.js:6`
- Modify: `backend/routes/analyticsroutes.js:6`

- [ ] **Step 1: Fix `airoutes.js` import casing**

In `backend/routes/airoutes.js`, change:

```js
} from '../controllers/aicontroller.js';
```

to:

```js
} from '../controllers/aiController.js';
```

- [ ] **Step 2: Fix `analyticsroutes.js` import casing**

In `backend/routes/analyticsroutes.js`, change:

```js
} from '../controllers/analyticscontroller.js';
```

to:

```js
} from '../controllers/analyticsController.js';
```

- [ ] **Step 3: Verify no other case mismatches**

Run from repo root:

```bash
ls backend/controllers/ backend/routes/ backend/models/
grep -n "from '../controllers/" backend/routes/*.js
grep -n "from '../models/" backend/controllers/*.js
```

Expected: every imported path matches an actual filename byte-for-byte.

- [ ] **Step 4: Restart backend dev and confirm it boots**

```bash
cd backend && npm run dev
# expect: "Connected to MongoDB" and "Server running on port 3001"
# (Crash with "Cannot find module" means a remaining mismatch.)
```

- [ ] **Step 5: Commit**

```bash
git add backend/routes/airoutes.js backend/routes/analyticsroutes.js
git commit -m "fix(routes): use exact-case controller imports for linux compatibility"
```

---

## Task 3: Remove leaked logs in `aiService.js`

**Bug:** `backend/services/aiService.js` logs the Gemini API key on startup and dumps every AI response to stdout. Both leak in production logs.

> **Note:** The current working tree shows `M backend/services/aiService.js` — Ayush has uncommitted changes. Before this task, run `git diff backend/services/aiService.js` to confirm the diff matches the lines below. If Ayush has already removed any of these, just skip those substeps.

**Files:**
- Modify: `backend/services/aiService.js`

- [ ] **Step 1: Inspect the working-tree diff**

```bash
git diff backend/services/aiService.js
```

Expected: shows current modifications. If it shows nothing meaningful that conflicts with this task, proceed.

- [ ] **Step 2: Remove the API-key log (line 6)**

Delete this line:

```js
console.log(apiKey,"apiKeyy-----------------")
```

- [ ] **Step 3: Remove the dead `console.log` (line 13)**

Inside `callGeminiAPI`, delete the orphan line:

```js
    console.log
```

- [ ] **Step 4: Trim the verbose response logs**

Replace:

```js
    console.log("Gemini API response status:", response);
```

with:

```js
    console.log("Gemini API response status:", response.status);
```

And **delete entirely**:

```js
    console.log(data);
```

(near the bottom of `callGeminiAPI`).

- [ ] **Step 5: Verify AI still works**

Manual test:

```bash
cd backend && npm run dev
```

In another terminal or via the frontend, hit `POST /api/ai/categorize` with a description. Expected: a category string returned. The server log should show only the response status (a number), not the API key, not the full response body.

- [ ] **Step 6: Commit**

```bash
git add backend/services/aiService.js
git commit -m "fix(ai): remove leaked api key log and verbose response dump"
```

---

## Task 4: Reconcile category enums (single source of truth)

**Bug:** Three different category lists exist:
- Backend `Transactionmodel.js` enum (validates inserts)
- AI prompt in `aiService.js` (asks Gemini to choose from)
- Frontend `TransactionModal.jsx` (dropdown options)

Their differences: `Healthcare` vs `Health & Fitness`, missing `Rent`, plural `Investments`/`Gifts` vs singular, `Other` vs `Other Expense`/`Other Income`. The AI can return a category the model rejects → 500 errors.

**Decision:** Adopt this canonical list (source of truth = `Transactionmodel.js`). All three places must match it byte-for-byte.

**Canonical Expense categories (13):**
`Food & Drinks`, `Transportation`, `Shopping`, `Entertainment`, `Bills & Utilities`, `Healthcare`, `Education`, `Travel`, `Groceries`, `Rent`, `Insurance`, `Personal Care`, `Other Expense`

**Canonical Income categories (5):**
`Salary`, `Freelance`, `Investment`, `Gift`, `Other Income`

> Future cleanup (Phase 5+): expose `/api/v1/constants/categories` as the single source the frontend fetches, so this can never drift again. For Phase 0 we just sync the three places.

**Files:**
- Modify: `backend/models/Transactionmodel.js:23-28`
- Modify: `backend/services/aiService.js` (the categorize prompt)
- Modify: `frontend/src/components/TransactionModal.jsx:8-15`

- [ ] **Step 1: Update the model enum**

In `backend/models/Transactionmodel.js`, replace the `enum` array with the canonical list:

```js
    category: {
        type: String,
        required: [true, "Category is required"],
        enum:[
            // Expense categories
            'Food & Drinks', 'Transportation', 'Shopping', 'Entertainment',
            'Bills & Utilities', 'Healthcare', 'Education', 'Travel',
            'Groceries', 'Rent', 'Insurance', 'Personal Care', 'Other Expense',
            // Income categories
            'Salary', 'Freelance', 'Investment', 'Gift', 'Other Income'
        ]
    },
```

- [ ] **Step 2: Update the AI categorize prompt**

In `backend/services/aiService.js`, inside `categorizeTransaction`, replace the prompt's category list with:

```js
        const prompt = `Categorize this transaction:
Description: "${description}"
Amount: $${amount}

Choose ONE category from: Food & Drinks, Transportation, Shopping, Entertainment, Bills & Utilities, Healthcare, Education, Travel, Groceries, Rent, Insurance, Personal Care, Other Expense, Salary, Freelance, Investment, Gift, Other Income

Return ONLY the category name, nothing else.`;
```

- [ ] **Step 3: Update the frontend `CATEGORIES` map**

In `frontend/src/components/TransactionModal.jsx`, replace the `CATEGORIES` const with:

```jsx
const CATEGORIES = {
  expense: [
    'Food & Drinks', 'Transportation', 'Shopping', 'Entertainment',
    'Bills & Utilities', 'Healthcare', 'Education', 'Travel',
    'Groceries', 'Rent', 'Insurance', 'Personal Care', 'Other Expense'
  ],
  income: ['Salary', 'Freelance', 'Investment', 'Gift', 'Other Income']
};
```

- [ ] **Step 4: Verify**

Manual:

1. Restart backend (`npm run dev`).
2. In the frontend (`npm run dev`), open the transaction modal.
3. Confirm the dropdown shows the new canonical list (no `Other`, has `Personal Care`, etc.).
4. Try the "AI" categorize button on a description; the AI's returned category should be present in the dropdown.
5. Submit a transaction with a non-canonical category via curl — expect a Mongoose validation error:

```bash
TOKEN="<paste a valid access token>"
curl -X POST http://localhost:3001/api/transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"expense","amount":10,"category":"Other","date":"2026-04-28"}'
# expect: 500 with "Category is required" / validation error
```

- [ ] **Step 5: Commit**

```bash
git add backend/models/Transactionmodel.js backend/services/aiService.js frontend/src/components/TransactionModal.jsx
git commit -m "fix(categories): unify category enum across model, ai prompt, and frontend"
```

---

## Task 5: Tighten `.gitignore`

**Goal:** Prevent stray local files (logs, OS junk, editor state, coverage) from being committed by accident.

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Replace `.gitignore` content**

```gitignore
# Dependencies
node_modules/
*/node_modules/

# Environment files - CRITICAL
backend/.env
.env
.env.local
.env.*.local

# Build outputs
dist/
build/
frontend/dist/

# Logs
*.log
logs/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Coverage / test artifacts
coverage/
.nyc_output/

# OS / editor
.DS_Store
.idea/
.vscode/
*.swp
*.swo

# Uploads (user uploaded files)
backend/uploads/*
!backend/uploads/.gitkeep
```

- [ ] **Step 2: Verify nothing currently tracked is now ignored**

```bash
git ls-files -i --exclude-standard
```

Expected: empty output. (If anything prints, it means a file matches a new ignore rule but was previously committed — investigate before continuing.)

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore(gitignore): tighten ignore rules for logs, coverage, editors"
```

---

## Task 6: Add `backend/.env.example`

**Goal:** Document every environment variable the backend reads, so a fresh checkout can be configured without hunting through code.

**Files:**
- Create: `backend/.env.example`

- [ ] **Step 1: Create `backend/.env.example`**

```env
# ===== Core =====
PORT=3001
FRONTEND_URL=http://localhost:5173

# ===== Database =====
# Local: mongodb://127.0.0.1:27017/aift
# Atlas: mongodb+srv://<user>:<pwd>@<cluster>.mongodb.net/aift
MONGODB_URI=

# ===== Auth (JWT) =====
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# ===== AI (Gemini) =====
# https://aistudio.google.com/app/apikey
GEMINI_API_KEY=

# ===== Receipt uploads (Cloudinary) =====
# Will be replaced with AWS S3 in Phase 1
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

- [ ] **Step 2: Verify the actual `.env` is still ignored**

```bash
git status backend/.env
git status backend/.env.example
```

Expected:
- `backend/.env` is *untracked* and ignored (won't show in `git status` plain output).
- `backend/.env.example` shows as a new tracked file.

- [ ] **Step 3: Commit**

```bash
git add backend/.env.example
git commit -m "docs(env): add backend/.env.example with all required variables"
```

---

## Task 7: Add `helmet` and `morgan`

**Goal:** Baseline web-security headers (`helmet`) and request logging (`morgan`) on every request.

**Files:**
- Modify: `backend/package.json` (and lockfile)
- Modify: `backend/server.js`

- [ ] **Step 1: Install dependencies**

```bash
cd backend
npm install helmet morgan
cd ..
```

Expected: `package.json` now lists `helmet` and `morgan` under `dependencies`.

- [ ] **Step 2: Wire helmet + morgan in `server.js`**

In `backend/server.js`, add to the imports block at the top (alongside the existing imports):

```js
import helmet from 'helmet';
import morgan from 'morgan';
```

Then, in the **Middleware** section (just after `dotenv.config()` and before `app.use(cors(...))`), add:

```js
// Security headers
app.use(helmet());

// Request logging — concise format in prod, dev format locally
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
```

The middleware order should now be: `helmet` → `morgan` → `cors` → `express.json` → `express.urlencoded` → `cookieParser` → routes.

- [ ] **Step 3: Verify**

```bash
cd backend && npm run dev
```

In another terminal:

```bash
curl -i http://localhost:3001/api/health
```

Expected:
- `X-Content-Type-Options: nosniff` and other helmet-added headers present in the response.
- The dev terminal logs the request in morgan's `dev` format, e.g. `GET /api/health 200 5.123 ms - 32`.

- [ ] **Step 4: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/server.js
git commit -m "feat(security): add helmet headers and morgan request logging"
```

---

## Task 8: Deeper `/api/health`

**Goal:** Make `/api/health` actually useful — App Runner / UptimeRobot / Phase 6 alerts will rely on this endpoint to mean "the service can serve traffic," not just "the process is up."

**Behavior:**
- Returns `200` with `{ status: 'ok', db: 'connected', uptime: <seconds> }` when Mongo is connected.
- Returns `503` with `{ status: 'degraded', db: '<state>' }` when Mongo is not connected.

**Files:**
- Modify: `backend/server.js`

- [ ] **Step 1: Replace the existing health route**

In `backend/server.js`, replace:

```js
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});
```

with:

```js
// Health check — used by load balancers and uptime monitors
const dbStateLabel = (s) => ({
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
})[s] || 'unknown';

app.get('/api/health', (req, res) => {
    const dbState = mongoose.connection.readyState;
    const healthy = dbState === 1;
    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'degraded',
        db: dbStateLabel(dbState),
        uptime: Math.round(process.uptime())
    });
});
```

- [ ] **Step 2: Verify the happy path**

```bash
curl -i http://localhost:3001/api/health
```

Expected: HTTP `200`, body like `{"status":"ok","db":"connected","uptime":12}`.

- [ ] **Step 3: Verify the degraded path**

In a separate terminal, while the backend is running, temporarily kill / disconnect Mongo (easiest: stop your local mongod, or set `MONGODB_URI` to an invalid host and restart). Then:

```bash
curl -i http://localhost:3001/api/health
```

Expected: HTTP `503`, body `{"status":"degraded","db":"disconnected", ...}`. Restore Mongo afterward.

> If you don't want to disconnect Mongo, the happy-path verification alone is enough for Phase 0 — we'll get richer health-check tests in Phase 5.

- [ ] **Step 4: Commit**

```bash
git add backend/server.js
git commit -m "feat(health): include db connectivity and uptime, return 503 when degraded"
```

---

## Task 9: Write top-level `README.md`

**Goal:** Anyone landing on the repo (recruiter, future-you, fellow learner) can clone and run the project in under 10 minutes.

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# AIFT — AI Finance Tracker

Personal finance tracker with AI-powered categorization, monthly summaries, and savings recommendations. Built as a learning project to level up modern backend infra (deployment, caching, rate limiting, queues, observability).

> **Status:** Phase 0 (pre-deploy hygiene) — see `docs/superpowers/specs/2026-04-28-backend-leveling-up-roadmap-design.md` for the full roadmap.

## Stack

- **Backend:** Node 18+, Express 5, Mongoose, JWT (access + refresh), bcrypt, multer, Gemini 2.5 Flash, node-cron
- **Frontend:** React 18, Vite, Tailwind, Zustand, recharts, axios
- **Infra (planned):** AWS App Runner, S3, Atlas, Redis (Upstash), BullMQ, GitHub Actions

## Quickstart

### Prerequisites

- Node.js 18+ and npm
- A MongoDB instance (local or Atlas free tier)
- A [Gemini API key](https://aistudio.google.com/app/apikey)
- (Optional) Cloudinary account for receipts — will be replaced with S3 in Phase 1

### Setup

```bash
# 1. Clone
git clone git@github.com:Ayushhj21/AI-Finance-Tracker.git
cd AI-Finance-Tracker

# 2. Install everything (root, backend, frontend)
npm run install-all

# 3. Configure backend environment
cp backend/.env.example backend/.env
# Then open backend/.env and fill in:
#   - MONGODB_URI
#   - JWT_ACCESS_SECRET   (generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
#   - JWT_REFRESH_SECRET  (same command, different value)
#   - GEMINI_API_KEY
#   - CLOUDINARY_*        (optional, only if testing receipt uploads)

# 4. Run dev (backend + frontend, both at once)
npm run dev
```

Open http://localhost:5173 — the Vite dev server proxies `/api` to the backend on `:5000`.

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
│   └── server.js        # Entry point
├── frontend/            # React + Vite + Tailwind
│   └── src/
│       ├── components/  # Reusable UI
│       ├── pages/       # Route-level views
│       ├── services/    # axios API wrappers
│       └── stores/      # Zustand state
├── docs/superpowers/    # Design docs and implementation plans
└── package.json         # Root scripts (concurrently runs both)
```

## API surface

All endpoints are under `/api`. Authenticated routes require `Authorization: Bearer <accessToken>`.

| Prefix | Auth | Purpose |
|---|---|---|
| `/api/auth` | mostly public | register, login, refresh, logout, me |
| `/api/transactions` | private | CRUD + receipt upload |
| `/api/budgets` | private | per-category monthly budgets |
| `/api/savings-goals` | private | named savings goals with deadlines |
| `/api/analytics` | private | dashboard, trends, categories, cashflow, patterns |
| `/api/ai` | private | Gemini-powered categorize / summary / predict / recommend |
| `/api/notifications` | private | budget alerts, unusual spending, high-value |
| `/api/health` | public | db-aware liveness / readiness |

## Scripts

```bash
npm run dev            # both backend and frontend
npm run server         # backend only (nodemon)
npm run client         # frontend only (vite)
npm run install-all    # install root + backend + frontend deps
```

## Roadmap

This project is being evolved through a planned 8-phase roadmap focused on backend learning. See `docs/superpowers/specs/2026-04-28-backend-leveling-up-roadmap-design.md` for the full plan. Per-phase implementation plans live alongside it.

## License

MIT — personal project.
```

- [ ] **Step 2: Verify quickstart works on a clean clone (optional but recommended)**

If you have time, clone the repo into a scratch directory and follow the quickstart from a blank slate. Easiest:

```bash
cd /tmp
git clone git@github.com-personalAccount:Ayushhj21/AI-Finance-Tracker.git aift-test
cd aift-test
npm run install-all
cp backend/.env.example backend/.env
# fill in env, then:
npm run dev
```

Expected: backend says "Connected to MongoDB" and "Server running on port 3001"; frontend serves at `:5173`. Cleanup: `rm -rf /tmp/aift-test` after.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add top-level README with stack, quickstart, and roadmap pointer"
```

---

## End-of-phase verification

Before pushing, run a quick smoke check:

- [ ] `git log --oneline -10` shows 8 new commits, all attributed to `Ayush Jain <ayushjain21.nmims@gmail.com>`.
- [ ] `cd backend && npm run dev` starts cleanly (no warnings about missing modules).
- [ ] `cd frontend && npm run dev` starts cleanly and the app loads at `:5173`.
- [ ] You can log in, view the dashboard, add a transaction with the "AI" categorize button, and the category lands in the model without a 500.
- [ ] `curl -i http://localhost:3001/api/health` returns `200` with `db: "connected"`.
- [ ] `curl -I http://localhost:3001/api/health | grep -i x-content-type-options` shows the helmet header is present.
- [ ] `git ls-files -i --exclude-standard` returns nothing (no committed files match the new ignore rules).

Once green, push:

```bash
git push origin main
```

(The `origin` remote already routes through your personal-account SSH alias — verify with `git remote -v` if unsure.)

## What's next

Phase 1 — "Get it live" — turns this hygiene-clean codebase into a public URL on AWS. We'll write that plan after Phase 0 is merged.

## Self-review notes

- All 10 spec items from §6 Phase 0 are covered (helmet ✓, morgan ✓, port ✓, casing ✓, leaked logs ✓, category enum ✓, .env.example ✓, .gitignore ✓, /api/health ✓, README ✓).
- No `TBD` placeholders. The optional manual verification in Task 9 Step 2 is explicit about being optional.
- Type/name consistency: `dbStateLabel` in Task 8 is defined in the same file edit; no forward references.
- Approval policy stated up front, so each task is a clean approval gate.
