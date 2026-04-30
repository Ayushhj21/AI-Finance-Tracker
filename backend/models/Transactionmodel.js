import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ["income", "expense"],
        required: [true, "Transaction type is required"]
    },
    amount: {
        type: Number,
        required: [true, "Amount is required"],
        min: [0, "Amount must be positive"]
    },
    category: {
        type: String,
        required: [true, "Category is required"],
        enum: [
            // Expense categories
            'Food & Drinks', 'Transportation', 'Shopping', 'Entertainment',
            'Bills & Utilities', 'Healthcare', 'Education', 'Travel',
            'Groceries', 'Rent', 'Insurance', 'Personal Care', 'Other Expense',
            // Income categories
            'Salary', 'Freelance', 'Investment', 'Gift', 'Other Income'
        ]
    },
    description:{
        type: String,
        trim: true,
        maxlength: 500
    },
    date:{
        type: Date,
        required: [true, "Date is required"],
        default: Date.now
    },
    receipt:{
        url: String,
        publicId: String
    },
    isRecurring:{
        type: Boolean,
        default: false
    },
    recurringFrequency:{
        type: String,
        enum: ["daily", "weekly", "monthly", "yearly"],
        default: null
    }
}, {
    timestamps: true
});

transactionSchema.index({ user: 1, date: -1 }); //it will create an index on the user field and sort by date in descending order, which will speed up queries that filter transactions by user and sort them by date.
transactionSchema.index({ user: 1, type: 1 })
transactionSchema.index({ user: 1, category: 1 })

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction; 