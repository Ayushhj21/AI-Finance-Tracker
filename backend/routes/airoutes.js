import express from 'express';
import {
  aiCategorize,
  aiExplainSpending,
  aiPredictExpenses,
  aiGenerateSummary,
  aiSavingsRecommendations
} from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/categorize', aiCategorize);
router.post('/explain-spending', aiExplainSpending);
router.get('/predict-expenses', aiPredictExpenses);
router.post('/summary', aiGenerateSummary);
router.get('/savings-recommendations', aiSavingsRecommendations);

export default router;