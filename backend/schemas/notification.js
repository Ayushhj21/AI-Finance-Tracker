import { z } from 'zod';
import { objectIdSchema } from './categories.js';

export const listNotificationsQuerySchema = z.object({
    isRead: z.enum(['true', 'false']).optional(),
    limit: z.coerce.number().int().positive().max(500).optional()
});

export const idParamSchema = z.object({
    id: objectIdSchema
});
