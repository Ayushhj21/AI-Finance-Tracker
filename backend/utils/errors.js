// Operational errors: predictable failures we want to communicate cleanly to the client.
// Anything else (bugs, programmer errors, unhandled exceptions) is treated as 500 by the
// error handler and the message is hidden from the client in production.

export class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

// Convenience constructors — easier to read at call sites than `new AppError(..., 404, 'NOT_FOUND')`
export const NotFound = (resource = 'Resource') =>
    new AppError(`${resource} not found`, 404, 'NOT_FOUND');

export const BadRequest = (message = 'Invalid request') =>
    new AppError(message, 400, 'BAD_REQUEST');

export const Unauthorized = (message = 'Not authorized') =>
    new AppError(message, 401, 'UNAUTHORIZED');

export const Forbidden = (message = 'Forbidden') =>
    new AppError(message, 403, 'FORBIDDEN');

export const Conflict = (message = 'Conflict') =>
    new AppError(message, 409, 'CONFLICT');
