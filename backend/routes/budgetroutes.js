import express from 'express';
import{
getBudgets,
createBudget,
updateBudget,
deleteBudget,
recalculateBudgets
} from '../controllers/budgetController.js';
import {protect} from '../middleware/authMiddleware.js';


const router = express.Router();


router.use(protect);

router.route('/')
    .get(getBudgets)
    .post(createBudget);

router.post('/recalculate', recalculateBudgets);

router.route('/:id')
    .put(updateBudget)
    .delete(deleteBudget);

export default router;