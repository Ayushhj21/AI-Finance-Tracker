import jwt from 'jsonwebtoken';
import User from '../models/Usermodel.js';
import { Unauthorized } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Access token now travels as an httpOnly cookie. We no longer accept it via
// the Authorization header — the only way to authenticate is via the cookie
// the server set on login/register/refresh. Errors are thrown so the central
// errorHandler shapes them as { success, code, message, requestId }.
export const protect = asyncHandler(async (req, res, next) => {
    const token = req.cookies?.accessToken;
    if (!token) throw Unauthorized('Not authorized, no token');

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
        throw Unauthorized('Token is invalid or expired');
    }

    const user = await User.findById(decoded.userId).select('-password -refreshTokenJti');
    if (!user) throw Unauthorized('User not found');

    req.user = user;
    next();
});
