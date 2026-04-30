import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';

// Import routes
import authRoutes from './routes/authroutes.js';
import transactionRoutes from './routes/transactionroutes.js';
import budgetRoutes from './routes/budgetroutes.js';
import savingsGoalRoutes from './routes/savingsGoalroutes.js';
import analyticsRoutes from './routes/analyticsroutes.js';
import aiRoutes from './routes/airoutes.js';
import notificationRoutes from './routes/notificationroutes.js';

// Import services
import { checkBudgetAlerts } from './services/notificationService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware

// Security headers — must run before any response is sent
app.use(helmet());

// Request logging — concise format in dev, Apache-style in prod
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/savings-goals', savingsGoalRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Cron jobs
// Check budget alerts every hour
cron.schedule('0 * * * *', async () => {
    console.log('Running budget alert check...');
    await checkBudgetAlerts();
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    });

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});