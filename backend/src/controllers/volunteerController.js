import VolunteerJob from '../models/VolunteerJob.js';
import VolunteerApplication from '../models/VolunteerApplication.js';
import { buildEnterpriseQuery, buildSortOptions, buildPagination } from '../utils/queryBuilder.js';

// GET /api/volunteer/jobs - Search & Filter Openings
export const getJobs = async (req, res) => {
  try {
    const {
      category,
      city,
      type,
      department,
      accommodation,
      food,
      search,
      sortBy = 'newest',
      page = 1,
      limit = 20,
    } = req.query;

    const customFilters = {};
    if (type && type !== 'all') customFilters.type = type;
    if (department && department !== 'all') customFilters.department = new RegExp(department, 'i');
    if (accommodation && accommodation !== 'all') customFilters.accommodation = accommodation;
    if (food && food !== 'all') customFilters.food = food;

    const query = buildEnterpriseQuery({
      search,
      searchFields: ['title', 'ashramName', 'department', 'city', 'responsibilities'],
      category,
      city,
      status: 'open',
      customFilters,
    });

    const sort = buildSortOptions(sortBy);
    const { skip, limit: limitParsed } = buildPagination(page, limit);

    const [jobs, total] = await Promise.all([
      VolunteerJob.find(query).sort(sort).skip(skip).limit(limitParsed),
      VolunteerJob.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: jobs.length,
      total,
      data: jobs,
    });
  } catch (error) {
    console.error('getJobs error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch volunteer openings.' });
  }
};

// GET /api/volunteer/jobs/:id
export const getJobById = async (req, res) => {
  try {
    const job = await VolunteerJob.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Volunteer opening not found.' });
    }
    return res.status(200).json({ success: true, data: job });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching job details.' });
  }
};

// POST /api/volunteer/apply - Submit Application
export const applyJob = async (req, res) => {
  try {
    const { jobId, applicantName, email, phone, city, education, skills, languages, availability, motivation } = req.body;

    const application = await VolunteerApplication.create({
      jobId,
      userId: req.user?._id || null,
      applicantName,
      email,
      phone,
      city,
      education: education || 'Graduate',
      skills: skills || 'Spiritual Seva, Communication',
      languages: languages || 'Hindi, English',
      availability: availability || 'Immediate',
      motivation: motivation || 'I want to offer my service with devotion.',
      status: 'applied',
    });

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully!',
      data: application,
    });
  } catch (error) {
    console.error('applyJob error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit volunteer application.' });
  }
};

// POST /api/volunteer/jobs - Create Opening (Owner / Admin)
export const createJob = async (req, res) => {
  try {
    const job = await VolunteerJob.create(req.body);
    return res.status(201).json({ success: true, data: job });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/volunteer/jobs/:id - Update Opening
export const updateJob = async (req, res) => {
  try {
    const job = await VolunteerJob.findByIdAndUpdate(req.params.id, req.body, { new: true });
    return res.status(200).json({ success: true, data: job });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/volunteer/jobs/:id - Delete Opening
export const deleteJob = async (req, res) => {
  try {
    await VolunteerJob.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: 'Volunteer opening deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/volunteer/owner/jobs - Fetch jobs for logged-in owner
export const getOwnerJobs = async (req, res) => {
  try {
    const ownerId = req.user?._id;
    const query = ownerId ? { $or: [{ ownerId }, { ownerId: { $exists: false } }] } : {};
    const jobs = await VolunteerJob.find(query).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: jobs.length, data: jobs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/volunteer/applications - Fetch all applications (Owner / Admin)
export const getApplications = async (req, res) => {
  try {
    const applications = await VolunteerApplication.find()
      .sort({ createdAt: -1 })
      .populate('jobId', 'title ashramName city department');
    return res.status(200).json({ success: true, count: applications.length, data: applications });
  } catch (error) {
    console.error('getApplications error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch volunteer applications.' });
  }
};

// PUT /api/volunteer/applications/:id/status - Update Application Status
export const updateApplicationStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const updatePayload = { status };
    if (notes) updatePayload['interviewSchedule.notes'] = notes;

    const application = await VolunteerApplication.findByIdAndUpdate(
      req.params.id,
      { $set: updatePayload },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `Application marked as ${status}.`,
      data: application,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
