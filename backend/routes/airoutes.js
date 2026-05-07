import express from 'express';
import {
  aiCategorize,
  aiExplainSpending,
  aiPredictExpenses,
  aiGenerateSummary,
  aiSavingsRecommendations
} from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import {
    categorizeSchema,
    explainSpendingSchema,
    summarySchema,
    predictExpensesQuerySchema
} from '../schemas/ai.js';

const router = express.Router();

router.use(protect);

router.post('/categorize', validate({ body: categorizeSchema }), aiCategorize);
router.post('/explain-spending', validate({ body: explainSpendingSchema }), aiExplainSpending);
router.get('/predict-expenses', validate({ query: predictExpensesQuerySchema }), aiPredictExpenses);
router.post('/summary', validate({ body: summarySchema }), aiGenerateSummary);
router.get('/savings-recommendations', aiSavingsRecommendations);

export default router;
