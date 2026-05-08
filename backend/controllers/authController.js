import User from '../models/Usermodel.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwtutils.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Unauthorized, Conflict } from '../utils/errors.js';

// @desc Register a new user
// @route POST /api/auth/register
// @access Public
export const register = asyncHandler(async (req, res) => {
    const { name, email, password, currency } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) throw Conflict('User already exists');

    const user = await User.create({
        name,
        email,
        password,
        currency: currency || 'USD'
    });

    const accessToken = generateAccessToken(user._id);
    const { token: refreshToken, jti } = generateRefreshToken(user._id);
    user.refreshTokenJti = jti;
    await user.save();

    res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                currency: user.currency
            },
            accessToken,
            refreshToken
        }
    });
});

// @desc Login user
// @route POST /api/auth/login
// @access Public
export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) throw Unauthorized('Invalid email or password');

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) throw Unauthorized('Invalid email or password');

    const accessToken = generateAccessToken(user._id);
    const { token: refreshToken, jti } = generateRefreshToken(user._id);
    user.refreshTokenJti = jti;
    await user.save();

    res.json({
        success: true,
        message: 'Login successful',
        data: {
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            },
            accessToken,
            refreshToken
        }
    });
});

// @desc    Refresh access token (with rotation + replay detection)
// @route   POST /api/auth/refresh
// @access  Public
export const refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    // Schema guarantees refreshToken is a non-empty string.

    // verifyRefreshToken throws on signature/expiry failures → mapped to 401 by errorHandler.
    const decoded = verifyRefreshToken(refreshToken);

    const user = await User.findById(decoded.userId).select('+refreshTokenJti');
    if (!user) throw Unauthorized('Invalid refresh token');

    // Rotation check: the incoming token's jti must match the user's currently-active jti.
    // Mismatch = either we already rotated (an old refresh token is being reused) or the
    // user's refreshTokenJti was cleared (logout). Either way: replay-style failure.
    if (!user.refreshTokenJti || user.refreshTokenJti !== decoded.jti) {
        // Defensive: clear the stored jti so any other in-flight uses also fail.
        if (user.refreshTokenJti) {
            user.refreshTokenJti = null;
            await user.save();
        }
        throw Unauthorized('Refresh token replay detected; please log in again');
    }

    // Rotate: issue a fresh pair and store the new jti.
    const newAccessToken = generateAccessToken(user._id);
    const { token: newRefreshToken, jti: newJti } = generateRefreshToken(user._id);
    user.refreshTokenJti = newJti;
    await user.save();

    res.json({
        success: true,
        data: {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        }
    });
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    user.refreshTokenJti = null;
    await user.save();

    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getCurrentUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    res.json({
        success: true,
        data: {
            id: user._id,
            name: user.name,
            email: user.email,
            currency: user.currency,
            avatar: user.avatar
        }
    });
});
