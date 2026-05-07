import { z } from 'zod';

// Single source of truth for transaction categories.
// MUST stay in sync with the enum in backend/models/Transactionmodel.js
// and the CATEGORIES const in frontend/src/components/TransactionModal.jsx.
// (Phase 5 candidate: serve from /api/v1/constants/categories so the
// frontend fetches it dynamically and drift becomes impossible.)
export const transactionCategorySchema = z.enum([
    // Expense
    'Food & Drinks', 'Transportation', 'Shopping', 'Entertainment',
    'Bills & Utilities', 'Healthcare', 'Education', 'Travel',
    'Groceries', 'Rent', 'Insurance', 'Personal Care', 'Other Expense',
    // Income
    'Salary', 'Freelance', 'Investment', 'Gift', 'Other Income'
]);

export const savingsGoalCategorySchema = z.enum([
    'Emergency Fund', 'Vacation', 'Electronics', 'Education',
    'Home', 'Vehicle', 'Other'
]);

// Mongo ObjectId — 24 hex chars
export const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');
