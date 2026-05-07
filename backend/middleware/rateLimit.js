import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/errors.js';

// Both limiters use express-rate-limit's default in-memory store.
// Phase 3 swaps to a Redis-backed store so counts are shared across
// multiple Render instances (and survive restarts).

// When the limit fires, throw our standard AppError so the response
// shape matches every other error from this API.
const handler = (req, res, next) => {
    next(new AppError('Too many requests, please try again later', 429, 'RATE_LIMITED'));
};

// General API throttle — 100 req per 15-min window per IP.
// Generous for normal use; would only catch automated abuse.
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,  // RateLimit-* response headers
    legacyHeaders: false,    // skip the older X-RateLimit-* headers
    handler
});

// Stricter throttle on auth routes to mitigate credential stuffing /
// brute force. 5 attempts per 15-min window per IP — way below what
// a real user would do; well above what humans hit by accident.
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler
});
