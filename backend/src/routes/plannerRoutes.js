import express from 'express';
import { generateItinerary, getPlannerTemplates } from '../controllers/plannerController.js';

const router = express.Router();

router.post('/generate', generateItinerary);
router.get('/templates', getPlannerTemplates);

export default router;
