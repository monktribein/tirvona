import { Router } from 'express';

import publicRoutes from './routes/publicRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import scanRoutes from './routes/scanRoutes.js';
import partnerRoutes from './routes/partnerRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

// ─────────────────────────────────────────────────────────────────────────────
// Parking System — module entry point.
//
// The single surface this module exposes to the rest of the application. app.js
// mounts this one router at /api/parking; nothing else in the codebase imports
// anything from inside this directory, and this directory imports only four
// things from outside it, all read-only:
//
//   middlewares/authMiddleware.js  — `protect` / `restrictTo`, unmodified
//   utils/razorpay.js              — payment helpers, unmodified
//   utils/sanitize.js              — `escapeRegex`, unmodified
//   models/AuditLog.js             — appends to the existing audit trail
//   config/env.js                  — read-only configuration
//
// Route map:
//   /api/parking/*                 public discovery       (no auth)
//   /api/parking/bookings/*        visitor bookings       (protect)
//   /api/parking/scan/*            security guard panel   (protect + capability)
//   /api/parking/partner/*         partner & manager      (protect + capability)
//   /api/parking/admin/*           super admin            (protect + restrictTo)
// ─────────────────────────────────────────────────────────────────────────────

const parkingRouter = Router();

// Authenticated sub-routers are mounted BEFORE the public router, because the
// public router owns `/locations/:idOrSlug` and would otherwise shadow the
// more specific prefixes below it.
parkingRouter.use('/bookings', bookingRoutes);
parkingRouter.use('/scan', scanRoutes);
parkingRouter.use('/partner', partnerRoutes);
parkingRouter.use('/admin', adminRoutes);

parkingRouter.use('/', publicRoutes);

export default parkingRouter;
