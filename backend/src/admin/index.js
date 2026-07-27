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

// Generic Enterprise CRUD endpoints
adminRouter.get('/crud/:moduleKey', getCrudList);
adminRouter.post('/crud/:moduleKey', saveCrudRecord);
adminRouter.delete('/crud/:moduleKey/:id', deleteCrudRecord);

export default adminRouter;
