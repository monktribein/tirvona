import User from '../../models/User.js';
import Ashram from '../../models/Ashram.js';
import Room from '../../models/Room.js';
import Booking from '../../models/Booking.js';
import Offer from '../../models/Offer.js';
import BlogPost from '../../models/BlogPost.js';
import BlogAuthor from '../../models/BlogAuthor.js';
import BlogComment from '../../models/BlogComment.js';
import Banner from '../../models/Banner.js';
import MarketplaceProduct from '../../models/MarketplaceProduct.js';
import MarketplaceCategory from '../../models/MarketplaceCategory.js';
import MarketplaceWaitlist from '../../models/MarketplaceWaitlist.js';
import LocalServiceItem from '../../models/LocalServiceItem.js';
import PilgrimageCircuit from '../../models/PilgrimageCircuit.js';
import Temple from '../../models/Temple.js';
import EventFestival from '../../models/EventFestival.js';
import SupportTicket from '../../models/SupportTicket.js';
import AuditLog from '../../models/AuditLog.js';
import SacredDirectoryItem from '../../models/SacredDirectoryItem.js';
import InstitutionMaster from '../../models/institution/InstitutionMaster.js';
import InstitutionContact from '../../models/institution/InstitutionContact.js';
import InstitutionLocation from '../../models/institution/InstitutionLocation.js';
import InstitutionQualityAudit from '../../models/institution/InstitutionQualityAudit.js';
import VolunteerJob from '../../models/VolunteerJob.js';
import VolunteerApplication from '../../models/VolunteerApplication.js';
import Review from '../../models/Review.js';
import Payment from '../../models/Payment.js';
import ServiceBooking from '../../models/ServiceBooking.js';
import ServiceProvider from '../../models/ServiceProvider.js';
import { escapeRegex } from '../../utils/sanitize.js';

// Comprehensive Mongoose Model Registry mapping every enterprise module key
const MODEL_MAP = {
  users: User,
  pilgrims: User,
  owners: User,
  staff: User,
  ashrams: Ashram,
  institution: InstitutionMaster,
  institutions: InstitutionMaster,
  institution_contacts: InstitutionContact,
  institution_locations: InstitutionLocation,
  institution_audits: InstitutionQualityAudit,
  rooms: Room,
  bookings: Booking,
  offers: Offer,
  blogs: BlogPost,
  authors: BlogAuthor,
  comments: BlogComment,
  banner: Banner,
  banners: Banner,
  marketplace: MarketplaceProduct,
  products: MarketplaceProduct,
  vendors: MarketplaceProduct,
  categories: MarketplaceCategory,
  waitlist: MarketplaceWaitlist,
  newsletter: MarketplaceWaitlist,
  local: LocalServiceItem,
  transport: LocalServiceItem,
  guides: SacredDirectoryItem,
  restaurants: LocalServiceItem,
  circuits: PilgrimageCircuit,
  temples: Temple,
  events: EventFestival,
  festivals: EventFestival,
  support: SupportTicket,
  reports: AuditLog,
  audit: AuditLog,
  volunteer: VolunteerJob,
  volunteer_jobs: VolunteerJob,
  volunteer_applications: VolunteerApplication,
  reviews: Review,
  payments: Payment,
  services: ServiceBooking,
  service_bookings: ServiceBooking,
  providers: ServiceProvider,
};

// Fields that must never be written through the generic CRUD endpoint, on any
// model. `_id` is handled separately (it selects create vs update).
const IMMUTABLE_FIELDS = ['__v', 'createdAt', 'updatedAt', 'password', 'passwordHash', 'tokenVersion'];

// Fields that only a Super Admin may write, keyed by Mongoose model name. These
// are the escalation levers: without this a district_officer could POST
// { _id, role: 'super_admin' } to /api/admin/crud/users and own the platform.
const PRIVILEGED_FIELDS = {
  User: [
    'role',
    'status',
    'isSuspended',
    'suspensionType',
    'suspensionReason',
    'employeeId',
    'ashramId',
    // Flipping this by hand would bypass the OTP challenge entirely.
    'isVerified',
    'phoneVerifiedAt',
    'emailVerifiedAt',
  ],
  InstitutionMaster: ['status', 'createdById'],
  Ashram: ['status', 'isVerified', 'ownerId'],
};

// Secrets and PII that must never leave the server through a generic list.
const HIDDEN_ON_READ = {
  User: '-passwordHash -tokenVersion -aadhaarId -govtId',
};

// Strip everything the caller is not allowed to write for this model.
const filterWritableFields = (data, TargetModel, user) => {
  const clean = { ...data };
  IMMUTABLE_FIELDS.forEach((f) => delete clean[f]);

  if (user?.role !== 'super_admin') {
    (PRIVILEGED_FIELDS[TargetModel.modelName] || []).forEach((f) => delete clean[f]);
  }
  return clean;
};

