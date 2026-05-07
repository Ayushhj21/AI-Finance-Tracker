import express from 'express';
import { register, login, refreshToken, logout, getCurrentUser } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, refreshSchema } from '../schemas/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// authLimiter (5 req / 15min) runs in addition to the global apiLimiter (100/15m).
// Defends register/login/refresh against credential stuffing / brute force.
router.post('/register', authLimiter, validate({ body: registerSchema }), register);
router.post('/login', authLimiter, validate({ body: loginSchema }), login);
router.post('/refresh', authLimiter, validate({ body: refreshSchema }), refreshToken);
router.post('/logout', protect, logout);
router.get('/me', protect, getCurrentUser);

export default router;
