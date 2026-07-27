import express from 'express';
import {
  getPilgrimageCircuits,
  getPilgrimageCircuitBySlug,
  getTemples,
  getTempleBySlug,
  getEventFestivals,
  getEventFestivalBySlug,
  getDirectoryItems,
} from '../controllers/sacredServicesController.js';

const router = express.Router();

// Circuit routes
router.get('/circuits', getPilgrimageCircuits);
router.get('/circuits/:slug', getPilgrimageCircuitBySlug);

// Temple routes
router.get('/temples', getTemples);
router.get('/temples/:slug', getTempleBySlug);

// Event & Festival routes
router.get('/events', getEventFestivals);
router.get('/events/:slug', getEventFestivalBySlug);

// Directory items route (travel-guides, local-guides, transport, restaurants, shops, puja-items, religious-products, books, handicrafts)
router.get('/directory', getDirectoryItems);

export default router;
