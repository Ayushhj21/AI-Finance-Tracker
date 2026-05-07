import SavingsGoal from '../models/SavingsGoalmodel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFound } from '../utils/errors.js';

// @desc    Get all savings goals
// @route   GET /api/savings-goals
// @access  Private
export const getSavingsGoals = asyncHandler(async (req, res) => {
    const { status } = req.query;
    const query = { user: req.user._id };
    if (status) query.status = status;

    const goals = await SavingsGoal.find(query).sort({ deadline: 1 });

    res.json({
        success: true,
        count: goals.length,
        data: goals
    });
});

// @desc    Get single savings goal
// @route   GET /api/savings-goals/:id
// @access  Private
export const getSavingsGoal = asyncHandler(async (req, res) => {
    const goal = await SavingsGoal.findOne({
        _id: req.params.id,
        user: req.user._id
    });

    if (!goal) throw NotFound('Savings goal');

    res.json({
        success: true,
        data: goal
    });
});

// @desc    Create savings goal
// @route   POST /api/savings-goals
// @access  Private
export const createSavingsGoal = asyncHandler(async (req, res) => {
    const goal = await SavingsGoal.create({
        ...req.body,
        user: req.user._id
    });

    res.status(201).json({
        success: true,
        message: 'Savings goal created successfully',
        data: goal
    });
});

// @desc    Update savings goal
// @route   PUT /api/savings-goals/:id
// @access  Private
export const updateSavingsGoal = asyncHandler(async (req, res) => {
    const goal = await SavingsGoal.findOne({
        _id: req.params.id,
        user: req.user._id
    });

    if (!goal) throw NotFound('Savings goal');

    const updatedGoal = await SavingsGoal.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
    );

    if (updatedGoal.currentAmount >= updatedGoal.targetAmount) {
        updatedGoal.status = 'completed';
        await updatedGoal.save();
    }

    res.json({
        success: true,
        message: 'Savings goal updated successfully',
        data: updatedGoal
    });
});

// @desc    Add amount to savings goal
// @route   POST /api/savings-goals/:id/add
// @access  Private
export const addToSavingsGoal = asyncHandler(async (req, res) => {
    const { amount } = req.body;
    // Schema guarantees amount is a positive number.
    const goal = await SavingsGoal.findOne({
        _id: req.params.id,
        user: req.user._id
    });

    if (!goal) throw NotFound('Savings goal');

    goal.currentAmount += amount;

    if (goal.currentAmount >= goal.targetAmount) {
        goal.status = 'completed';
    }

    await goal.save();

    res.json({
        success: true,
        message: 'Amount added to savings goal',
        data: goal
    });
});

// @desc    Delete savings goal
// @route   DELETE /api/savings-goals/:id
// @access  Private
export const deleteSavingsGoal = asyncHandler(async (req, res) => {
    const goal = await SavingsGoal.findOne({
        _id: req.params.id,
        user: req.user._id
    });

    if (!goal) throw NotFound('Savings goal');

    await goal.deleteOne();

    res.json({
        success: true,
        message: 'Savings goal deleted successfully'
    });
});
