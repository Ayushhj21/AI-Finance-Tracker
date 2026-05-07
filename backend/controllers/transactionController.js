import Transaction from '../models/Transactionmodel.js';
import Budget from '../models/Budgetmodel.js';
import { v2 as cloudinary } from 'cloudinary';
import { createNotification, checkHighValueTransaction, checkUnusualSpending } from '../services/notificationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFound, BadRequest } from '../utils/errors.js';

// @desc    Get all transactions for user
// @route   GET /api/transactions
// @access  Private
export const getTransactions = asyncHandler(async (req, res) => {
    const { type, category, startDate, endDate, minAmount, maxAmount, search } = req.query;

    const query = { user: req.user._id };

    if (type) query.type = type;
    if (category) query.category = category;
    if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
    }
    if (minAmount || maxAmount) {
        query.amount = {};
        if (minAmount) query.amount.$gte = parseFloat(minAmount);
        if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }
    if (search) {
        query.$or = [
            { description: { $regex: search, $options: 'i' } },
            { merchant: { $regex: search, $options: 'i' } }
        ];
    }

    const transactions = await Transaction.find(query)
        .sort({ date: -1 })
        .limit(parseInt(req.query.limit) || 100);

    res.json({
        success: true,
        count: transactions.length,
        data: transactions
    });
});

// @desc    Get single transaction
// @route   GET /api/transactions/:id
// @access  Private
export const getTransaction = asyncHandler(async (req, res) => {
    const transaction = await Transaction.findOne({
        _id: req.params.id,
        user: req.user._id
    });

    if (!transaction) throw NotFound('Transaction');

    res.json({
        success: true,
        data: transaction
    });
});

// @desc    Create transaction
// @route   POST /api/transactions
// @access  Private
export const createTransaction = asyncHandler(async (req, res) => {
    const transactionData = {
        ...req.body,
        user: req.user._id
    };

    if (!transactionData.isRecurring || transactionData.recurringFrequency === '') {
        transactionData.recurringFrequency = null;
    }

    const transaction = await Transaction.create(transactionData);

    // Update budget if expense
    if (transaction.type === 'expense') {
        const date = new Date(transaction.date);
        const budget = await Budget.findOneAndUpdate(
            {
                user: req.user._id,
                category: transaction.category,
                month: date.getMonth() + 1,
                year: date.getFullYear()
            },
            { $inc: { spent: transaction.amount } },
            { new: true }
        );

        // Check if budget alert threshold is reached
        if (budget && !budget.alertSent) {
            const percentageSpent = budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0;

            if (percentageSpent >= budget.alertThreshold) {
                await createNotification(
                    req.user._id,
                    'budget_alert',
                    `Budget Alert: ${budget.category}`,
                    `You've spent ${percentageSpent.toFixed(1)}% of your ${budget.category} budget ($${budget.spent.toFixed(2)} of $${budget.amount.toFixed(2)})`,
                    {
                        budgetId: budget._id,
                        category: budget.category,
                        percentageSpent: percentageSpent.toFixed(2)
                    }
                );

                budget.alertSent = true;
                await budget.save();
            }
        }

        await checkUnusualSpending(req.user._id, transaction);
        await checkHighValueTransaction(req.user._id, transaction);
    }

    res.status(201).json({
        success: true,
        message: 'Transaction created successfully',
        data: transaction
    });
});

// @desc    Update transaction
// @route   PUT /api/transactions/:id
// @access  Private
export const updateTransaction = asyncHandler(async (req, res) => {
    const oldTransaction = await Transaction.findOne({
        _id: req.params.id,
        user: req.user._id
    });

    if (!oldTransaction) throw NotFound('Transaction');

    const updateData = { ...req.body };
    if (!updateData.isRecurring || updateData.recurringFrequency === '') {
        updateData.recurringFrequency = null;
    }

    const transaction = await Transaction.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
    );

    // Reverse old transaction's impact on budget
    if (oldTransaction.type === 'expense') {
        const oldDate = new Date(oldTransaction.date);
        await Budget.findOneAndUpdate(
            {
                user: req.user._id,
                category: oldTransaction.category,
                month: oldDate.getMonth() + 1,
                year: oldDate.getFullYear()
            },
            { $inc: { spent: -oldTransaction.amount } }
        );
    }

    // Apply new transaction's impact
    if (transaction.type === 'expense') {
        const newDate = new Date(transaction.date);
        await Budget.findOneAndUpdate(
            {
                user: req.user._id,
                category: transaction.category,
                month: newDate.getMonth() + 1,
                year: newDate.getFullYear()
            },
            { $inc: { spent: transaction.amount } }
        );
    }

    res.json({
        success: true,
        message: 'Transaction updated successfully',
        data: transaction
    });
});

// @desc    Delete transaction
// @route   DELETE /api/transactions/:id
// @access  Private
export const deleteTransaction = asyncHandler(async (req, res) => {
    const transaction = await Transaction.findOne({
        _id: req.params.id,
        user: req.user._id
    });

    if (!transaction) throw NotFound('Transaction');

    if (transaction.receipt && transaction.receipt.publicId) {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });
        await cloudinary.uploader.destroy(transaction.receipt.publicId);
    }

    if (transaction.type === 'expense') {
        const date = new Date(transaction.date);
        await Budget.findOneAndUpdate(
            {
                user: req.user._id,
                category: transaction.category,
                month: date.getMonth() + 1,
                year: date.getFullYear()
            },
            { $inc: { spent: -transaction.amount } }
        );
    }

    await transaction.deleteOne();

    res.json({
        success: true,
        message: 'Transaction deleted successfully'
    });
});

// @desc    Upload receipt
// @route   POST /api/transactions/:id/receipt
// @access  Private
export const uploadReceipt = asyncHandler(async (req, res) => {
    if (!req.file) throw BadRequest('Please upload a file');

    const transaction = await Transaction.findOne({
        _id: req.params.id,
        user: req.user._id
    });

    if (!transaction) throw NotFound('Transaction');

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'finance-tracker/receipts',
        resource_type: 'auto'
    });

    if (transaction.receipt && transaction.receipt.publicId) {
        await cloudinary.uploader.destroy(transaction.receipt.publicId);
    }

    transaction.receipt = {
        url: result.secure_url,
        publicId: result.public_id
    };

    await transaction.save();

    res.json({
        success: true,
        message: 'Receipt uploaded successfully',
        data: transaction
    });
});
