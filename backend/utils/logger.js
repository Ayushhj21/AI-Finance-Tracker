import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

// Outputs raw JSON to stdout. Dev pretty-printing is handled by piping
// through pino-pretty in the dev script (see package.json). This is more
// reliable than pino's transport feature, which can drop logs in long-running
// servers under nodemon + ESM.
export const logger = pino({
    level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.refreshToken',
            'res.headers["set-cookie"]'
        ],
        censor: '[REDACTED]'
    }
});
