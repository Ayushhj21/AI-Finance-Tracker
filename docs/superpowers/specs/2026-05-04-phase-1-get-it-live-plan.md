# Phase 1 — Get It Live (Path B: Render First) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy AIFT publicly via free-tier services (MongoDB Atlas M0 + Render + Vercel) so it's reachable at a real HTTPS URL anyone can visit. AWS migration is deferred to a future phase.

**Architecture:** Frontend (React build) on Vercel CDN → calls backend at `https://aift-backend.onrender.com/api/...` → backend (Express in Docker) on Render free web service → connects to MongoDB Atlas M0 cluster. Cloudinary stays for receipts in this phase (S3 is the OPTIONAL Task 9, requires AWS account).

**Tech Stack added:** Docker (multi-stage Node 20-alpine build), MongoDB Atlas (M0), Render (web service from Dockerfile), Vercel (static site from Vite build), Vite env vars (`VITE_API_URL`).

**Approval policy:** Same as Phase 0 — each task is its own approval gate. External-service tasks (Render dashboard, Atlas, Vercel) involve clicks the user makes themselves; Claude provides the exact steps.

---

## Source spec

`docs/superpowers/specs/2026-04-28-backend-leveling-up-roadmap-design.md` §6 Phase 1, with two adjustments based on later decisions:
1. **No "demo user for visitors"** — project has no real users, no need to seed demo accounts.
2. **Render replaces App Runner as the primary deploy target** — Path B chosen on 2026-05-04 to defer AWS account setup. App Runner becomes a separate future mini-phase.

## File map

| File | Touched in task | Type |
|---|---|---|
| `backend/Dockerfile` | 1 | create |
| `backend/.dockerignore` | 1 | create |
| `backend/server.js` | 2 | modify |
| `frontend/src/utils/api.js` | 3 | modify |
| `frontend/.env.example` | 3 | create |
| `frontend/.env.production` | 3 | (committed example only — real values set in Vercel dashboard) |
| `README.md` | 8 | modify |
| `backend/controllers/transactionController.js` | 9 (optional) | modify |
| `backend/services/s3Service.js` | 9 (optional) | create |
| `backend/.env.example` | 9 (optional) | modify |

## Tasks at a glance

1. **Dockerfile + .dockerignore** — multi-stage, Node 20-alpine, non-root, npm ci
2. **Trust proxy + minor server.js prep for hosting** — lets Express understand it's behind Render's load balancer
3. **Frontend env-var plumbing (`VITE_API_URL`)** — keeps `/api` proxy working in dev, switches to full backend URL in prod
4. **Provision MongoDB Atlas M0** — dashboard walkthrough, no code
5. **Deploy backend to Render** — dashboard walkthrough, env vars, health check
6. **Deploy frontend to Vercel** — dashboard walkthrough, env var, build config
7. **End-to-end smoke test on prod URLs** — verify everything talks to everything
8. **Update README with deploy section** — live URLs, "what's running where" diagram
9. **(OPTIONAL) Replace Cloudinary with S3** — requires AWS account; skip if not ready

Tasks 1-3 produce 3 commits. Tasks 4-7 produce no commits (external setup + validation). Task 8 produces 1 commit. Task 9 produces 2 commits (S3 service + controller wiring) IF you do it.

So Phase 1 produces **4 commits minimum, 6 if you do Task 9**.

---

## Task 1: Dockerfile + .dockerignore

**Why:** Docker is the unit of deploy on Render (and most modern PaaS). It guarantees that the same image runs identically in dev, on Render, and later on App Runner. The Dockerfile becomes the executable spec of "what does this app need to run."

**Concept this teaches:**
- **Multi-stage builds** — separate "builder" stage (with dev deps, compilers, etc.) from "runner" stage (small, just runtime). The final image is *only* the runner. Dramatically smaller images.
- **Layer caching** — `COPY package*.json` then `npm ci` *before* `COPY . .` means Docker can reuse the npm-install layer when only source code changes. Build time drops from minutes to seconds on iterative builds.
- **Non-root execution** — running as a non-privileged user (`node` is built into the official Node images) is a small but important security default. Container escapes are rare; container-as-root escapes are dangerous.
- **`npm ci` vs `npm install`** — `ci` requires a `package-lock.json` and installs *exact* versions from it. Reproducible across machines. `install` updates the lockfile based on the version ranges in `package.json` — non-deterministic. CI/Docker builds always use `ci`.

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`

- [ ] **Step 1: Create `backend/Dockerfile`**

```dockerfile
# ===== Build stage =====
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for layer caching — npm ci only re-runs when these change
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ===== Runtime stage =====
FROM node:20-alpine

