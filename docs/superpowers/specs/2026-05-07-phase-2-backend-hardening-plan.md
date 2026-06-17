# Phase 2 — Backend Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the deployed-but-rough backend from Phase 1 and harden it the way real production apps are hardened — without introducing new infrastructure (Redis lives in Phase 3). After this phase the backend has structured logging, consistent error responses, schema-validated input, rate limiting, and cookie-based auth with token rotation.

**Architecture:** No new services. All work is in the existing Express app: replace `morgan` with `pino`, add a `validate(schema)` middleware, an `AppError` class + global error handler, refresh token rotation, httpOnly cookies + CSRF, and `express-rate-limit` (in-memory). The "user surface" stays identical (login, dashboard, etc. all keep working) — what changes is what happens *inside* the chain.

**Tech Stack added:** `pino`, `pino-http`, `zod`, `express-rate-limit`. No infrastructure additions.

**Approval policy:** Same as previous phases — each task is its own approval gate. The auth changes (Tasks 6-8) are the highest-risk and can break existing sessions; they get extra care.

---

## Source spec

`docs/superpowers/specs/2026-04-28-backend-leveling-up-roadmap-design.md` §6 Phase 2.

Adjustments based on context developed since:
- **No real users:** breaking existing localStorage-stored sessions is fine — only Ayush will be re-logging-in. Reduces deployment caution but not code caution.
- **Phase 1 lessons:** the AI 503 silent fallback (`Other Expense`) gets fixed as part of Task 2 (centralized error handling). The login crash on missing `req.body` gets fixed as part of Task 3 (Zod validation).
- **Redis deferred:** Phase 3 brings Redis. Rate limiting and token blacklist use in-memory stores in Phase 2; we'll swap to Redis-backed stores in Phase 3 with minimal code change.

## File map

| File | Touched in task | Type |
|---|---|---|
| `backend/utils/logger.js` | 1 | create |
| `backend/server.js` | 1, 2, 4, 5, 7 | modify |
| `backend/services/aiService.js` | 1 | modify (replace `console.log` with logger calls) |
| `backend/utils/errors.js` | 2 | create |
| `backend/utils/asyncHandler.js` | 2 | create |
| `backend/middleware/errorHandler.js` | 2 | create |
| `backend/controllers/*.js` | 2, 3 | modify (wrap exports in asyncHandler; remove try/catch boilerplate) |
| `backend/middleware/validate.js` | 3 | create |
| `backend/schemas/auth.js`, `transaction.js`, `budget.js`, `savingsGoal.js`, `notification.js`, `ai.js` | 3 | create (Zod schemas) |
| `backend/routes/*.js` | 3 | modify (wire validate middleware into each route) |
| `backend/middleware/rateLimit.js` | 5 | create |
| `backend/utils/jwtutils.js` | 6 | modify (rotation logic / better expiration handling) |
| `backend/controllers/authController.js` | 6, 7 | modify (rotation; cookie set/clear) |
| `backend/middleware/authMiddleware.js` | 7 | modify (read JWT from cookie OR header for compat) |
| `backend/middleware/csrf.js` | 7 | create |
| `backend/utils/tokenBlacklist.js` | 8 | create (in-memory Set with TTL; Redis-backed in Phase 3) |
| `frontend/src/utils/api.js` | 7 | modify (add `withCredentials: true` to axios; remove Authorization header injection; handle CSRF token) |
| `frontend/src/stores/authStore.js` | 7 | modify (no longer stores tokens — tracks isAuthenticated only) |

## Tasks at a glance

1. **Structured logging with `pino` + request IDs** — replaces `morgan`, adds JSON logs + per-request `X-Request-ID`
2. **Centralized error handling** — `AppError`, `asyncHandler`, single error middleware, consistent `{success, code, message, requestId}` shape
3. **Zod validation across all routes** — fixes crash-on-missing-body, replaces ad-hoc `if (!field)` checks
4. **Security middleware audit** — helmet config tweaks, CORS allowlist (env-driven), request size limits
5. **Rate limiting** — `express-rate-limit` in-memory; stricter for auth routes
6. **Refresh token rotation** — single-use refresh tokens (server invalidates old on each use)
7. **httpOnly cookies + CSRF protection** — tokens move out of localStorage; double-submit-token CSRF
8. **Token blacklist on logout** — in-memory Set with TTL (becomes Redis-backed in Phase 3)

