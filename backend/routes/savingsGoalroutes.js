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

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getSavingsGoals)
    .post(createSavingsGoal);

router.route('/:id')
    .get(getSavingsGoal)
    .put(updateSavingsGoal)
    .delete(deleteSavingsGoal);

router.post('/:id/add', addToSavingsGoal);

export default router;