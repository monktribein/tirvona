import InstitutionMaster from '../models/institution/InstitutionMaster.js';
import InstitutionContact from '../models/institution/InstitutionContact.js';
import InstitutionLocation from '../models/institution/InstitutionLocation.js';
import InstitutionQualityAudit from '../models/institution/InstitutionQualityAudit.js';
import { escapeRegex } from '../utils/sanitize.js';

// Fields a district_officer / govt_admin may write. `status` and `createdById`
// are deliberately excluded so a create/update cannot self-promote a profile to
// verified or reassign its owner — only Super Admin can move `status`.
const EDITABLE_FIELDS = [
  'legalName',
  'trustName',
  'registrationNo',
  'trustType',
  'establishedYear',
  'taxExemption80G',
  'fcraRegistered',
  'ashramId',
];

const pickEditable = (body = {}) =>
  EDITABLE_FIELDS.reduce((acc, key) => {
    if (body[key] !== undefined) acc[key] = body[key];
    return acc;
  }, {});

// @desc    Get all institution profiles with filtering & search
// @route   GET /api/institution
// @access  Public / Admin
export const getInstitutions = async (req, res) => {
  try {
    const { district, state, trustType, search } = req.query;
    const filter = {};

    if (trustType) filter.trustType = String(trustType);

    // district/state live on InstitutionLocation, so resolve them to ids first
    if (district || state) {
      const locationFilter = {};
      if (district) locationFilter.district = String(district);
      if (state) locationFilter.state = String(state);

      const locations = await InstitutionLocation.find(locationFilter).select('institutionId').lean();
      filter._id = { $in: locations.map((l) => l.institutionId) };
    }

    // Matched in Mongo (not in JS) so the whole collection is never loaded into
    // memory; the term is escaped so it cannot inject a regex or cause ReDoS.
    if (search) {
      const term = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ legalName: term }, { trustName: term }, { registrationNo: term }];
    }

    const institutions = await InstitutionMaster.find(filter).sort({ createdAt: -1 }).limit(100).lean();

    res.json({
      success: true,
      count: institutions.length,
      data: institutions,
    });
  } catch (error) {
    console.error('Get institutions error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single institution with location, contacts, and audit details
// @route   GET /api/institution/:id
// @access  Public / Admin
export const getInstitutionById = async (req, res) => {
  try {
    const master = await InstitutionMaster.findById(req.params.id);
    if (!master) {
      return res.status(404).json({ success: false, message: 'Institution master profile not found' });
    }

    const contacts = await InstitutionContact.find({ institutionId: master._id });
    const location = await InstitutionLocation.findOne({ institutionId: master._id });
    const qualityAudit = await InstitutionQualityAudit.findOne({ institutionId: master._id });

    res.json({
      success: true,
      data: {
        master,
        contacts,
        location,
        qualityAudit,
      },
    });
  } catch (error) {
    console.error('Get institution by ID error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new institution master profile
// @route   POST /api/institution
// @access  Private (Super Admin / District Admin)
export const createInstitution = async (req, res) => {
  try {
    const { legalName, trustName, registrationNo, trustType, establishedYear, district, state, phone } = req.body;

    if (!legalName) {
      return res.status(400).json({ success: false, message: 'Legal institution name is required' });
    }

    const master = await InstitutionMaster.create({
      legalName,
      trustName: trustName || legalName,
      registrationNo: registrationNo || `REG-${Date.now()}`,
      trustType: trustType || 'Religious Trust',
      establishedYear: establishedYear || 1950,
      // New profiles start unverified — only a Super Admin can promote them.
      status: req.user?.role === 'super_admin' ? 'verified' : 'onboarding',
      createdById: req.user ? req.user.id : undefined,
    });

    if (district || state) {
      await InstitutionLocation.create({
        institutionId: master._id,
        addressLine1: `${legalName} Complex`,
        district: district || 'Haridwar',
        state: state || 'Uttarakhand',
        pincode: '249401',
      });
    }

    if (phone) {
      await InstitutionContact.create({
        institutionId: master._id,
        contactType: 'Manager',
        name: 'Chief Administrator',
        phone,
        isPrimary: true,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Institution master profile created successfully!',
      data: master,
    });
  } catch (error) {
    console.error('Create institution error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update institution master profile
// @route   PUT /api/institution/:id
// @access  Private (Super Admin / District Admin)
export const updateInstitution = async (req, res) => {
  try {
    const updates = pickEditable(req.body);

    // `status` is a privileged field: only Super Admin may change it.
    if (req.body.status !== undefined && req.user?.role === 'super_admin') {
      updates.status = req.body.status;
    }

    const master = await InstitutionMaster.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!master) {
      return res.status(404).json({ success: false, message: 'Institution master profile not found' });
    }

    res.json({
      success: true,
      message: 'Institution profile updated successfully',
      data: master,
    });
  } catch (error) {
    console.error('Update institution error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete institution master profile
// @route   DELETE /api/institution/:id
// @access  Private (Super Admin)
export const deleteInstitution = async (req, res) => {
  try {
    const master = await InstitutionMaster.findByIdAndDelete(req.params.id);
    if (!master) {
      return res.status(404).json({ success: false, message: 'Institution not found' });
    }
    await InstitutionContact.deleteMany({ institutionId: req.params.id });
    await InstitutionLocation.deleteMany({ institutionId: req.params.id });
    await InstitutionQualityAudit.deleteMany({ institutionId: req.params.id });

    res.json({ success: true, message: 'Institution master deleted successfully' });
  } catch (error) {
    console.error('Delete institution error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
