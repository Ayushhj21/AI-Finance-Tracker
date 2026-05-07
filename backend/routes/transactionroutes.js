import express from 'express';
import multer from 'multer';
import {
    getTransactions,
    getTransaction,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    uploadReceipt
} from '../controllers/transactionController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import {
    createTransactionSchema,
    updateTransactionSchema,
    listTransactionsQuerySchema,
    idParamSchema
} from '../schemas/transaction.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error('Invalid file type. Only JPEG, PNG, WEBP images and PDF files are allowed.'));
    }
});

// All routes are protected
router.use(protect);

router.route('/')
    .get(validate({ query: listTransactionsQuerySchema }), getTransactions)
    .post(validate({ body: createTransactionSchema }), createTransaction);

router.route('/:id')
    .get(validate({ params: idParamSchema }), getTransaction)
    .put(validate({ params: idParamSchema, body: updateTransactionSchema }), updateTransaction)
    .delete(validate({ params: idParamSchema }), deleteTransaction);

router.post('/:id/receipt', validate({ params: idParamSchema }), upload.single('receipt'), uploadReceipt);

export default router;
