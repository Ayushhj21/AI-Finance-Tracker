import Notification from '../models/Notificationmodel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFound } from '../utils/errors.js';

// @desc    Get all notifications
// @route   GET /api/notifications
// @access  Private
export const getNotifications = asyncHandler(async (req, res) => {
    const { isRead, limit = 50 } = req.query;

    const query = { user: req.user._id };
    if (isRead !== undefined) {
        query.isRead = isRead === 'true';
    }

    const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

    const unreadCount = await Notification.countDocuments({
        user: req.user._id,
        isRead: false
    });

    res.json({
        success: true,
        count: notifications.length,
        unreadCount,
        data: notifications
    });
});

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = asyncHandler(async (req, res) => {
    const notification = await Notification.findOne({
        _id: req.params.id,
        user: req.user._id
    });

    if (!notification) throw NotFound('Notification');

    notification.isRead = true;
    await notification.save();

    res.json({
        success: true,
        message: 'Notification marked as read',
        data: notification
    });
});

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = asyncHandler(async (req, res) => {
    await Notification.updateMany(
        { user: req.user._id, isRead: false },
        { isRead: true }
    );

    res.json({
        success: true,
        message: 'All notifications marked as read'
    });
});

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = asyncHandler(async (req, res) => {
    const notification = await Notification.findOne({
        _id: req.params.id,
        user: req.user._id
    });

    if (!notification) throw NotFound('Notification');

    await notification.deleteOne();

    res.json({
        success: true,
        message: 'Notification deleted'
    });
});

// @desc    Clear all notifications
// @route   DELETE /api/notifications
// @access  Private
export const clearAllNotifications = asyncHandler(async (req, res) => {
    await Notification.deleteMany({ user: req.user._id });

    res.json({
        success: true,
        message: 'All notifications cleared'
    });
});
