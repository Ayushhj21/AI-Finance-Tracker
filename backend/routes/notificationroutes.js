import express from 'express';
import {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { listNotificationsQuerySchema, idParamSchema } from '../schemas/notification.js';

const router = express.Router();

router.use(protect);

router.route('/')
    .get(validate({ query: listNotificationsQuerySchema }), getNotifications)
    .delete(clearAllNotifications);

router.put('/read-all', markAllAsRead);

router.route('/:id')
    .delete(validate({ params: idParamSchema }), deleteNotification);

router.put('/:id/read', validate({ params: idParamSchema }), markAsRead);

export default router;
