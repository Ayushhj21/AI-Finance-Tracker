import express from 'express';
import multer from 'multer';
import{
    getTransactions,
    getTransaction,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    uploadReceipt
} from  '../controllers/transactionController.js';

import {protect} from '../middleware/authMiddleware.js';

const router = express.Router();

//configure multer for file uploads

const upload = multer({
    dest: 'uploads/', //destination folder for uploaded files
    limits: {fileSize: 5 * 1024 * 1024}, //limit file size to 5MB
    fileFilter: (req, file, cb) => {
        console.log('Uploaded file mime type:', file.mimetype);
        console.log('Uploaded file name:', file.originalname);

        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];

        if(allowedMimeTypes.includes(file.mimetype)){
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, WEBP images and PDF files are allowed.'));
        }
    }
});

//All routes are protected
router.use(protect);

router.route('/')
.get(getTransactions)
.post(createTransaction);

router.route('/:id')
.get(getTransaction)
.put(updateTransaction)
.delete(deleteTransaction);


router.post('/:id/receipt', upload.single('receipt'), uploadReceipt);

export default router;