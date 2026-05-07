import { z } from 'zod';
import { transactionCategorySchema, objectIdSchema } from './categories.js';

export const createTransactionSchema = z.object({
    type: z.enum(['income', 'expense']),
    amount: z.coerce.number().positive(),
    category: transactionCategorySchema,
    description: z.string().max(500).optional(),
    date: z.coerce.date(),
    isRecurring: z.boolean().optional(),
    recurringFrequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).nullable().optional()
});

// PATCH-style partial update — every field becomes optional
export const updateTransactionSchema = createTransactionSchema.partial();

export const listTransactionsQuerySchema = z.object({
    type: z.enum(['income', 'expense']).optional(),
    category: transactionCategorySchema.optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    minAmount: z.coerce.number().optional(),
    maxAmount: z.coerce.number().optional(),
    search: z.string().optional(),
    limit: z.coerce.number().int().positive().max(500).optional()
});

export const idParamSchema = z.object({
    id: objectIdSchema
});
