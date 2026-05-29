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

// /refresh no longer takes a body — the refresh token comes from a path-scoped
// httpOnly cookie. The route therefore has no body schema.
