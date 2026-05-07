import express from 'express';
import { register, login, refreshToken, logout, getCurrentUser } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, refreshSchema } from '../schemas/auth.js';

const router = express.Router();

router.post('/register', validate({ body: registerSchema }), register);
router.post('/login', validate({ body: loginSchema }), login);
router.post('/refresh', validate({ body: refreshSchema }), refreshToken);
router.post('/logout', protect, logout);
router.get('/me', protect, getCurrentUser);

export default router;
