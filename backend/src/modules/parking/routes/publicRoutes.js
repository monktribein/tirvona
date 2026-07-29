import express from 'express';
import {
  searchParking,
  getParkingDetail,
  getAvailability,
  getQuote,
  getReviews,
  getVehicleTypes,
  getFilterOptions,
} from '../controllers/parkingSearchController.js';

// Public parking discovery. No authentication, matching how ashram, temple and
// pilgrimage search already work on this platform.
const router = express.Router();

// Static paths are declared before `/locations/:idOrSlug` so they are not
// swallowed by the parameterised route — the same ordering ashramRoutes uses.
router.get('/vehicle-types', getVehicleTypes);
router.get('/filters', getFilterOptions);

router.get('/locations', searchParking);
router.get('/locations/:id/availability', getAvailability);
router.get('/locations/:id/reviews', getReviews);
router.get('/locations/:idOrSlug', getParkingDetail);

router.post('/quote', getQuote);

export default router;
