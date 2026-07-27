import express from 'express';
import { subscribeWaitlist } from '../controllers/marketplaceHubController.js';

const router = express.Router();

router.post('/waitlist', subscribeWaitlist);
router.post('/newsletter', subscribeWaitlist);

export default router;
