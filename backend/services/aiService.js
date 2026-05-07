// AI Service using Gemini REST API directly

import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
dotenv.config();
const apiKey = process.env.GEMINI_API_KEY;


const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Helper function to call Gemini API
async function callGeminiAPI(prompt) {
    const response = await fetch(`${API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        })
    });

    logger.info({ status: response.status }, 'gemini call complete');
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// AI Service for generating insights
export const generateAIInsight = async (prompt, context) => {
    try {
        const systemPrompt = `You are a financial advisor AI assistant. Analyze the provided financial data and give clear, actionable insights. Be concise, specific, and helpful. Focus on patterns, trends, and practical recommendations.`;

        const fullPrompt = `${systemPrompt}\n\n${prompt}\n\nContext:\n${JSON.stringify(context, null, 2)}`;

        const text = await callGeminiAPI(fullPrompt);
        return text;
    } catch (error) {
        logger.error({ err: error }, 'gemini insight generation failed');
        throw new Error('Failed to generate AI insight');
    }
};

// Categorize transaction using AI
export const categorizeTransaction = async (description, amount) => {
    try {
        const prompt = `Categorize this transaction:
Description: "${description}"
Amount: $${amount}

Choose ONE category from: Food & Drinks, Transportation, Shopping, Entertainment, Bills & Utilities, Healthcare, Education, Travel, Groceries, Rent, Insurance, Personal Care, Other Expense, Salary, Freelance, Investment, Gift, Other Income

Return ONLY the category name, nothing else.`;

        const text = await callGeminiAPI(prompt);
        return text.trim();
    } catch (error) {
        logger.error({ err: error }, 'gemini categorization failed; falling back to Other Expense');
        return 'Other Expense';
    }
};

// Generate spending explanation
export const explainSpendingChange = async (currentData, previousData) => {
    try {
        const prompt = `Explain why spending changed from last period to this period.`;

        const context = {
            currentPeriod: currentData,
            previousPeriod: previousData,
            change: {
                amount: currentData.total - previousData.total,
                percentage: ((currentData.total - previousData.total) / previousData.total * 100).toFixed(2)
            }
        };

        return await generateAIInsight(prompt, context);
    } catch (error) {
        logger.error({ err: error }, 'spending explanation failed');
        throw error;
    }
};

// Predict next month's expenses
export const predictExpenses = async (historicalData) => {
    try {
        const prompt = `Based on the historical spending data, predict next month's expenses and provide risk assessment.`;

        return await generateAIInsight(prompt, historicalData);
    } catch (error) {
        logger.error({ err: error }, 'expense prediction failed');
        throw error;
    }
};

// Generate financial summary
export const generateFinancialSummary = async (data) => {
    try {
        const prompt = `Generate a comprehensive financial summary for this period. Include:
1. Overall financial health
2. Top 3 insights
3. Top 3 actionable recommendations`;

        return await generateAIInsight(prompt, data);
    } catch (error) {
        logger.error({ err: error }, 'summary generation failed');
        throw error;
    }
};

// Savings goal recommendations
export const getSavingsRecommendations = async (income, expenses, goals) => {
    try {
        const prompt = `Analyze current financial situation and provide specific recommendations to achieve savings goals faster.`;

        const context = {
            monthlyIncome: income,
            monthlyExpenses: expenses,
            savingsGoals: goals
        };

        return await generateAIInsight(prompt, context);
    } catch (error) {
        logger.error({ err: error }, 'savings recommendations failed');
        throw error;
    }
};