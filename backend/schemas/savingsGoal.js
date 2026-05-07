import { z } from 'zod';
import { savingsGoalCategorySchema, objectIdSchema } from './categories.js';

export const createSavingsGoalSchema = z.object({
    name: z.string().min(1).max(200),
    targetAmount: z.coerce.number().positive(),
    currentAmount: z.coerce.number().min(0).optional(),
    deadline: z.coerce.date(),
    category: savingsGoalCategorySchema.optional(),
    icon: z.string().max(10).optional()
});

export const updateSavingsGoalSchema = createSavingsGoalSchema.partial().extend({
    status: z.enum(['active', 'completed', 'cancelled']).optional()
});

export const addToSavingsGoalSchema = z.object({
    amount: z.coerce.number().positive()
});

export const listSavingsGoalsQuerySchema = z.object({
    status: z.enum(['active', 'completed', 'cancelled']).optional()
});

export const idParamSchema = z.object({
    id: objectIdSchema
});
