import express from 'express';
import { register, login, refreshToken, logout, getCurrentUser } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../schemas/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// authLimiter (5 req / 15min) runs in addition to the global apiLimiter (100/15m).
// Defends register/login/refresh against credential stuffing / brute force.
router.post('/register', authLimiter, validate({ body: registerSchema }), register);
router.post('/login', authLimiter, validate({ body: loginSchema }), login);
// /refresh takes no body — the refresh token is a path-scoped httpOnly cookie.
router.post('/refresh', authLimiter, refreshToken);
router.post('/logout', protect, logout);
router.get('/me', protect, getCurrentUser);

export default router;
