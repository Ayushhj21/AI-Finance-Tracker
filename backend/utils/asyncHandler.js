// Wraps an async route handler so any thrown error (including rejected promises)
// is forwarded to Express's error middleware via next(err).
//
// Without this, Express only catches synchronous throws — async errors become
// unhandled promise rejections and crash the process (or just hang the request).
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
