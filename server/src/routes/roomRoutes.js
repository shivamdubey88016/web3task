import express from 'express';
import { createRoom, getRoomInfo, joinRoom, getRoomHistory } from '../controllers/roomController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All room routes are protected by JWT auth
router.post('/', authMiddleware, createRoom);
router.get('/:code', authMiddleware, getRoomInfo);
router.post('/:code/join', authMiddleware, joinRoom);
router.get('/:code/history', authMiddleware, getRoomHistory);

export default router;
