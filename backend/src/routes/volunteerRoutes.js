import express from 'express';
import {
  getJobs,
  getJobById,
  applyJob,
  createJob,
  updateJob,
  deleteJob,
  getApplications,
  getOwnerJobs,
  updateApplicationStatus,
} from '../controllers/volunteerController.js';

const router = express.Router();

router.get('/jobs', getJobs);
router.get('/owner/jobs', getOwnerJobs);
router.get('/jobs/:id', getJobById);
router.post('/apply', applyJob);

// Admin / Owner Routes
router.post('/jobs', createJob);
router.put('/jobs/:id', updateJob);
router.delete('/jobs/:id', deleteJob);
router.get('/applications', getApplications);
router.put('/applications/:id/status', updateApplicationStatus);

export default router;
