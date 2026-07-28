import { Router } from 'express';

import dashboardRoutes from './dashboard/index.js';
import usersRoutes from './users/index.js';
import ownersRoutes from './owners/index.js';
import ashramsRoutes from './ashrams/index.js';
import roomsRoutes from './rooms/index.js';
import bookingsRoutes from './bookings/index.js';
import offersRoutes from './offers/index.js';
import blogsRoutes from './blogs/index.js';
import plannerRoutes from './planner/index.js';
import localRoutes from './local/index.js';
import marketplaceRoutes from './marketplace/index.js';
import bannerRoutes from './banner/index.js';
import reportsRoutes from './reports/index.js';
import analyticsRoutes from './analytics/index.js';
import notificationsRoutes from './notifications/index.js';
import settingsRoutes from './settings/index.js';

import { getCrudList, saveCrudRecord, deleteCrudRecord } from './shared/genericCrudController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const adminRouter = Router();

// Module Routes
adminRouter.use('/dashboard', dashboardRoutes);
adminRouter.use('/users', usersRoutes);
adminRouter.use('/owners', ownersRoutes);
adminRouter.use('/ashrams', ashramsRoutes);
adminRouter.use('/rooms', roomsRoutes);
adminRouter.use('/bookings', bookingsRoutes);
adminRouter.use('/offers', offersRoutes);
adminRouter.use('/blogs', blogsRoutes);
adminRouter.use('/planner', plannerRoutes);
adminRouter.use('/local', localRoutes);
adminRouter.use('/marketplace', marketplaceRoutes);
adminRouter.use('/banner', bannerRoutes);
adminRouter.use('/reports', reportsRoutes);
adminRouter.use('/analytics', analyticsRoutes);
adminRouter.use('/notifications', notificationsRoutes);
adminRouter.use('/settings', settingsRoutes);

// Generic Enterprise CRUD endpoints. These reach every model in the registry
// (including User), so they are authenticated and limited to the same roles the
// admin dashboard itself is gated to. Per-model field rules live in the
// controller — role alone is not enough here.
const adminOnly = [protect, restrictTo('super_admin', 'govt_admin', 'district_officer')];

adminRouter.get('/crud/:moduleKey', adminOnly, getCrudList);
adminRouter.post('/crud/:moduleKey', adminOnly, saveCrudRecord);
adminRouter.delete('/crud/:moduleKey/:id', adminOnly, deleteCrudRecord);

export default adminRouter;