Total expected commits: ~10-14 (some tasks produce 2 commits — one for infrastructure, one for wiring).

---

## Task 1: Structured logging with `pino` + request IDs

**Why first:** before any other change, get visibility. `morgan` gives you "request landed, returned 200, took 5ms." `pino` gives you structured JSON logs with arbitrary context, log levels, redaction of sensitive fields, and the ability to attach a request ID that follows a request through every log line in the controller chain. Searchable in CloudWatch / Datadog / wherever; impossible to extract from `morgan`'s plain-text output.

**Concept:** structured logging is the foundation of observability. Plain text logs are for humans; structured logs are for machines (and humans, with a pretty-printer). Every Phase 6 metric and Phase 5 test will benefit from being able to filter logs by `level`, `requestId`, `userId`, `route`.

**Files:**
- Create: `backend/utils/logger.js`
- Modify: `backend/server.js` (replace morgan, add `pino-http`)
- Modify: `backend/services/aiService.js` (replace `console.log`/`console.error` with logger calls)
- Modify: `backend/package.json` (add `pino`, `pino-http`)

- [x] **Step 1: Install dependencies**

```bash
cd backend
npm install pino pino-http
```

- [x] **Step 2: Create `backend/utils/logger.js`**

```js
import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

export const logger = pino({
    level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.refreshToken',
            'res.headers["set-cookie"]'
        ],
        censor: '[REDACTED]'
    },
    ...(isProd ? {} : {
        transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard' }
        }
    })
});
```

- [x] **Step 3: Install `pino-pretty` as a devDependency for local dev**

```bash
npm install --save-dev pino-pretty
```

(Production uses raw JSON; local dev gets a colored, human-friendly format.)

- [x] **Step 4: Wire pino-http in `server.js`**

Replace the morgan import + line:

```js
// remove
import morgan from 'morgan';
// remove
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
```

with:

```js
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import { logger } from './utils/logger.js';

app.use(pinoHttp({
    logger,
    genReqId: (req) => req.headers['x-request-id'] || randomUUID(),
    customLogLevel: (req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
    },
    customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
    customErrorMessage: (req, res, err) => `${req.method} ${req.url} errored: ${err?.message}`
}));

// expose request ID in the response so clients can include it when reporting issues
app.use((req, res, next) => {
    res.setHeader('X-Request-ID', req.id);
    next();
});
```

- [x] **Step 5: Replace `console.log` / `console.error` in `aiService.js`**

Import logger at the top:
```js
import { logger } from './utils/logger.js';
```

Then replace each `console.log(...)` with `logger.info({ ... })` and each `console.error(...)` with `logger.error({ err }, '...')`. Example:

```js
// before:
console.log("Gemini API response status:", response.status);
// after:
logger.info({ status: response.status }, 'gemini call complete');

// before:
console.error('Categorization error:', error);
// after:
logger.error({ err: error }, 'gemini categorization failed');
```

- [x] **Step 6: Remove the `dotenv` startup banners (optional)**

Add `quiet: true` to `dotenv.config()` calls if the dotenv-injecting-env tip lines feel noisy:

```js
dotenv.config({ quiet: true });
```

- [x] **Step 7: Verify locally**

Restart backend. Hit `/api/health`. Backend terminal should now print colored, structured logs:

```
[10:23:14.123] INFO: GET /api/health 200
    req: { ... }
    res: { ... }
    responseTime: 4
```

In production (Render), logs will be JSON one-per-line:
```
{"level":30,"time":...,"reqId":"...","method":"GET","url":"/api/health","statusCode":200,"msg":"GET /api/health 200"}
```

`curl -i .../api/health` should now include `X-Request-ID: <uuid>` in the response headers.

