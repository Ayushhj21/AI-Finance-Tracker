import jwt from 'jsonwebtoken';
import User from '../models/Usermodel.js';
import { Unauthorized } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { isRevoked } from '../utils/tokenBlacklist.js';

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

    // Blacklist check: logout pushes the access token's jti here so it stops
    // working immediately instead of lingering until its 15-minute expiry.
    if (decoded.jti && isRevoked(decoded.jti)) {
        throw Unauthorized('Token has been revoked');
    }

    const user = await User.findById(decoded.userId).select('-password -refreshTokenJti');
    if (!user) throw Unauthorized('User not found');

    // Expose jti + exp so the logout handler can revoke without re-decoding.
    req.tokenJti = decoded.jti;
    req.tokenExp = decoded.exp;
    req.user = user;
    next();
});
