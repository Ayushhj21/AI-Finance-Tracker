import express from 'express';
import {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getNotifications)
    .delete(clearAllNotifications);

router.put('/read-all', markAllAsRead);

router.route('/:id')
    .delete(deleteNotification);

router.put('/:id/read', markAsRead);

export default router;