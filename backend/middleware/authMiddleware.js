import jwt from 'jsonwebtoken';
import User from '../models/Usermodel.js';

export const protect = async (req, res, next) => {
    try {
        let token;

        //check for token in authorization header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ message: 'Not authorized, no token' });
        };

        try {
            //verify access token
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

            //get user from token
            req.user = await User.findById(decoded.userId).select('-password -refreshToken');

            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "User not found"
                })
            }

            next();
        } catch (error) {
            return res.status(401).json({ success: false, message: "Token is invalid or expired" });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error in authentication" });
    }
}
