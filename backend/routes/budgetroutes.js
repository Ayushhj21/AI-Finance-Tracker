import express from 'express';
import {
    getBudgets,
    createBudget,
    updateBudget,
    deleteBudget,
    recalculateBudgets
} from '../controllers/budgetController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import {
    createBudgetSchema,
    updateBudgetSchema,
    recalculateBudgetSchema,
    listBudgetsQuerySchema,
    idParamSchema
} from '../schemas/budget.js';

const router = express.Router();

router.use(protect);

router.route('/')
    .get(validate({ query: listBudgetsQuerySchema }), getBudgets)
    .post(validate({ body: createBudgetSchema }), createBudget);

router.post('/recalculate', validate({ body: recalculateBudgetSchema }), recalculateBudgets);

router.route('/:id')
    .put(validate({ params: idParamSchema, body: updateBudgetSchema }), updateBudget)
    .delete(validate({ params: idParamSchema }), deleteBudget);

export default router;
