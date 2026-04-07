import { Router } from 'express';
import { getInventory, useItem } from '../controllers/inventoryController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getInventory);
router.post('/use', authenticate, useItem);

export default router;
