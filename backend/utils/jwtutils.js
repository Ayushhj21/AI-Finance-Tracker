import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

// Access tokens carry a jti so logout can push them onto an in-memory blacklist
// (see utils/tokenBlacklist.js). Without a jti there's no way to invalidate a
// stateless JWT before its natural expiry.
export const generateAccessToken = (userId) => {
    const jti = randomUUID();
    const token = jwt.sign(
        { userId, jti },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: process.env.JWT_ACCESS_EXPIRATION || '15m' }
    );
    return { token, jti };
};

// Refresh tokens carry a unique jti (JWT ID). The server stores ONLY the jti
// for the active refresh token (not the token value itself). On refresh, we
// compare the incoming token's jti against the stored one — mismatch means
// replay (server already issued a newer one), and we treat it as a security
// event that invalidates the entire family.
export const generateRefreshToken = (userId) => {
    const jti = randomUUID();
    const token = jwt.sign(
        { userId, jti },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d' }
    );
    return { token, jti };
};

export const verifyRefreshToken = (token) => {
    // jwt.verify throws on invalid/expired tokens; the global error handler
    // maps those to 401 UNAUTHORIZED.
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};
