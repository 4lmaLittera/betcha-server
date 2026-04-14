import { Router } from 'express';
import { getStoreItems, purchaseItem } from '../controllers/shopController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getStoreItems);
router.post('/purchase', authenticate, purchaseItem);

export default router;