- [x] **Step 8: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/utils/logger.js backend/server.js backend/services/aiService.js
git commit -m "feat(logging): replace morgan with pino + request IDs"
```

---

## Task 2: Centralized error handling

**Why:** Every controller currently has the same `try { ... } catch (error) { res.status(500).json({success: false, message: ...}) }` pattern. This is duplicate code, inconsistent error shapes, and impossible to extend (e.g., to log + format errors uniformly). Express has a built-in error pipeline — anything thrown gets routed to "error middleware" (a function with `(err, req, res, next)`). We'll lean into that.

**Three pieces:**
1. **`AppError` class** — known errors that have a status code and a message. Throwing one = "express handles this."
2. **`asyncHandler` wrapper** — async route handlers naturally throw, but Express doesn't catch unhandled promise rejections in async middleware. Wrapping the controller in `asyncHandler` ensures promise rejections are forwarded to the error middleware via `next(err)`.
3. **Error middleware** — turns `AppError` (and unknown errors) into consistent JSON responses with shape `{ success: false, code, message, requestId }`.

**Files:**
- Create: `backend/utils/errors.js`, `backend/utils/asyncHandler.js`, `backend/middleware/errorHandler.js`
- Modify: every controller in `backend/controllers/*.js` (remove try/catch, throw `AppError`, wrap exports)
- Modify: `backend/server.js` (mount errorHandler last)

- [x] **Step 1: Create `backend/utils/errors.js`**

```js
export class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export const NotFound = (resource = 'Resource') =>
    new AppError(`${resource} not found`, 404, 'NOT_FOUND');

export const BadRequest = (message = 'Invalid request') =>
    new AppError(message, 400, 'BAD_REQUEST');

export const Unauthorized = (message = 'Not authorized') =>
    new AppError(message, 401, 'UNAUTHORIZED');

export const Forbidden = (message = 'Forbidden') =>
    new AppError(message, 403, 'FORBIDDEN');

export const Conflict = (message = 'Conflict') =>
    new AppError(message, 409, 'CONFLICT');
```

- [x] **Step 2: Create `backend/utils/asyncHandler.js`**

```js
// Wraps an async route handler so any thrown error is forwarded to Express's error middleware
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
```

- [x] **Step 3: Create `backend/middleware/errorHandler.js`**

```js
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';

export const errorHandler = (err, req, res, next) => {
    // Map known errors to AppError shape
    let appErr;
    if (err instanceof AppError) {
        appErr = err;
    } else if (err instanceof ZodError) {
        appErr = new AppError(err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '), 400, 'VALIDATION_ERROR');
    } else if (err instanceof mongoose.Error.ValidationError) {
        appErr = new AppError(Object.values(err.errors).map(e => e.message).join('; '), 400, 'VALIDATION_ERROR');
    } else if (err.code === 11000) {
        appErr = new AppError('Resource already exists', 409, 'CONFLICT');
    } else if (err instanceof jwt.JsonWebTokenError) {
        appErr = new AppError('Invalid or expired token', 401, 'UNAUTHORIZED');
    } else {
        appErr = new AppError(
            process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
            500,
            'INTERNAL_ERROR'
        );
    }

    // Log at appropriate level — operational errors are warnings, programmer errors are errors
    const logLevel = appErr.statusCode >= 500 ? 'error' : 'warn';
    req.log[logLevel]({ err, statusCode: appErr.statusCode, code: appErr.code }, 'request error');

    res.status(appErr.statusCode).json({
        success: false,
        code: appErr.code,
        message: appErr.message,
        requestId: req.id
    });
};
```

- [x] **Step 4: Refactor one controller as a template — `authController.js`**

Replace the body of `register`, `login`, `refreshToken`, `logout`, `getCurrentUser` with throw-based versions wrapped in `asyncHandler`. Example for `login`:

```js
import { asyncHandler } from '../utils/asyncHandler.js';
import { Unauthorized } from '../utils/errors.js';

export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user) throw Unauthorized('Invalid email or password');
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) throw Unauthorized('Invalid email or password');

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
        success: true,
        message: 'Login successful',
        data: {
            user: { id: user._id, name: user.name, email: user.email },
            accessToken,
            refreshToken
        }
    });
});
```

Apply the same shape to all five exports. Notice the absence of `try/catch` and the absence of `res.status(500)` calls — anything thrown lands in `errorHandler`.

- [x] **Step 5: Repeat for the other 5 controllers**

Apply the same refactor to:
- `transactionController.js` (largest — 6 exports)
- `budgetController.js` (5 exports)
- `savingsGoalController.js` (6 exports)
- `analyticsController.js` (5 exports)
- `notificationController.js` (5 exports)
- `aiController.js` (5 exports)

Goal: zero `try/catch` blocks (except where genuinely needed for fallback logic, e.g., the AI categorize fallback). All known error paths use `throw NotFound(...)` / `throw BadRequest(...)` / `throw Unauthorized(...)`.

- [x] **Step 6: Mount the error handler in `server.js`**

Just BEFORE the existing `app.use((err, req, res, next) => { ... })` block at the bottom, replace that block with:

```js
import { errorHandler } from './middleware/errorHandler.js';
app.use(errorHandler);
```

(Express identifies error middleware by its 4-arg signature, so it MUST be mounted after all routes.)

- [x] **Step 7: Verify**

Trigger a known error case. Examples:
```bash
# missing body — should now return 400 with a clear message instead of crashing
curl -i -s -X POST http://localhost:3001/api/auth/login -H 'content-type: application/json'
# expect: 400 BAD_REQUEST or 400 VALIDATION_ERROR with shape {success: false, code, message, requestId}

# bad credentials — should return 401 with our error shape
curl -i -s -X POST http://localhost:3001/api/auth/login -H 'content-type: application/json' -d '{"email":"x","password":"x"}'
# expect: 401 UNAUTHORIZED with our shape
```

Backend log should show a `warn`-level entry with the same requestId as the response header.

- [x] **Step 8: Commit (probably 2 commits)**

Suggested split:
- One commit for the error infrastructure (`errors.js`, `asyncHandler.js`, `errorHandler.js`, `server.js` wiring)
- One commit for the controller refactor

---

## Task 3: Zod validation across all routes

**Why:** Right now controllers manually check `if (!email) return res.status(400)...`. This is duplicate code, easy to forget, and silent when the body is shaped wrong. Zod (or any schema validator) makes the route's input contract a single source of truth: the schema is also the documentation.

**Files:**
- Create: `backend/middleware/validate.js`
- Create: `backend/schemas/auth.js`, `transaction.js`, `budget.js`, `savingsGoal.js`, `notification.js`, `ai.js`
- Modify: `backend/routes/*.js` (wire `validate(schema)` per route)
- Modify: controllers that did manual validation (remove the `if (!field)` lines)

- [x] **Step 1: Install Zod**

```bash
cd backend && npm install zod
```

- [x] **Step 2: Create `backend/middleware/validate.js`**

```js
import { ZodError } from 'zod';

// validate(schema) returns a middleware. Schema can validate body, query, or params.
// Usage: validate({ body: registerSchema })
export const validate = (schemas) => (req, res, next) => {
    try {
        if (schemas.body) req.body = schemas.body.parse(req.body);
        if (schemas.query) req.query = schemas.query.parse(req.query);
        if (schemas.params) req.params = schemas.params.parse(req.params);
        next();
    } catch (err) {
        next(err); // ZodError is recognized by errorHandler
    }
};
```

- [x] **Step 3: Write schemas — start with auth**

`backend/schemas/auth.js`:
```js
import { z } from 'zod';

export const registerSchema = z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    password: z.string().min(6).max(100),
    currency: z.enum(['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CNY']).optional()
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
});

export const refreshSchema = z.object({
    refreshToken: z.string().min(1)
});
```

- [x] **Step 4: Write schemas for the other domains**

`backend/schemas/transaction.js`:
```js
import { z } from 'zod';

const CATEGORIES = z.enum([
    'Food & Drinks', 'Transportation', 'Shopping', 'Entertainment',
    'Bills & Utilities', 'Healthcare', 'Education', 'Travel',
    'Groceries', 'Rent', 'Insurance', 'Personal Care', 'Other Expense',
    'Salary', 'Freelance', 'Investment', 'Gift', 'Other Income'
]);

export const createTransactionSchema = z.object({
    type: z.enum(['income', 'expense']),
    amount: z.number().positive(),
    category: CATEGORIES,
    description: z.string().max(500).optional(),
    date: z.coerce.date(),
    isRecurring: z.boolean().optional(),
    recurringFrequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).nullable().optional()
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const listTransactionsQuerySchema = z.object({
    type: z.enum(['income', 'expense']).optional(),
    category: CATEGORIES.optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    minAmount: z.coerce.number().optional(),
    maxAmount: z.coerce.number().optional(),
    search: z.string().optional(),
    limit: z.coerce.number().int().positive().max(500).optional()
});

export const idParamSchema = z.object({
    id: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id')
});
```

(Define similar for `budget.js`, `savingsGoal.js`, `notification.js`, `ai.js`. Define a shared `categories.js` so the list isn't duplicated yet again.)

- [x] **Step 5: Wire schemas into routes — example for auth**

`backend/routes/authroutes.js`:
```js
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, refreshSchema } from '../schemas/auth.js';

router.post('/register', validate({ body: registerSchema }), register);
router.post('/login', validate({ body: loginSchema }), login);
router.post('/refresh', validate({ body: refreshSchema }), refreshToken);
```

Apply across all 7 route files.

- [x] **Step 6: Remove now-redundant validation in controllers**

Wherever a controller does `if (!email) return res.status(400)...` for a field the schema already requires, delete it. Schema's job now.

- [x] **Step 7: Verify**

```bash
# Bad email → 400 VALIDATION_ERROR
curl -i -s -X POST http://localhost:3001/api/auth/register \
    -H 'content-type: application/json' \
    -d '{"name":"X","email":"not-an-email","password":"abc"}'
# expect: 400 VALIDATION_ERROR with field-level messages

# Missing field → 400
curl -i -s -X POST http://localhost:3001/api/auth/login \
    -H 'content-type: application/json' \
    -d '{"email":"a@b.c"}'
# expect: 400 with "password: Required" or similar
```

- [x] **Step 8: Commit**

```bash
git add backend/middleware/validate.js backend/schemas backend/routes backend/controllers backend/package.json backend/package-lock.json
git commit -m "feat(validation): zod schemas at every route boundary"
```

---

## Task 4: Security middleware audit

**Why:** Phase 0 added `helmet()` with default settings. Worth auditing whether those defaults are right for an API-only backend (no HTML responses), and worth tightening other defaults (CORS allowlist, body size limit).

**Files:**
- Modify: `backend/server.js`

- [x] **Step 1: Tighten CORS to an allowlist**

Change:
```js
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
```

to:
```js
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map(s => s.trim());

app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true); // allow tools like curl with no Origin
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
```

This lets you set `ALLOWED_ORIGINS=https://aift-prod.vercel.app,https://staging.vercel.app` later when you have multiple environments.

- [x] **Step 2: Body size limits**

Change:
```js
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
```

to:
```js
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
```

(100kb is generous for any of our actual endpoints. Receipts go through multer with its own limit.)

- [x] **Step 3: Verify**

```bash
# Bad origin → CORS rejection
curl -i -s http://localhost:3001/api/health -H "Origin: https://evil.example.com"
# expect: response WITHOUT access-control-allow-origin header

# Body too large → 413
curl -i -s -X POST http://localhost:3001/api/auth/login \
    -H 'content-type: application/json' \
    --data-binary @<(node -e "console.log(JSON.stringify({email:'a@b.c', password: 'p', x: 'A'.repeat(200000)}))")
# expect: 413 Payload Too Large
```

- [x] **Step 4: Commit**

```bash
git add backend/server.js
git commit -m "feat(security): CORS allowlist (env-driven), 100kb body size limit"
```

---

## Task 5: Rate limiting

**Why:** Without rate limiting, brute-force attacks (login attempts) are unbounded. With `trust proxy` set in Phase 1, `req.ip` is now the real client IP — meaningful basis for per-IP throttling.

**Files:**
- Create: `backend/middleware/rateLimit.js`
- Modify: `backend/server.js`, `backend/routes/authroutes.js`

- [x] **Step 1: Install**

```bash
cd backend && npm install express-rate-limit
```

- [x] **Step 2: Create `backend/middleware/rateLimit.js`**

```js
import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/errors.js';

const handler = (req, res, next) => {
    next(new AppError('Too many requests, please try again later', 429, 'RATE_LIMITED'));
};

// General API: 100 req / 15min per IP
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler
});

// Auth routes: 5 req / 15min per IP — stricter to mitigate credential stuffing
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler
});
```

- [x] **Step 3: Apply globally to /api/* and override for auth**

In `server.js`:
```js
import { apiLimiter } from './middleware/rateLimit.js';
// ... after helmet/morgan/cors/body parsers
app.use('/api', apiLimiter);
```

In `routes/authroutes.js`:
```js
import { authLimiter } from '../middleware/rateLimit.js';
router.post('/login', authLimiter, validate({ body: loginSchema }), login);
router.post('/register', authLimiter, validate({ body: registerSchema }), register);
router.post('/refresh', authLimiter, validate({ body: refreshSchema }), refreshToken);
```

- [x] **Step 4: Verify**

```bash
for i in {1..10}; do curl -s -o /dev/null -w "%{http_code} " -X POST http://localhost:3001/api/auth/login \
    -H 'content-type: application/json' -d '{"email":"x@y.z","password":"x"}'; done; echo
# expect: first 5 → 401, then 429 RATE_LIMITED
```

> **Phase 3 swap:** rate-limit's default in-memory store is per-process. With multiple Render instances later, throttling would be per-instance. Phase 3's Redis lets us share the counter — at that point we swap `store: new RedisStore(...)`.

- [x] **Step 5: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/middleware/rateLimit.js backend/server.js backend/routes/authroutes.js
git commit -m "feat(security): rate limiting (general + stricter auth)"
```

---

## Task 6: Refresh token rotation

**Why:** Currently when you call `/api/auth/refresh`, the server returns a new access token AND a new refresh token, but the OLD refresh token still works (until it naturally expires in 7 days). If an attacker steals a refresh token they can keep refreshing forever — even if you log in elsewhere and rotate.

**Rotation:** every refresh invalidates the previous refresh token. If the same refresh token is used twice, that's a token-replay event — invalidate the entire token family (forces a re-login).

**Files:**
- Modify: `backend/controllers/authController.js`
- Modify: `backend/utils/jwtutils.js` (add JTI claim — JWT ID — for tracking)

- [x] **Step 1: Add `jti` to refresh tokens**

In `jwtutils.js`:
```js
import { randomUUID } from 'crypto';

export const generateRefreshToken = (userId) => {
    const jti = randomUUID();
    const token = jwt.sign(
        { userId, jti },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d' }
    );
    return { token, jti };
};
```

- [x] **Step 2: Update User model**

In `Usermodel.js`, add a `refreshTokenJti` field:
```js
refreshTokenJti: { type: String, select: false }
```

- [x] **Step 3: Update login + refresh in `authController.js`**

On login: generate token, store `jti` on user.

On refresh: verify token, **check `jti` matches `user.refreshTokenJti`**. If yes → rotate (issue new pair, store new jti). If no → token replay detected → clear `user.refreshTokenJti` (force re-login) and return 401.

- [x] **Step 4: Verify**

```bash
# 1. login → get refresh1
# 2. POST /refresh with refresh1 → get refresh2 (success)
# 3. POST /refresh with refresh1 again → 401 + user.refreshTokenJti cleared in DB
# 4. POST /refresh with refresh2 → 401 (because jti was cleared in step 3 — desired security behavior)
```

- [x] **Step 5: Commit**

```bash
git commit -m "feat(auth): single-use refresh tokens with jti rotation; replay detection"
```

---

## Task 7: httpOnly cookies + CSRF protection

**Why:** Currently both tokens live in localStorage — vulnerable to XSS (any malicious script can read them). httpOnly cookies are only readable by the browser and only sent automatically with same-origin requests. To stop CSRF (now that cookies auto-send), use the **double-submit token** pattern.

**Strategy:**
- Store `accessToken` in a short-lived (15min) httpOnly cookie
- Store `refreshToken` in a longer-lived (7d) httpOnly cookie, scoped to `/api/auth/refresh`
- Backend issues a CSRF token (sent in a NON-httpOnly cookie + readable by JS); frontend reads it and includes as a header on every state-changing request; backend verifies match on POST/PUT/DELETE

**Files:**
- Modify: `backend/controllers/authController.js` (set/clear cookies on login/logout)
- Modify: `backend/middleware/authMiddleware.js` (read JWT from cookie OR Authorization header)
- Create: `backend/middleware/csrf.js`
- Modify: `frontend/src/utils/api.js` (add `withCredentials: true`, attach CSRF header)
- Modify: `frontend/src/stores/authStore.js` (no longer stores tokens — tracks `isAuthenticated` + user only)

- [x] **Step 1-N:** (detailed steps to be expanded — this task is the largest in Phase 2 and deserves a focused session)

> **For brevity, this task is sketched here.** When you're ready to execute, ask Claude to expand it into the same task-by-task format as Tasks 1-6. Approximate effort: 3-4 hours.

- [x] **Final commit**

```bash
git commit -m "feat(auth): move tokens to httpOnly cookies + CSRF double-submit token"
```

---

## Task 8: Token blacklist on logout

**Why:** Today, `POST /logout` clears `user.refreshToken` in Mongo (good — prevents future refreshes), but the access token is still valid until it naturally expires (15min). For learning purposes — and for "logout means logout" UX — we add a short-lived in-memory blacklist of access-token JTIs.

**Phase 3 swap:** the blacklist becomes a Redis SET with TTL. Phase 2's in-memory version is simpler but doesn't survive restarts and doesn't share across instances.

**Files:**
- Create: `backend/utils/tokenBlacklist.js`
- Modify: `backend/utils/jwtutils.js` (add JTI to access tokens too)
- Modify: `backend/middleware/authMiddleware.js` (check blacklist)
- Modify: `backend/controllers/authController.js` (push to blacklist on logout)

- [x] **Step 1: Create `backend/utils/tokenBlacklist.js`**

```js
// Simple in-memory map of jti → expiresAt(ms). Cleared on process restart.
// Phase 3 will replace with a Redis SET keyed by jti, with TTL = remaining token lifetime.
const blacklist = new Map();

export const revoke = (jti, expiresAt) => {
    blacklist.set(jti, expiresAt);
};

export const isRevoked = (jti) => {
    const exp = blacklist.get(jti);
    if (!exp) return false;
    if (Date.now() > exp) {
        blacklist.delete(jti);
        return false;
    }
    return true;
};

// Periodic cleanup so the map doesn't grow forever
setInterval(() => {
    const now = Date.now();
    for (const [jti, exp] of blacklist) if (exp < now) blacklist.delete(jti);
}, 60_000);
```

- [x] **Step 2: Add jti to access tokens**

```js
export const generateAccessToken = (userId) => {
    const jti = randomUUID();
    const token = jwt.sign({ userId, jti }, process.env.JWT_ACCESS_SECRET, {
        expiresIn: process.env.JWT_ACCESS_EXPIRATION || '15m'
    });
    return { token, jti };
};
```

- [x] **Step 3: Check blacklist in authMiddleware**

After verifying the token, before setting `req.user`:
```js
import { isRevoked } from '../utils/tokenBlacklist.js';

if (isRevoked(decoded.jti)) {
    throw Unauthorized('Token has been revoked');
}
```

- [x] **Step 4: Push to blacklist on logout**

In `logout` controller:
```js
import { revoke } from '../utils/tokenBlacklist.js';

const decoded = jwt.decode(req.cookies.accessToken || req.headers.authorization?.split(' ')[1]);
if (decoded?.jti && decoded?.exp) {
    revoke(decoded.jti, decoded.exp * 1000);
}
// ... clear cookies, clear refreshTokenJti, etc.
```

- [x] **Step 5: Verify**

```bash
# Login → get token
# Use token to access /api/auth/me → 200
# POST /api/auth/logout
# Use same token to access /api/auth/me → 401 UNAUTHORIZED ('Token has been revoked')
```

- [x] **Step 6: Commit**

```bash
git commit -m "feat(auth): in-memory access-token blacklist on logout (Redis-backed in Phase 3)"
```

---

## End-of-phase verification

- [x] All controllers free of `try/catch` boilerplate (except intentional fallbacks).
- [x] All routes wrapped in `validate({ body: ... })` where they accept input.
- [x] `curl -i .../api/health` returns `X-Request-ID` header.
- [x] Bad input → 400 with `{success: false, code: 'VALIDATION_ERROR', message, requestId}` shape.
- [x] Hit login 6 times in 15min → 6th returns 429 RATE_LIMITED.
- [x] Re-using a refresh token returns 401 + invalidates the family.
- [x] After login, browser shows two httpOnly cookies (`accessToken`, `refreshToken`); localStorage is empty of tokens.
- [x] After logout, the previous access token is rejected.
- [x] All tests pass on prod after deploy (Render auto-redeploys on push).

## What's next — Phase 3

**Reliability + perf.** Provision Upstash Redis, swap the in-memory rate-limit store and token blacklist to Redis-backed, add cache-aside on analytics endpoints, add idempotency keys on transaction creation, add Mongo transactions for the create-transaction-and-update-budget atomicity bug, add cursor pagination on `/api/transactions`.

## Self-review notes

- All §6 Phase 2 spec items addressed: refresh rotation ✓, rate limiting ✓, Zod ✓, error handling ✓, structured logging ✓, helmet/CORS audit ✓, httpOnly cookies ✓, blacklist ✓.
- Task 7 (cookies + CSRF) intentionally left at sketch level — it's the largest sub-change and warrants a separate detailed expansion when execution starts.
- Task 8 explicitly notes Phase 3 swap to Redis to avoid forgetting.
- "No real users" framing applied: breaking existing localStorage sessions is acceptable; we don't agonize over migration.
- Each task is independently committable and reversible.
