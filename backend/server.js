import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

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

// Behind Render/Vercel/App Runner load balancer — trust X-Forwarded-* headers from one hop
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;

// Middleware

// Security headers — must run before any response is sent
app.use(helmet());

// Structured request logging using our pino logger directly.
// Attaches a per-request child logger and logs once on response 'finish'.
app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || randomUUID();
    req.log = logger.child({ reqId: req.id });
    res.setHeader('X-Request-ID', req.id);

    const start = Date.now();
    res.on('finish', () => {
        const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
        req.log[level]({
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime: Date.now() - start
        }, `${req.method} ${req.url} ${res.statusCode}`);
    });
    next();
});

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

// Health check — used by load balancers and uptime monitors
const dbStateLabel = (s) => ({
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
})[s] || 'unknown';

app.get('/api/health', (req, res) => {
    const dbState = mongoose.connection.readyState;
    const healthy = dbState === 1;
    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'degraded',
        db: dbStateLabel(dbState),
        uptime: Math.round(process.uptime())
    });
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

// Global error handler — must be the last app.use(). Recognized by 4-arg signature.
app.use(errorHandler);