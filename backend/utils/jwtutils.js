import jwt from 'jsonwebtoken';

export const generateAccessToken = (userId) => {
    return jwt.sign(
        {userId},
        process.env.JWT_ACCESS_SECRET,
        {
            expiresIn: process.env.JWT_ACCESS_EXPIRATION || '15m'
        });
};

export const generateRefreshToken = (userId) => {
    return jwt.sign(
        {userId},
        process.env.JWT_REFRESH_SECRET,
        {expiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d'}
    );
};

export const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    }catch(error){
        throw new Error('Invalid refresh token');
    }
}