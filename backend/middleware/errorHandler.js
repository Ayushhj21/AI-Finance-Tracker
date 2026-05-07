import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// Single global error middleware. Express recognizes this by its 4-arg signature.
// MUST be mounted after all routes.
export const errorHandler = (err, req, res, next) => {
    // Map known error types to AppError shape
    let appErr;

    if (err instanceof AppError) {
        appErr = err;
    } else if (err instanceof mongoose.Error.ValidationError) {
        appErr = new AppError(
            Object.values(err.errors).map(e => e.message).join('; '),
            400,
            'VALIDATION_ERROR'
        );
    } else if (err instanceof mongoose.Error.CastError) {
        // e.g. invalid ObjectId in :id param
        appErr = new AppError(`Invalid ${err.path}: ${err.value}`, 400, 'BAD_REQUEST');
    } else if (err.code === 11000) {
        // Mongo duplicate-key error
        appErr = new AppError('Resource already exists', 409, 'CONFLICT');
    } else if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
        appErr = new AppError('Invalid or expired token', 401, 'UNAUTHORIZED');
    } else {
        // Unknown / programmer error — hide the message in prod to avoid leaking internals
        appErr = new AppError(
            process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
            500,
            'INTERNAL_ERROR'
        );
    }

    // Use the per-request logger if available (set by our pino middleware), so the
    // error log line carries the same reqId as the response's X-Request-ID header.
    const log = req.log || logger;
    const logLevel = appErr.statusCode >= 500 ? 'error' : 'warn';
    log[logLevel]({ err, statusCode: appErr.statusCode, code: appErr.code }, 'request error');

    res.status(appErr.statusCode).json({
        success: false,
        code: appErr.code,
        message: appErr.message,
        requestId: req.id
    });
};