// Generic list & search query
export const getCrudList = async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const { subKey, search, status } = req.query;

    const targetKey = subKey || moduleKey;
    const TargetModel = MODEL_MAP[targetKey] || MODEL_MAP[moduleKey];

    if (TargetModel) {
      const filter = {};

      // Sub-key filtering logic (e.g. ashrams/approved, ashrams/rejected, bookings/pending, offers/featured)
      if (subKey) {
        const lowerSubKey = subKey.toLowerCase();
        if (['approved', 'verified'].includes(lowerSubKey)) {
          if (TargetModel.schema.paths.isVerified) filter.isVerified = true;
          else if (TargetModel.schema.paths.status) filter.status = 'approved';
        } else if (['rejected', 'unverified'].includes(lowerSubKey)) {
          if (TargetModel.schema.paths.status) filter.status = 'rejected';
          else if (TargetModel.schema.paths.isVerified) filter.isVerified = false;
        } else if (['pending', 'unverified'].includes(lowerSubKey)) {
          if (TargetModel.schema.paths.status) filter.status = 'pending';
          else if (TargetModel.schema.paths.isVerified) filter.isVerified = false;
        } else if (['confirmed', 'completed', 'cancelled', 'refunds'].includes(lowerSubKey)) {
          filter.status = lowerSubKey === 'refunds' ? 'refund_requested' : lowerSubKey;
        } else if (['featured'].includes(lowerSubKey)) {
          filter.isFeatured = true;
        }
      }

      if (status && status !== 'all') {
        filter.status = status;
      }

      if (search) {
        const term = escapeRegex(search);
        const searchConditions = [];
        if (TargetModel.schema.paths.name) searchConditions.push({ name: { $regex: term, $options: 'i' } });
        if (TargetModel.schema.paths.title) searchConditions.push({ title: { $regex: term, $options: 'i' } });
        if (TargetModel.schema.paths.email) searchConditions.push({ email: { $regex: term, $options: 'i' } });
        if (TargetModel.schema.paths.bookingId) searchConditions.push({ bookingId: { $regex: term, $options: 'i' } });
        if (TargetModel.schema.paths.promoCode) searchConditions.push({ promoCode: { $regex: term, $options: 'i' } });
        if (TargetModel.schema.paths.department) searchConditions.push({ department: { $regex: term, $options: 'i' } });

        if (searchConditions.length > 0) {
          filter.$or = searchConditions;
        }
      }

      const docs = await TargetModel.find(filter)
        .select(HIDDEN_ON_READ[TargetModel.modelName] || '')
        .limit(100)
        .sort({ createdAt: -1 });
      return res.json({ success: true, count: docs.length, data: docs });
    }

    // Fallback dataset generator for specific sub-categories
    const records = Array.from({ length: 8 }, (_, i) => ({
      _id: `sys_${moduleKey}_${subKey || 'default'}_${i + 1}`,
      name: `${moduleKey.toUpperCase()} — ${subKey ? subKey.toUpperCase() : 'MAIN'} Entry #${101 + i}`,
      title: `${formatTitle(subKey || moduleKey)} Configuration #${i + 1}`,
      category: subKey || moduleKey,
      owner: i % 2 === 0 ? 'Super Admin Executive' : 'District Manager',
      details: `Active enterprise management record for ${moduleKey}`,
      status: i % 3 === 0 ? 'pending' : 'active',
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    return res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    console.error('Generic CRUD list error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const formatTitle = (str) =>
  str
    .replace(/-/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

// Generic create / update
export const saveCrudRecord = async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const data = req.body;
    const subKey = req.query.subKey;

    const targetKey = subKey || moduleKey;
    const TargetModel = MODEL_MAP[targetKey] || MODEL_MAP[moduleKey];

    if (TargetModel && data._id && !data._id.startsWith('sys_') && !data._id.startsWith('rec_')) {
      const updates = filterWritableFields(data, TargetModel, req.user);
      delete updates._id;
      const updated = await TargetModel.findByIdAndUpdate(data._id, updates, { new: true }).select(
        HIDDEN_ON_READ[TargetModel.modelName] || ''
      );
      return res.json({ success: true, message: 'Record updated successfully', data: updated });
    } else if (TargetModel) {
      const payload = filterWritableFields(data, TargetModel, req.user);
      delete payload._id;
      const created = await TargetModel.create(payload);
      // .select() does not apply to create(), so strip secrets from the echo.
      const safe = created.toObject();
      (HIDDEN_ON_READ[TargetModel.modelName] || '')
        .split(' ')
        .filter(Boolean)
        .forEach((f) => delete safe[f.replace('-', '')]);
      return res.json({ success: true, message: 'Record created successfully', data: safe });
    }

    return res.json({
      success: true,
      message: 'Record saved successfully',
      data: { ...data, _id: data._id || `sys_${Date.now()}` },
    });
  } catch (err) {
    console.error('Generic CRUD save error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Generic delete
export const deleteCrudRecord = async (req, res) => {
  try {
    const { moduleKey, id } = req.params;
    const TargetModel = MODEL_MAP[moduleKey];

    // Deleting accounts is a Super Admin action, not general admin CRUD.
    if (TargetModel?.modelName === 'User' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only a Super Admin can delete user accounts' });
    }

    if (TargetModel && !id.startsWith('sys_') && !id.startsWith('rec_')) {
      await TargetModel.findByIdAndDelete(id);
    }
    return res.json({ success: true, message: 'Record deleted successfully' });
  } catch (err) {
    console.error('Generic CRUD delete error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
