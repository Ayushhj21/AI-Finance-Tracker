// Centralizes cookie attributes so we don't duplicate the SameSite/Secure dance
// across login/register/refresh/logout.
//
// In production (Render backend + Vercel frontend live on different sites),
// cookies must be SameSite=None;Secure to be sent on cross-site requests.
// In dev the Vite proxy makes everything same-origin to the browser, so
// SameSite=Lax is enough and lets us run over plain http://localhost.
import { randomBytes } from 'crypto';

const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;           // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const CSRF_MAX_AGE = REFRESH_TOKEN_MAX_AGE;

const isProd = () => process.env.NODE_ENV === 'production';

const httpOnlyBase = () => ({
    httpOnly: true,
    secure: isProd(),
    sameSite: isProd() ? 'none' : 'lax'
});

// CSRF cookie must be readable by JS (frontend echoes it into the X-CSRF-Token
// header). Same SameSite/Secure flags as the auth cookies so it flows with them.
const csrfBase = () => ({
    httpOnly: false,
    secure: isProd(),
    sameSite: isProd() ? 'none' : 'lax'
});

export const setAuthCookies = (res, { accessToken, refreshToken, csrfToken }) => {
    res.cookie('accessToken', accessToken, {
        ...httpOnlyBase(),
        maxAge: ACCESS_TOKEN_MAX_AGE
    });
    // Path-scoped to /api/auth/refresh: browser only sends this cookie on refresh
    // calls, shrinking the attack surface on all other endpoints.
    res.cookie('refreshToken', refreshToken, {
        ...httpOnlyBase(),
        path: '/api/auth/refresh',
        maxAge: REFRESH_TOKEN_MAX_AGE
    });
    res.cookie('csrfToken', csrfToken, {
        ...csrfBase(),
        maxAge: CSRF_MAX_AGE
    });
};

export const clearAuthCookies = (res) => {
    res.clearCookie('accessToken', httpOnlyBase());
    res.clearCookie('refreshToken', { ...httpOnlyBase(), path: '/api/auth/refresh' });
    res.clearCookie('csrfToken', csrfBase());
};

export const generateCsrfToken = () => randomBytes(32).toString('hex');
