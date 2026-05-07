import { z } from 'zod';

export const categorizeSchema = z.object({
    description: z.string().min(1).max(500),
    amount: z.coerce.number().optional()
});

export const explainSpendingSchema = z.object({
    currentMonth: z.coerce.number().int().min(1).max(12),
    currentYear: z.coerce.number().int().min(2000).max(2100),
    compareMonth: z.coerce.number().int().min(1).max(12),
    compareYear: z.coerce.number().int().min(2000).max(2100)
});

export const summarySchema = z.object({
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2000).max(2100)
});

export const predictExpensesQuerySchema = z.object({
    months: z.coerce.number().int().positive().max(24).optional()
});
