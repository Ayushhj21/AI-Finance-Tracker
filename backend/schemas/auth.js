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
