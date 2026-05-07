import { z } from 'zod';
import { transactionCategorySchema, objectIdSchema } from './categories.js';

export const createBudgetSchema = z.object({
    category: transactionCategorySchema,
    amount: z.coerce.number().positive(),
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2000).max(2100),
    alertThreshold: z.coerce.number().int().min(0).max(100).optional()
});

export const updateBudgetSchema = createBudgetSchema.partial();

export const recalculateBudgetSchema = z.object({
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2000).max(2100)
});

export const listBudgetsQuerySchema = z.object({
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional()
});

export const idParamSchema = z.object({
    id: objectIdSchema
});
