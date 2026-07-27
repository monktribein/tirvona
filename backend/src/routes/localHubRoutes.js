import express from 'express';
import { getLocalServices } from '../controllers/localHubController.js';

const router = express.Router();

router.get('/', getLocalServices);
router.get('/guides', (req, res) => { req.query.category = 'guides'; getLocalServices(req, res); });
router.get('/transport', (req, res) => { req.query.category = 'transport'; getLocalServices(req, res); });
router.get('/restaurants', (req, res) => { req.query.category = 'food'; getLocalServices(req, res); });
router.get('/events', (req, res) => { req.query.category = 'events'; getLocalServices(req, res); });
router.get('/medical', (req, res) => { req.query.category = 'medical'; getLocalServices(req, res); });

export default router;
