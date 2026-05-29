// Double-submit cookie CSRF protection.
//
// Threat model: now that auth tokens live in cookies (auto-sent by the browser),
// a malicious site could trigger a state-changing request to our API and have
// the browser attach the cookie. We block this by requiring the client to also
// send the CSRF token as a header — readable only by JS at our own origin.
// An attacker at evil.com can fire the request but can't read our csrfToken
// cookie (different origin), so they can't construct the matching header.
//
// Why we skip auth endpoints:
//  - /login, /register: no CSRF cookie exists yet; the request IS the credential
//  - /refresh: the refresh token itself is the secret being checked
import { timingSafeEqual } from 'crypto';
import { AppError } from '../utils/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXEMPT_PATHS = new Set([
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh'
]);

export const csrfProtection = (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    if (EXEMPT_PATHS.has(req.path)) return next();

    const cookie = req.cookies?.csrfToken;
    const header = req.headers['x-csrf-token'];

    if (!cookie || !header) {
        return next(new AppError('CSRF token missing', 403, 'CSRF_INVALID'));
    }

    // Constant-time compare to avoid leaking match progress via response timing.
    const a = Buffer.from(String(cookie));
    const b = Buffer.from(String(header));
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return next(new AppError('CSRF token invalid', 403, 'CSRF_INVALID'));
    }

    next();
};