# Run as the built-in 'node' user, not root
USER node
WORKDIR /home/node/app

# Copy only what's needed at runtime: deps from builder + source from local
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node . .

# Create the uploads dir the multer middleware expects (will be ephemeral on Render — uploads disappear on restart, that's fine for now since Cloudinary stores receipts)
RUN mkdir -p uploads

ENV NODE_ENV=production

# Render injects PORT env var; we already read it via process.env.PORT
EXPOSE 3001

CMD ["node", "server.js"]
```

- [ ] **Step 2: Create `backend/.dockerignore`**

```
# Don't ship node_modules — they get installed fresh in the build stage
node_modules
npm-debug.log

# Secrets must come from env vars, not the image
.env
.env.local
.env.*.local

# Repo metadata not needed at runtime
.git
.gitignore

# Local uploads — receipts are user-generated and should not be baked into the image
uploads/*
!uploads/.gitkeep

# Editor / OS junk
.DS_Store
.idea
.vscode

# Docs (not needed at runtime — drop weight)
README.md
docs/
```

- [ ] **Step 3: Verify the build locally**

Make sure Docker Desktop (or `colima`/`orbstack`) is running, then:

```bash
cd backend
docker build -t aift-backend:dev .
```

Expected: build completes in ~30-90s. Final line should look like `=> => writing image sha256:...` and `=> => naming to docker.io/library/aift-backend:dev`.

Inspect the image size (smaller is better — proves multi-stage worked):

```bash
docker images aift-backend:dev
```

Expected: `~150-200MB`. (For comparison, a single-stage build with dev deps would be ~400-600MB.)

- [ ] **Step 4: Run the container locally**

```bash
# from repo root
docker run --rm -p 3001:3001 \
  --env-file backend/.env \
  --name aift-backend-test \
  aift-backend:dev
```

Notes on the flags:
- `--rm` removes the container after it stops (no leftover state)
- `-p 3001:3001` maps host port to container port
- `--env-file backend/.env` injects your local env (you'll see why Render's env-vars-in-dashboard is the production way to do this)
- `--name` lets you find/kill it easily

Expected: same boot output as `npm run dev`:
```
Connected to MongoDB
🚀 Server running on port 3001
```

In another terminal:
```bash
curl -s http://localhost:3001/api/health
# expect: {"status":"ok","db":"connected","uptime":3}
```

Stop the container with `Ctrl-C` in its terminal.

- [ ] **Step 5: Commit**

```bash
git add backend/Dockerfile backend/.dockerignore
git commit -m "feat(docker): containerize backend with multi-stage node 20-alpine build"
```

---

## Task 2: Trust proxy + minor server.js prep for hosting

**Why:** Render (and any modern PaaS) puts your container behind a load balancer / reverse proxy that terminates HTTPS. From your container's perspective, every request looks like it came from the load balancer's IP — not the real client. The LB adds standard `X-Forwarded-For`, `X-Forwarded-Proto`, etc. headers to communicate the real values. Express won't trust those headers by default (security — anyone could fake them locally). You explicitly opt in with `app.set('trust proxy', N)`.

**Concept this teaches:**
- The **reverse proxy header convention** (`X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`). Used by Nginx, AWS ALB, Cloudflare, Render, basically every PaaS.
- Why Express defaults to "don't trust" — it's a security default. If you trusted forwarded headers blindly without a proxy in front, anyone could spoof `req.ip`.
- The numeric arg (`'trust proxy', 1`) tells Express how many proxy hops to trust. `1` means "the immediate proxy in front of me." Render fits this case.
- `req.ip` and `req.protocol` will now reflect the real client (used later in Phase 2 for rate-limiting per-IP, and for redirecting HTTP to HTTPS).

**Files:**
- Modify: `backend/server.js`

- [ ] **Step 1: Add `trust proxy` setting**

In `backend/server.js`, just after `const app = express();` add:

```js
// Behind Render/Vercel/App Runner load balancer — trust X-Forwarded-* headers from one hop
app.set('trust proxy', 1);
```

So that section becomes:

```js
const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;
```

- [ ] **Step 2: Verify nothing broke locally**

Restart the backend (or let nodemon auto-restart). Hit `/api/health`:
```bash
curl -s http://localhost:3001/api/health
# expect: {"status":"ok","db":"connected","uptime":N}
```

`trust proxy` is a behavior change that's invisible until you're behind a proxy. The local-dev verification just confirms nothing crashed. Real verification happens in Task 7.

- [ ] **Step 3: Commit**

```bash
git add backend/server.js
git commit -m "feat(server): trust 1 proxy hop for X-Forwarded-* headers (Render/Vercel)"
```

---

## Task 3: Frontend env-var plumbing (`VITE_API_URL`)

**Why:** Right now your frontend's axios instance has `baseURL: '/api'` and relies on Vite's dev proxy to forward to `localhost:3001`. In production there's no Vite proxy — the Vercel-served build needs to know the actual backend URL.

**Vite's env-var convention:**
- Any env var prefixed with `VITE_` gets baked into the client bundle at build time.
- Read at runtime via `import.meta.env.VITE_API_URL`.
- They're **public** (anyone can view-source the bundle and see them) — never put secrets here.
- File precedence: `.env.production` > `.env` for prod builds; `.env.development` > `.env` for dev.

**Strategy:** Default to the dev proxy (`'/api'`) so local dev keeps working with no changes. If `VITE_API_URL` is set, use that instead. Vercel will set it; local dev won't.

**Files:**
- Modify: `frontend/src/utils/api.js`
- Create: `frontend/.env.example`

- [ ] **Step 1: Update the axios baseURL to use the env var**

In `frontend/src/utils/api.js`, change:

```js
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});
```

to:

```js
// In dev, leave VITE_API_URL unset and the Vite proxy handles forwarding /api -> backend.
// In prod, Vercel provides VITE_API_URL=https://<your-backend>.onrender.com/api
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});
```

ALSO update the one place in `api.js` that uses raw `axios` (the refresh-token retry path):

Find:

```js
const response = await axios.post('/api/auth/refresh', { refreshToken });
```

Change to:

```js
const response = await axios.post(
  `${import.meta.env.VITE_API_URL || '/api'}/auth/refresh`,
  { refreshToken }
);
```

- [ ] **Step 2: Create `frontend/.env.example`**

```env
# In local dev this file is NOT used — leave VITE_API_URL unset and Vite's dev proxy
# handles requests to /api by forwarding them to http://localhost:3001.
#
# In production (Vercel build), set VITE_API_URL to the deployed backend's API root,
# e.g. https://aift-backend.onrender.com/api
VITE_API_URL=
```

- [ ] **Step 3: Verify local dev still works**

Restart frontend (`cd frontend && npm run dev`) — Vite should pick up the change. Open `http://localhost:5173`, log in, view dashboard. Nothing should look different — local dev is using the proxy fallback.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/api.js frontend/.env.example
git commit -m "feat(frontend): support VITE_API_URL env var for prod backend address"
```

---

## Task 4: Provision MongoDB Atlas M0 (no code change)

**Why:** Render's filesystem is ephemeral and there's no managed Mongo addon on the free tier. Atlas M0 is a free, hosted MongoDB cluster you connect to from anywhere via a connection string.

**M0 limits to know:** 512 MB storage, 100 max connections, shared CPU, no backups. Plenty for a learning project. Free forever.

- [ ] **Step 1: Sign up / log in**

Go to https://www.mongodb.com/cloud/atlas. Sign up with Google (fastest) if you don't have an account.

- [ ] **Step 2: Create a cluster**

After signup you're prompted to create your first cluster:
- Cluster type: **M0** (Shared, FREE)
- Provider: AWS (any region works; pick one geographically close — Mumbai (`ap-south-1`) makes sense)
- Cluster name: `aift` (or anything)

Click "Create" — provisioning takes ~3-5 minutes.

- [ ] **Step 3: Create a database user**

When prompted (or via *Database Access* in the left nav):
- Auth method: Password
- Username: `aift-app`
- Password: click "Autogenerate Secure Password" and **copy it somewhere temporarily** — you'll need it in step 5.
- Database user privileges: "Read and write to any database"
- Click "Add User"

- [ ] **Step 4: Set network access**

Left nav → *Network Access* → "Add IP Address":
- Choose "**Allow Access from Anywhere**" → enters `0.0.0.0/0`
- Comment: `learning project — Render egress IPs are dynamic`
- Click "Confirm"

> **Tradeoff acknowledged:** for a real app this is too open. Production solutions: VPC peering (M10+ paid tier), AWS PrivateLink, or moving back to a fixed-IP provider. For a learning project with no real users, this is fine. Will revisit in Phase 7 if it ever matters.

- [ ] **Step 5: Get the connection string**

Left nav → *Database* → "Connect" button on your cluster → "Drivers" → Node.js latest. Copy the connection string. It looks like:

```
mongodb+srv://aift-app:<password>@aift.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

Replace `<password>` with the password from step 3, and add the database name (`/aift`) before the `?`:

```
mongodb+srv://aift-app:YOUR_PASSWORD@aift.xxxxx.mongodb.net/aift?retryWrites=true&w=majority
```

**Save this string in a notes file or password manager — Render needs it in Task 5.**

- [ ] **Step 6: (Optional) verify connectivity from your local machine**

```bash
mongosh "mongodb+srv://aift-app:YOUR_PASSWORD@aift.xxxxx.mongodb.net/aift?retryWrites=true&w=majority" --quiet --eval "db.runCommand({ping: 1})"
# expect: { ok: 1 }
```

If that works, your URI is good and the network rule is correct.

- [ ] **Step 7: Note — no commit for this task**

Atlas setup happens in their dashboard; nothing in your repo changes.

---

## Task 5: Deploy backend to Render

**Why:** Render free tier gives you Docker-based web service hosting with automatic HTTPS, GitHub integration, and zero config beyond the Dockerfile + env vars. Cold starts after 15min idle (free-tier quirk) — fine for a learning project.

**Render free-tier characteristics:**
- 512 MB RAM, 0.1 CPU
- Spins down after 15 min of inactivity (cold start ~30s on first request after sleep)
- 750 hours/month free (enough for 1 always-on service if you stay under)
- Auto-deploys on `git push` to your tracked branch

- [ ] **Step 1: Sign up at Render**

https://render.com → "Get Started" → continue with GitHub (fastest — auto-grants repo access). Authorize Render for the repo.

- [ ] **Step 2: New web service**

Dashboard → "New +" → "Web Service" → connect your `Ayushhj21/AI-Finance-Tracker` repo.

- [ ] **Step 3: Configure the service**

| Field | Value | Why |
|---|---|---|
| Name | `aift-backend` | Becomes part of your URL: `https://aift-backend.onrender.com` |
| Region | Singapore (`Singapore`) or Frankfurt — pick closest to you | Latency |
| Branch | `main` | Auto-deploys on push to main |
| Root Directory | `backend` | Critical — tells Render to build from `backend/Dockerfile`, not repo root |
| Runtime | **Docker** | Render auto-detects, but verify |
| Instance Type | **Free** | $0/month |
| Health Check Path | `/api/health` | Render won't route traffic until this returns 200 |

- [ ] **Step 4: Set environment variables**

Scroll down to "Environment Variables" — click "Add Environment Variable" for each:

| Key | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Switches morgan to combined-log format (Phase 0 / Task 7) |
| `MONGODB_URI` | (paste from Task 4 step 5) | The full Atlas connection string |
| `JWT_ACCESS_SECRET` | run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` locally and paste | New secret — DON'T reuse your local one |
| `JWT_REFRESH_SECRET` | same command, different value | Same |
| `JWT_ACCESS_EXPIRATION` | `15m` | (or omit — code defaults to 15m) |
| `JWT_REFRESH_EXPIRATION` | `7d` | (or omit — code defaults to 7d) |
| `GEMINI_API_KEY` | your rotated Gemini key | The one you rotated on 2026-04-28 |
| `CLOUDINARY_CLOUD_NAME` | from Cloudinary dashboard | Optional — only if testing receipts |
| `CLOUDINARY_API_KEY` | from Cloudinary dashboard | Optional |
| `CLOUDINARY_API_SECRET` | from Cloudinary dashboard | Optional |
| `FRONTEND_URL` | `https://<your-vercel-url>.vercel.app` | We'll come back and set this in Task 6 once Vercel gives us the URL — for now leave blank or use a placeholder |

> **Don't set `PORT`** — Render injects this automatically. Your `process.env.PORT || 5000` will pick up Render's value.

- [ ] **Step 5: Deploy**

Click "Create Web Service" at the bottom. Render starts pulling your repo and building the Docker image. Watch the live log stream — should see:
```
==> Cloning from https://github.com/Ayushhj21/AI-Finance-Tracker
==> Building Docker image...
... (npm ci output) ...
==> Pushing image to Render registry
==> Starting service...
Connected to MongoDB
🚀 Server running on port <random>
==> Your service is live 🎉
```

This takes 3-5 min on first deploy. Subsequent deploys are faster due to layer caching.

- [ ] **Step 6: Test the deployed health endpoint**

The service URL is shown at the top of the page, e.g. `https://aift-backend.onrender.com`. Hit it from your terminal:

```bash
curl -i -s https://aift-backend.onrender.com/api/health
```

Expected: `HTTP/2 200`, body `{"status":"ok","db":"connected","uptime":...}`.

If you get `503` with `db:"disconnected"` or `connecting`, the `MONGODB_URI` env var is wrong (typo, password not URL-encoded, or Atlas IP rule not applied).

- [ ] **Step 7: Note your backend URL — Vercel needs it**

Save it: `https://aift-backend.onrender.com` (yours will be similar).

- [ ] **Step 8: No commit for this task**

External setup — your repo doesn't change.

---

## Task 6: Deploy frontend to Vercel

**Why:** Vercel hosts static sites (the React build output) on a global CDN with auto-HTTPS. Free for personal projects. Reads from GitHub, auto-deploys on push.

- [ ] **Step 1: Sign up at Vercel**

https://vercel.com → "Sign Up" → continue with GitHub.

- [ ] **Step 2: Import the project**

Dashboard → "Add New..." → "Project" → select your `AI-Finance-Tracker` repo → "Import".

- [ ] **Step 3: Configure the build**

| Field | Value |
|---|---|
| Framework Preset | **Vite** |
| Root Directory | `frontend` |
| Build Command | `npm run build` (auto-detected) |
| Output Directory | `dist` (auto-detected) |
| Install Command | `npm install` (auto-detected) |

- [ ] **Step 4: Set the env var**

Expand "Environment Variables" — add ONE:

| Key | Value | Environments |
|---|---|---|
| `VITE_API_URL` | `https://aift-backend.onrender.com/api` | Production (and Preview, optional) |

(Use the URL from Task 5 step 7. Note the `/api` suffix.)

- [ ] **Step 5: Deploy**

Click "Deploy". Vercel builds and ships in ~1-2 min. The deployment page shows the URL: `https://ai-finance-tracker-xxx.vercel.app`.

- [ ] **Step 6: Update Render's `FRONTEND_URL` env var**

Now that you have a Vercel URL, go back to Render dashboard → your service → Environment → set:

```
FRONTEND_URL=https://ai-finance-tracker-xxx.vercel.app
```

(Use your real Vercel URL.) Click "Save Changes" — Render will trigger a redeploy automatically (takes ~1 min).

This sets up CORS correctly so the Vercel-hosted frontend can talk to the Render-hosted backend.

- [ ] **Step 7: No commit for this task**

External setup again. Repo unchanged.

---

## Task 7: End-to-end smoke test on prod URLs

**Why:** Each piece (Atlas, Render backend, Vercel frontend) was verified individually. This task confirms they all talk to each other in the chain that matters: browser → Vercel → Render → Atlas, and back.

- [ ] **Step 1: Open the Vercel URL in your browser**

`https://ai-finance-tracker-xxx.vercel.app` — should load the login page.

- [ ] **Step 2: Open DevTools → Network tab**

Keep it open. Every action below should make a request to `https://aift-backend.onrender.com/api/...` (NOT `/api/...` to the Vercel domain).

- [ ] **Step 3: Register a fresh user**

Click "Sign up". Use any email (it's not validated by the backend — `you@example.com` is fine). Use a real password since you'll log back in.

Expected: registration succeeds, redirected to dashboard. Look at the Network tab — `POST https://aift-backend.onrender.com/api/auth/register` returned `201`.

- [ ] **Step 4: Add a transaction**

Open the transaction modal, type a description like `"Coffee at Starbucks"`, click "AI" — should set `Food & Drinks`. Submit.

Expected: `POST .../api/transactions` returns `201`. Transaction appears on the dashboard.

- [ ] **Step 5: Hit the deployed health check directly**

```bash
curl -s https://aift-backend.onrender.com/api/health | python3 -m json.tool
# expect: status ok, db connected, uptime that has been ticking up
```

- [ ] **Step 6: Verify HSTS is now in effect**

```bash
curl -i -s https://aift-backend.onrender.com/api/health | grep -i strict-transport
# expect: Strict-Transport-Security: max-age=31536000; includeSubDomains
```

That helmet header now actually means something — the browser will refuse to talk to your backend over plain HTTP for the next year.

- [ ] **Step 7: (Optional) refresh the page and look at the cold-start behavior**

Wait 15-20 minutes without using the site, then refresh. The first request will take ~20-30 seconds (Render is spinning the container back up). Subsequent requests are instant. **This is the free-tier behavior** — paid tiers stay always-on.

- [ ] **Step 8: No commit — this is validation only**

---

## Task 8: Update README with deploy section

**Why:** The README currently says "Status: Phase 0." Now it's wrong — we're deployed. Update it to reflect Phase 1 completion and add a "Live demo" section so anyone landing on the repo can see the running app.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the status banner**

Near the top of `README.md`, change:

```markdown
> **Status:** Phase 0 of 8 — pre-deploy hygiene complete.
```

to:

```markdown
> **Status:** Phase 1 of 8 — deployed live on free-tier infrastructure.
>
> **Live URL:** https://ai-finance-tracker-xxx.vercel.app *(Render free tier — first request after 15min idle takes ~30s to wake the backend)*
```

(Use your actual Vercel URL.)

- [ ] **Step 2: Add a "Deployment" section**

Insert this section just before the "Roadmap" section:

```markdown
## Deployment

Currently deployed on free-tier infrastructure as part of Phase 1 of the roadmap. AWS App Runner migration is planned for a later phase.

```
┌──────────────┐         ┌────────────────────────┐
│   Vercel     │  HTTPS  │  Render free web       │
│  (React CDN) │ ──────> │  service (Docker)      │
│              │         │  https://...onrender   │
└──────────────┘         └───────────┬────────────┘
                                     │ TLS
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
```

- [ ] **Step 3: Update the roadmap table — mark Phase 1 done**

Find the roadmap table in the README and change the Phase 1 row's status from blank to **Done**:

```markdown
| **1** | Get it live — Docker, MongoDB Atlas, Render web service, Vercel, custom domain | **Done** |
```

(Optionally also note in the row that this was Path B / Render-first, with App Runner pending.)

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): mark Phase 1 done, add live URL and deployment service map"
```

When you push this commit, Render and Vercel will auto-deploy from the new HEAD (no behavior change since it's a docs-only commit).

---

## Task 9: (OPTIONAL) Replace Cloudinary with S3

**Why this is optional:** S3 requires an AWS account, which is the friction we deliberately deferred by choosing Path B. Skip this task entirely if you'd rather not deal with AWS yet — Cloudinary works fine. Come back to it later in a "Phase 1.5" focused on AWS basics.

If you DO want to do it now, the learning is good: you'll touch IAM (creating a programmatic user with scoped permissions), bucket policies, and the **pre-signed URL pattern** (the canonical S3-from-frontend upload approach).

> **For brevity, this task is sketched at high level rather than step-by-step.** When you're ready to execute it, ask Claude to expand it into the same task-by-task format as Tasks 1-8.

**High-level steps:**

1. AWS account creation, MFA, payment method, billing alarm at $5.
2. Create S3 bucket `aift-receipts-<random-suffix>` in the same region as your AWS focus, with CORS rules permitting `PUT` from your Vercel domain.
3. Create IAM user `aift-backend-s3` with policy allowing `PutObject`, `GetObject`, `DeleteObject` ONLY on that bucket. Generate access key.
4. Add 4 env vars to Render: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`.
5. `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` in `backend/`.
6. Create `backend/services/s3Service.js` with two functions: `getUploadUrl(filename, contentType)` returning a pre-signed PUT URL, and `deleteObject(key)` for cleanup.
7. Modify `backend/controllers/transactionController.js`:
   - Replace `uploadReceipt` with a flow where the FRONTEND requests a pre-signed URL, uploads directly to S3, then `PUT`s the resulting S3 key back to the backend.
   - Update delete-transaction to call `s3Service.deleteObject` instead of `cloudinary.uploader.destroy`.
8. Update `backend/.env.example` with the new AWS vars; remove the Cloudinary block (or keep with a comment "deprecated by Task 9 of Phase 1").
9. Update frontend's receipt-upload flow in `TransactionModal.jsx` to do the two-step (request URL → PUT to S3).
10. End-to-end test: upload a receipt from the deployed frontend, confirm it lands in the S3 bucket and renders back via signed-GET URL.

**Concept this teaches (preview):**
- **Pre-signed URLs** are short-lived URLs the backend signs with its credentials, granting a specific operation (e.g., `PUT object foo.jpg`) for a window of time. The frontend uses them to upload directly to S3 *without ever seeing your AWS credentials*. This is the canonical pattern for "backend-issued, frontend-executed" uploads, and it generalizes to many cloud providers.
- **Least-privilege IAM** — the `aift-backend-s3` user can ONLY touch this one bucket. Compromise of those keys doesn't escalate.

When you're ready, ask Claude to expand this into a step-by-step plan.

---

## End-of-phase verification

Once Tasks 1-8 are done (Task 9 optional), confirm:

- [ ] `https://ai-finance-tracker-xxx.vercel.app` loads in a browser; you can register and log in.
- [ ] `curl -i https://aift-backend.onrender.com/api/health` returns `HTTP/2 200` with all helmet headers (HSTS now meaningful).
- [ ] Pushing a commit to `main` triggers automatic redeploys on both Render and Vercel (you can verify by looking at their dashboards' Deployments tabs).
- [ ] `git log --oneline origin/main..HEAD` is empty (everything pushed).
- [ ] README on GitHub shows the new deployment section + live URL.
- [ ] No new secrets accidentally committed (`git log -p main -- backend/.env frontend/.env` should show nothing).

## What's next — Phase 2

With AIFT live, the next phase is **Backend hardening**: refresh token rotation, rate limiting (now that we have real `req.ip` from `trust proxy`), Zod validation, structured logging with `pino`, centralized error handling. That's the meatiest phase by code change but very rewarding — your backend will look like a "real" production codebase by the end.

If you do Task 9 (S3) you're effectively starting Phase 1.5 / your AWS sub-mission. Either order works; Phase 2 doesn't depend on S3 being done.

## Self-review notes

- Spec coverage: All 7 spec items from §6 Phase 1 are addressed (Docker ✓, Atlas ✓, public deploy ✓, frontend hosting ✓, S3 ✓ optional, custom domain noted as further-optional, README ✓). Adjustments per "no real users" memory applied (no demo seed user).
- No `TBD` placeholders in mandatory tasks. Task 9 is intentionally a sketch and says so.
- Tradeoffs called out explicitly: 0.0.0.0/0 IP rule, free-tier cold start, Cloudinary kept by default.
- Approval policy referenced at the top so each task is its own gate.
