// validate({body, query, params}) returns an Express middleware that runs each
// schema against the corresponding request part. Parsed values replace the
// originals (so coerced types stick). On failure, the ZodError flows to the
// global error handler which formats it as a 400 VALIDATION_ERROR.
//
// Usage:
//   import { validate } from '../middleware/validate.js';
//   import { loginSchema } from '../schemas/auth.js';
//   router.post('/login', validate({ body: loginSchema }), login);
export const validate = (schemas) => (req, res, next) => {
    try {
        if (schemas.body) req.body = schemas.body.parse(req.body);
        if (schemas.query) {
            // Express 5 exposes req.query as a read-only getter, so direct assignment
            // throws TypeError. Redefine the property on this request instance.
            const parsed = schemas.query.parse(req.query);
            Object.defineProperty(req, 'query', { value: parsed, writable: true, configurable: true });
        }
        if (schemas.params) req.params = schemas.params.parse(req.params);
        next();
    } catch (err) {
        next(err);
    }
};
