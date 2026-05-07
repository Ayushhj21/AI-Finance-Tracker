import express from 'express';
import {
    getSavingsGoals,
    getSavingsGoal,
    createSavingsGoal,
    updateSavingsGoal,
    addToSavingsGoal,
    deleteSavingsGoal
} from '../controllers/savingsGoalController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import {
    createSavingsGoalSchema,
    updateSavingsGoalSchema,
    addToSavingsGoalSchema,
    listSavingsGoalsQuerySchema,
    idParamSchema
} from '../schemas/savingsGoal.js';

const router = express.Router();

router.use(protect);

router.route('/')
    .get(validate({ query: listSavingsGoalsQuerySchema }), getSavingsGoals)
    .post(validate({ body: createSavingsGoalSchema }), createSavingsGoal);

router.route('/:id')
    .get(validate({ params: idParamSchema }), getSavingsGoal)
    .put(validate({ params: idParamSchema, body: updateSavingsGoalSchema }), updateSavingsGoal)
    .delete(validate({ params: idParamSchema }), deleteSavingsGoal);

router.post('/:id/add', validate({ params: idParamSchema, body: addToSavingsGoalSchema }), addToSavingsGoal);

export default router;
