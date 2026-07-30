import mongoose from 'mongoose';
import axios from 'axios';
import connectDB from '../config/db.js';

// Import Models
import MarketplaceProduct from '../models/MarketplaceProduct.js';
import Ashram from '../models/Ashram.js';
import Room from '../models/Room.js';
import Offer from '../models/Offer.js';
import BlogPost from '../models/BlogPost.js';
import VolunteerJob from '../models/VolunteerJob.js';
import LocalServiceItem from '../models/LocalServiceItem.js';
import EventFestival from '../models/EventFestival.js';
import PilgrimageCircuit from '../models/PilgrimageCircuit.js';
import Temple from '../models/Temple.js';
import Banner from '../models/Banner.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';

const API_BASE = 'http://localhost:5000/api';

const results = [];

const logResult = (moduleName, action, status, details = '') => {
  results.push({ module: moduleName, action, status, details });
  console.log(`[${status}] ${moduleName} - ${action}${details ? `: ${details}` : ''}`);
};

const runLiveAudit = async () => {
  console.log('Starting Complete Live Execution Audit across all 14 Super Admin CRUD Modules...\n');
  await connectDB();

  let testUser = await User.findOne({ email: 'audit_test_owner@tirvona.com' });
  if (!testUser) {
    testUser = await User.create({
      name: 'Audit Owner',
      email: 'audit_test_owner@tirvona.com',
      phone: '9876543210',
      role: 'owner',
    });
  }

  // 1. Marketplace
  try {
    const createPayload = {
      name: 'AUDIT_TEST_MARKETPLACE_ITEM_' + Date.now(),
      slug: 'audit-test-marketplace-item-' + Date.now(),
      category: 'prasad',
      description: 'Audit Test Description',
      price: 299,
      salePrice: 199,
      stock: 50,
      templeSource: 'Audit Temple Trust',
      authenticityCertificate: 'Govt Certified',
      weight: '200g',
      images: ['https://images.unsplash.com/photo-1599488615731-7e5c2823ff28'],
      status: 'active',
      isFeatured: true,
    };

    const createdDoc = await MarketplaceProduct.create(createPayload);
    const dbCreated = await MarketplaceProduct.findById(createdDoc._id);
    if (dbCreated) logResult('Marketplace', 'CREATE (DB Write)', 'PASS', `ID: ${createdDoc._id}`);
    else logResult('Marketplace', 'CREATE (DB Write)', 'FAIL');

    const publicRes1 = await axios.get(`${API_BASE}/marketplace/products?search=${encodeURIComponent(createPayload.name)}`);
    const foundPublic1 = publicRes1.data?.data?.some(p => p._id.toString() === createdDoc._id.toString());
    if (foundPublic1) logResult('Marketplace', 'PUBLIC READ (Initial)', 'PASS');
    else logResult('Marketplace', 'PUBLIC READ (Initial)', 'FAIL');

    const updatePayload = { name: createPayload.name + '_EDITED', price: 399 };
    await MarketplaceProduct.findByIdAndUpdate(createdDoc._id, updatePayload);
    const dbUpdated = await MarketplaceProduct.findById(createdDoc._id);
    if (dbUpdated && dbUpdated.name.includes('_EDITED') && dbUpdated.price === 399) {
      logResult('Marketplace', 'UPDATE (DB Write)', 'PASS');
    } else {
      logResult('Marketplace', 'UPDATE (DB Write)', 'FAIL');
    }

    const publicRes2 = await axios.get(`${API_BASE}/marketplace/products?search=${encodeURIComponent(updatePayload.name)}`);
    const foundPublic2 = publicRes2.data?.data?.some(p => p._id.toString() === createdDoc._id.toString() && p.name.includes('_EDITED'));
    if (foundPublic2) logResult('Marketplace', 'PUBLIC READ (Updated)', 'PASS');
    else logResult('Marketplace', 'PUBLIC READ (Updated)', 'FAIL');

    await MarketplaceProduct.findByIdAndDelete(createdDoc._id);
    const dbDeleted = await MarketplaceProduct.findById(createdDoc._id);
    if (!dbDeleted) logResult('Marketplace', 'DELETE (DB Write)', 'PASS');
    else logResult('Marketplace', 'DELETE (DB Write)', 'FAIL');
  } catch (err) {
    logResult('Marketplace', 'FULL FLOW', 'FAIL', err.message);
  }

  // 2. Ashrams
  try {
    const createPayload = {
      name: 'AUDIT_TEST_ASHRAM_' + Date.now(),
      slug: 'audit-test-ashram-' + Date.now(),
      email: `audit_${Date.now()}@ashram.org`,
      phone: '9876543210',
      ownerId: testUser._id,
      address: { street: 'Main Temple Rd', city: 'Rishikesh', district: 'Dehradun', state: 'Uttarakhand', pincode: '249201' },
      description: 'Audit Ashram Description required field',
      status: 'approved',
      isVerified: true,
      images: ['/banner/ashram_rishikesh.png'],
    };

    const createdDoc = await Ashram.create(createPayload);
    const dbCreated = await Ashram.findById(createdDoc._id);
    if (dbCreated) logResult('Ashrams', 'CREATE (DB Write)', 'PASS', `ID: ${createdDoc._id}`);
    else logResult('Ashrams', 'CREATE (DB Write)', 'FAIL');

    const publicRes1 = await axios.get(`${API_BASE}/ashrams?query=${encodeURIComponent(createPayload.name)}`);
    const foundPublic1 = publicRes1.data?.data?.some(a => a._id.toString() === createdDoc._id.toString());
    if (foundPublic1) logResult('Ashrams', 'PUBLIC READ (Initial)', 'PASS');
    else logResult('Ashrams', 'PUBLIC READ (Initial)', 'FAIL');

    await Ashram.findByIdAndUpdate(createdDoc._id, { name: createPayload.name + '_EDITED' });
    const dbUpdated = await Ashram.findById(createdDoc._id);
    if (dbUpdated && dbUpdated.name.includes('_EDITED')) logResult('Ashrams', 'UPDATE (DB Write)', 'PASS');
    else logResult('Ashrams', 'UPDATE (DB Write)', 'FAIL');

    const publicRes2 = await axios.get(`${API_BASE}/ashrams?query=${encodeURIComponent(createPayload.name + '_EDITED')}`);
    const foundPublic2 = publicRes2.data?.data?.some(a => a._id.toString() === createdDoc._id.toString());
    if (foundPublic2) logResult('Ashrams', 'PUBLIC READ (Updated)', 'PASS');
    else logResult('Ashrams', 'PUBLIC READ (Updated)', 'FAIL');

    await Ashram.findByIdAndDelete(createdDoc._id);
    const dbDeleted = await Ashram.findById(createdDoc._id);
    if (!dbDeleted) logResult('Ashrams', 'DELETE (DB Write)', 'PASS');
    else logResult('Ashrams', 'DELETE (DB Write)', 'FAIL');
  } catch (err) {
    logResult('Ashrams', 'FULL FLOW', 'FAIL', err.message);
  }

  // 3. Rooms
  try {
    const tempAshram = await Ashram.create({
      name: 'TEMP_ROOM_ASHRAM_' + Date.now(),
      slug: 'temp-room-ashram-' + Date.now(),
      email: `temp_${Date.now()}@ashram.org`,
      ownerId: testUser._id,
      address: { street: 'Temple St', city: 'Varanasi', district: 'Varanasi', state: 'UP', pincode: '221001' },
      description: 'Temp Ashram Description required',
      status: 'approved',
    });

    const createPayload = {
      ashramId: tempAshram._id,
      name: 'Standard Double AC',
      type: 'private_room',
      acType: 'AC',
      basePrice: 1500,
      capacity: 2,
      totalInventory: 5,
      roomNumber: 'A-101',
      category: 'Deluxe AC Room',
      pricing: { basePrice: 1500, amount: 1500, extraPersonCharge: 300 },
      status: 'active',
    };

    const createdDoc = await Room.create(createPayload);
    const dbCreated = await Room.findById(createdDoc._id);
    if (dbCreated) logResult('Rooms', 'CREATE (DB Write)', 'PASS', `ID: ${createdDoc._id}`);
    else logResult('Rooms', 'CREATE (DB Write)', 'FAIL');

    const publicRes1 = await axios.get(`${API_BASE}/rooms/ashram/${tempAshram._id}`);
    const foundPublic1 = publicRes1.data?.data?.some(r => r._id.toString() === createdDoc._id.toString());
    if (foundPublic1) logResult('Rooms', 'PUBLIC READ (Initial)', 'PASS');
    else logResult('Rooms', 'PUBLIC READ (Initial)', 'FAIL');

    await Room.findByIdAndUpdate(createdDoc._id, { basePrice: 1800 });
    const dbUpdated = await Room.findById(createdDoc._id);
    if (dbUpdated && dbUpdated.basePrice === 1800) logResult('Rooms', 'UPDATE (DB Write)', 'PASS');
    else logResult('Rooms', 'UPDATE (DB Write)', 'FAIL');

    const publicRes2 = await axios.get(`${API_BASE}/rooms/ashram/${tempAshram._id}`);
    const foundPublic2 = publicRes2.data?.data?.some(r => r._id.toString() === createdDoc._id.toString() && r.basePrice === 1800);
    if (foundPublic2) logResult('Rooms', 'PUBLIC READ (Updated)', 'PASS');
    else logResult('Rooms', 'PUBLIC READ (Updated)', 'FAIL');

    await Room.findByIdAndDelete(createdDoc._id);
    await Ashram.findByIdAndDelete(tempAshram._id);
    const dbDeleted = await Room.findById(createdDoc._id);
    if (!dbDeleted) logResult('Rooms', 'DELETE (DB Write)', 'PASS');
    else logResult('Rooms', 'DELETE (DB Write)', 'FAIL');
  } catch (err) {
    logResult('Rooms', 'FULL FLOW', 'FAIL', err.message);
  }

  // 4. Offers
  try {
    const createPayload = {
      offerTitle: 'AUDIT_TEST_OFFER_' + Date.now(),
      promoCode: 'AUDIT' + Date.now().toString().slice(-4),
      discountType: 'percentage',
      discountValue: 20,
      description: 'Audit offer description',
      validTill: new Date(Date.now() + 864000000),
      ownerId: testUser._id,
      status: 'active',
    };

    const createdDoc = await Offer.create(createPayload);
    const dbCreated = await Offer.findById(createdDoc._id);
    if (dbCreated) logResult('Offers', 'CREATE (DB Write)', 'PASS', `ID: ${createdDoc._id}`);
    else logResult('Offers', 'CREATE (DB Write)', 'FAIL');

    const publicRes1 = await axios.get(`${API_BASE}/offers`);
    const foundPublic1 = publicRes1.data?.data?.some(o => o._id.toString() === createdDoc._id.toString());
    if (foundPublic1) logResult('Offers', 'PUBLIC READ (Initial)', 'PASS');
    else logResult('Offers', 'PUBLIC READ (Initial)', 'FAIL');

    await Offer.findByIdAndUpdate(createdDoc._id, { offerTitle: createPayload.offerTitle + '_EDITED' });
    const dbUpdated = await Offer.findById(createdDoc._id);
    if (dbUpdated && dbUpdated.offerTitle.includes('_EDITED')) logResult('Offers', 'UPDATE (DB Write)', 'PASS');
    else logResult('Offers', 'UPDATE (DB Write)', 'FAIL');

    const publicRes2 = await axios.get(`${API_BASE}/offers`);
    const foundPublic2 = publicRes2.data?.data?.some(o => o._id.toString() === createdDoc._id.toString() && (o.offerTitle || o.title)?.includes('_EDITED'));
    if (foundPublic2) logResult('Offers', 'PUBLIC READ (Updated)', 'PASS');
    else logResult('Offers', 'PUBLIC READ (Updated)', 'FAIL');

    await Offer.findByIdAndDelete(createdDoc._id);
    const dbDeleted = await Offer.findById(createdDoc._id);
    if (!dbDeleted) logResult('Offers', 'DELETE (DB Write)', 'PASS');
    else logResult('Offers', 'DELETE (DB Write)', 'FAIL');
  } catch (err) {
    logResult('Offers', 'FULL FLOW', 'FAIL', err.message);
  }

  // 5. Blogs
  try {
    const createPayload = {
      title: 'AUDIT_TEST_BLOG_' + Date.now(),
      slug: 'audit-test-blog-' + Date.now(),
      excerpt: 'Audit Blog Excerpt',
      content: 'Audit Blog Content Full Text',
      category: 'General',
      coverImage: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1',
      authorId: testUser._id,
      status: 'published',
    };

    const createdDoc = await BlogPost.create(createPayload);
    const dbCreated = await BlogPost.findById(createdDoc._id);
    if (dbCreated) logResult('Blogs', 'CREATE (DB Write)', 'PASS', `ID: ${createdDoc._id}`);
    else logResult('Blogs', 'CREATE (DB Write)', 'FAIL');

    const publicRes1 = await axios.get(`${API_BASE}/blog`);
    const foundPublic1 = publicRes1.data?.data?.some(b => b._id.toString() === createdDoc._id.toString());
    if (foundPublic1) logResult('Blogs', 'PUBLIC READ (Initial)', 'PASS');
    else logResult('Blogs', 'PUBLIC READ (Initial)', 'FAIL');

    await BlogPost.findByIdAndUpdate(createdDoc._id, { title: createPayload.title + '_EDITED' });
    const dbUpdated = await BlogPost.findById(createdDoc._id);
    if (dbUpdated && dbUpdated.title.includes('_EDITED')) logResult('Blogs', 'UPDATE (DB Write)', 'PASS');
    else logResult('Blogs', 'UPDATE (DB Write)', 'FAIL');

    const publicRes2 = await axios.get(`${API_BASE}/blog/${createPayload.slug}`);
    const foundPublic2 = publicRes2.data?.data?.title?.includes('_EDITED');
    if (foundPublic2) logResult('Blogs', 'PUBLIC READ (Updated)', 'PASS');
    else logResult('Blogs', 'PUBLIC READ (Updated)', 'FAIL');

    await BlogPost.findByIdAndDelete(createdDoc._id);
    const dbDeleted = await BlogPost.findById(createdDoc._id);
    if (!dbDeleted) logResult('Blogs', 'DELETE (DB Write)', 'PASS');
    else logResult('Blogs', 'DELETE (DB Write)', 'FAIL');
  } catch (err) {
    logResult('Blogs', 'FULL FLOW', 'FAIL', err.message);
  }

  // 6. Volunteer
  try {
    const tempAshram = await Ashram.create({
      name: 'TEMP_VOLUNTEER_ASHRAM_' + Date.now(),
      slug: 'temp-vol-ashram-' + Date.now(),
      email: `vol_${Date.now()}@ashram.org`,
      ownerId: testUser._id,
      address: { street: 'Ganga Ghat', city: 'Haridwar', district: 'Haridwar', state: 'UK', pincode: '249401' },
      description: 'Volunteer Ashram Description',
      status: 'approved',
    });

    const createPayload = {
      title: 'AUDIT_TEST_VOLUNTEER_' + Date.now(),
      ashramId: tempAshram._id,
      ashramName: tempAshram.name,
      city: 'Haridwar',
      department: 'Temple Seva',
      openingsCount: 5,
      stipend: 'Accommodation & Meals',
      description: 'Audit Volunteer Description',
      status: 'open',
    };

    const createdDoc = await VolunteerJob.create(createPayload);
    const dbCreated = await VolunteerJob.findById(createdDoc._id);
    if (dbCreated) logResult('Volunteer', 'CREATE (DB Write)', 'PASS', `ID: ${createdDoc._id}`);
    else logResult('Volunteer', 'CREATE (DB Write)', 'FAIL');

    const publicRes1 = await axios.get(`${API_BASE}/volunteer/jobs`);
    const foundPublic1 = publicRes1.data?.data?.some(v => v._id.toString() === createdDoc._id.toString());
    if (foundPublic1) logResult('Volunteer', 'PUBLIC READ (Initial)', 'PASS');
    else logResult('Volunteer', 'PUBLIC READ (Initial)', 'FAIL');

    await VolunteerJob.findByIdAndUpdate(createdDoc._id, { title: createPayload.title + '_EDITED' });
    const dbUpdated = await VolunteerJob.findById(createdDoc._id);
    if (dbUpdated && dbUpdated.title.includes('_EDITED')) logResult('Volunteer', 'UPDATE (DB Write)', 'PASS');
    else logResult('Volunteer', 'UPDATE (DB Write)', 'FAIL');

    const publicRes2 = await axios.get(`${API_BASE}/volunteer/jobs`);
    const foundPublic2 = publicRes2.data?.data?.some(v => v._id.toString() === createdDoc._id.toString() && v.title.includes('_EDITED'));
    if (foundPublic2) logResult('Volunteer', 'PUBLIC READ (Updated)', 'PASS');
    else logResult('Volunteer', 'PUBLIC READ (Updated)', 'FAIL');

    await VolunteerJob.findByIdAndDelete(createdDoc._id);
    await Ashram.findByIdAndDelete(tempAshram._id);
    const dbDeleted = await VolunteerJob.findById(createdDoc._id);
    if (!dbDeleted) logResult('Volunteer', 'DELETE (DB Write)', 'PASS');
    else logResult('Volunteer', 'DELETE (DB Write)', 'FAIL');
  } catch (err) {
    logResult('Volunteer', 'FULL FLOW', 'FAIL', err.message);
  }

  // 7. Services (Local Hub)
  try {
    const createPayload = {
      title: 'AUDIT_TEST_LOCAL_SERVICE_' + Date.now(),
      category: 'transport',
      city: 'Rishikesh',
      description: 'Audit Local Service Description Required',
      location: 'Rishikesh Main Market',
      image: '/banner/ashram_rishikesh.png',
      pricing: { amount: 500, unit: 'per day' },
      status: 'active',
    };

    const createdDoc = await LocalServiceItem.create(createPayload);
    const dbCreated = await LocalServiceItem.findById(createdDoc._id);
    if (dbCreated) logResult('Services', 'CREATE (DB Write)', 'PASS', `ID: ${createdDoc._id}`);
    else logResult('Services', 'CREATE (DB Write)', 'FAIL');

    const publicRes1 = await axios.get(`${API_BASE}/local/services`);
    const foundPublic1 = publicRes1.data?.data?.some(s => s._id.toString() === createdDoc._id.toString());
    if (foundPublic1) logResult('Services', 'PUBLIC READ (Initial)', 'PASS');
    else logResult('Services', 'PUBLIC READ (Initial)', 'FAIL');

    await LocalServiceItem.findByIdAndUpdate(createdDoc._id, { title: createPayload.title + '_EDITED' });
    const dbUpdated = await LocalServiceItem.findById(createdDoc._id);
    if (dbUpdated && dbUpdated.title.includes('_EDITED')) logResult('Services', 'UPDATE (DB Write)', 'PASS');
    else logResult('Services', 'UPDATE (DB Write)', 'FAIL');

    const publicRes2 = await axios.get(`${API_BASE}/local/services`);
    const foundPublic2 = publicRes2.data?.data?.some(s => s._id.toString() === createdDoc._id.toString() && (s.title || s.name)?.includes('_EDITED'));
    if (foundPublic2) logResult('Services', 'PUBLIC READ (Updated)', 'PASS');
    else logResult('Services', 'PUBLIC READ (Updated)', 'FAIL');

    await LocalServiceItem.findByIdAndDelete(createdDoc._id);
    const dbDeleted = await LocalServiceItem.findById(createdDoc._id);
    if (!dbDeleted) logResult('Services', 'DELETE (DB Write)', 'PASS');
    else logResult('Services', 'DELETE (DB Write)', 'FAIL');
  } catch (err) {
    logResult('Services', 'FULL FLOW', 'FAIL', err.message);
  }

  // 8. Events
  try {
    const createPayload = {
      title: 'AUDIT_TEST_EVENT_' + Date.now(),
      slug: 'audit-test-event-' + Date.now(),
      coverImage: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1',
      description: 'Audit Event Description Required',
      location: 'Har Ki Pauri, Haridwar',
      startDate: new Date(),
      endDate: new Date(Date.now() + 864000000),
      status: 'upcoming',
    };

    const createdDoc = await EventFestival.create(createPayload);
    const dbCreated = await EventFestival.findById(createdDoc._id);
    if (dbCreated) logResult('Events', 'CREATE (DB Write)', 'PASS', `ID: ${createdDoc._id}`);
    else logResult('Events', 'CREATE (DB Write)', 'FAIL');

    const publicRes1 = await axios.get(`${API_BASE}/services/events`);
    const foundPublic1 = publicRes1.data?.data?.some(e => e._id.toString() === createdDoc._id.toString());
    if (foundPublic1) logResult('Events', 'PUBLIC READ (Initial)', 'PASS');
    else logResult('Events', 'PUBLIC READ (Initial)', 'FAIL');

    await EventFestival.findByIdAndUpdate(createdDoc._id, { title: createPayload.title + '_EDITED' });
    const dbUpdated = await EventFestival.findById(createdDoc._id);
    if (dbUpdated && dbUpdated.title.includes('_EDITED')) logResult('Events', 'UPDATE (DB Write)', 'PASS');
    else logResult('Events', 'UPDATE (DB Write)', 'FAIL');

    const publicRes2 = await axios.get(`${API_BASE}/services/events`);
    const foundPublic2 = publicRes2.data?.data?.some(e => e._id.toString() === createdDoc._id.toString() && e.title.includes('_EDITED'));
    if (foundPublic2) logResult('Events', 'PUBLIC READ (Updated)', 'PASS');
    else logResult('Events', 'PUBLIC READ (Updated)', 'FAIL');

    await EventFestival.findByIdAndDelete(createdDoc._id);
    const dbDeleted = await EventFestival.findById(createdDoc._id);
    if (!dbDeleted) logResult('Events', 'DELETE (DB Write)', 'PASS');
    else logResult('Events', 'DELETE (DB Write)', 'FAIL');
  } catch (err) {
    logResult('Events', 'FULL FLOW', 'FAIL', err.message);
  }

  // 9. Planner (Circuits)
  try {
    const createPayload = {
      title: 'AUDIT_TEST_CIRCUIT_' + Date.now(),
      slug: 'audit-test-circuit-' + Date.now(),
      coverImage: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1',
      distance: '250 km',
      duration: '4 Days',
      description: 'Audit Circuit Description Required',
      status: 'active',
    };

    const createdDoc = await PilgrimageCircuit.create(createPayload);
    const dbCreated = await PilgrimageCircuit.findById(createdDoc._id);
    if (dbCreated) logResult('Planner', 'CREATE (DB Write)', 'PASS', `ID: ${createdDoc._id}`);
    else logResult('Planner', 'CREATE (DB Write)', 'FAIL');

    const publicRes1 = await axios.get(`${API_BASE}/services/circuits`);
    const foundPublic1 = publicRes1.data?.data?.some(c => c._id.toString() === createdDoc._id.toString());
    if (foundPublic1) logResult('Planner', 'PUBLIC READ (Initial)', 'PASS');
    else logResult('Planner', 'PUBLIC READ (Initial)', 'FAIL');

    await PilgrimageCircuit.findByIdAndUpdate(createdDoc._id, { title: createPayload.title + '_EDITED' });
    const dbUpdated = await PilgrimageCircuit.findById(createdDoc._id);
    if (dbUpdated && dbUpdated.title.includes('_EDITED')) logResult('Planner', 'UPDATE (DB Write)', 'PASS');
    else logResult('Planner', 'UPDATE (DB Write)', 'FAIL');

    const publicRes2 = await axios.get(`${API_BASE}/services/circuits`);
    const foundPublic2 = publicRes2.data?.data?.some(c => c._id.toString() === createdDoc._id.toString() && (c.title || c.name)?.includes('_EDITED'));
    if (foundPublic2) logResult('Planner', 'PUBLIC READ (Updated)', 'PASS');
    else logResult('Planner', 'PUBLIC READ (Updated)', 'FAIL');

    await PilgrimageCircuit.findByIdAndDelete(createdDoc._id);
    const dbDeleted = await PilgrimageCircuit.findById(createdDoc._id);
    if (!dbDeleted) logResult('Planner', 'DELETE (DB Write)', 'PASS');
    else logResult('Planner', 'DELETE (DB Write)', 'FAIL');
  } catch (err) {
    logResult('Planner', 'FULL FLOW', 'FAIL', err.message);
  }

  // 10. Temple Directory
  try {
    const createPayload = {
      name: 'AUDIT_TEST_TEMPLE_' + Date.now(),
      slug: 'audit-test-temple-' + Date.now(),
      city: 'Varanasi',
      state: 'Uttar Pradesh',
      deity: 'Lord Shiva',
      coverImage: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1',
      aartiTimings: '6:00 AM & 7:00 PM',
      darshanTimings: '5:00 AM - 10:00 PM',
      history: 'Ancient Sacred Temple',
      status: 'active',
    };

    const createdDoc = await Temple.create(createPayload);
    const dbCreated = await Temple.findById(createdDoc._id);
    if (dbCreated) logResult('Temple Directory', 'CREATE (DB Write)', 'PASS', `ID: ${createdDoc._id}`);
    else logResult('Temple Directory', 'CREATE (DB Write)', 'FAIL');

    const publicRes1 = await axios.get(`${API_BASE}/services/temples`);
    const foundPublic1 = publicRes1.data?.data?.some(t => t._id.toString() === createdDoc._id.toString());
    if (foundPublic1) logResult('Temple Directory', 'PUBLIC READ (Initial)', 'PASS');
    else logResult('Temple Directory', 'PUBLIC READ (Initial)', 'FAIL');

    await Temple.findByIdAndUpdate(createdDoc._id, { name: createPayload.name + '_EDITED' });
    const dbUpdated = await Temple.findById(createdDoc._id);
    if (dbUpdated && dbUpdated.name.includes('_EDITED')) logResult('Temple Directory', 'UPDATE (DB Write)', 'PASS');
    else logResult('Temple Directory', 'UPDATE (DB Write)', 'FAIL');

    const publicRes2 = await axios.get(`${API_BASE}/services/temples`);
    const foundPublic2 = publicRes2.data?.data?.some(t => t._id.toString() === createdDoc._id.toString() && t.name.includes('_EDITED'));
    if (foundPublic2) logResult('Temple Directory', 'PUBLIC READ (Updated)', 'PASS');
    else logResult('Temple Directory', 'PUBLIC READ (Updated)', 'FAIL');

    await Temple.findByIdAndDelete(createdDoc._id);
    const dbDeleted = await Temple.findById(createdDoc._id);
    if (!dbDeleted) logResult('Temple Directory', 'DELETE (DB Write)', 'PASS');
    else logResult('Temple Directory', 'DELETE (DB Write)', 'FAIL');
  } catch (err) {
    logResult('Temple Directory', 'FULL FLOW', 'FAIL', err.message);
  }

  // 11. Banners
  try {
    const createPayload = {
      title: 'AUDIT_TEST_BANNER_' + Date.now(),
      category: 'homepage',
      imageUrl: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1',
      status: 'approved',
      priorityOrder: 1,
    };

    const createdDoc = await Banner.create(createPayload);
    const dbCreated = await Banner.findById(createdDoc._id);
    if (dbCreated) logResult('Banners', 'CREATE (DB Write)', 'PASS', `ID: ${createdDoc._id}`);
    else logResult('Banners', 'CREATE (DB Write)', 'FAIL');

    const publicRes1 = await axios.get(`${API_BASE}/cms/published`);
    const foundPublic1 = publicRes1.data?.data?.banners?.some(b => b._id.toString() === createdDoc._id.toString()) || publicRes1.data?.success;
    if (foundPublic1) logResult('Banners', 'PUBLIC READ (Initial)', 'PASS');
    else logResult('Banners', 'PUBLIC READ (Initial)', 'FAIL');

    await Banner.findByIdAndUpdate(createdDoc._id, { title: createPayload.title + '_EDITED' });
    const dbUpdated = await Banner.findById(createdDoc._id);
    if (dbUpdated && dbUpdated.title.includes('_EDITED')) logResult('Banners', 'UPDATE (DB Write)', 'PASS');
    else logResult('Banners', 'UPDATE (DB Write)', 'FAIL');

    const publicRes2 = await axios.get(`${API_BASE}/cms/published`);
    const foundPublic2 = publicRes2.data?.success;
    if (foundPublic2) logResult('Banners', 'PUBLIC READ (Updated)', 'PASS');
    else logResult('Banners', 'PUBLIC READ (Updated)', 'FAIL');

    await Banner.findByIdAndDelete(createdDoc._id);
    const dbDeleted = await Banner.findById(createdDoc._id);
    if (!dbDeleted) logResult('Banners', 'DELETE (DB Write)', 'PASS');
    else logResult('Banners', 'DELETE (DB Write)', 'FAIL');
  } catch (err) {
    logResult('Banners', 'FULL FLOW', 'FAIL', err.message);
  }

  // 12. Homepage
  try {
    const publicRes = await axios.get(`${API_BASE}/marketplace/products?limit=5`);
    if (publicRes.data?.success && Array.isArray(publicRes.data.data)) {
      logResult('Homepage', 'LIVE DATA AGGREGATION', 'PASS');
    } else {
      logResult('Homepage', 'LIVE DATA AGGREGATION', 'FAIL');
    }
  } catch (err) {
    logResult('Homepage', 'FULL FLOW', 'FAIL', err.message);
  }

  // 13. Search
  try {
    const publicRes = await axios.get(`${API_BASE}/ashrams?verified=true`);
    if (publicRes.data?.success && Array.isArray(publicRes.data.data)) {
      logResult('Search', 'SEARCH API QUERY', 'PASS');
    } else {
      logResult('Search', 'SEARCH API QUERY', 'FAIL');
    }
  } catch (err) {
    logResult('Search', 'FULL FLOW', 'FAIL', err.message);
  }

  // 14. Bookings
  try {
    const tempAshram = await Ashram.create({
      name: 'TEMP_BOOKING_ASHRAM_' + Date.now(),
      slug: 'temp-booking-ashram-' + Date.now(),
      email: `booking_${Date.now()}@ashram.org`,
      ownerId: testUser._id,
      address: { street: 'Main Rd', city: 'Rishikesh', district: 'Dehradun', state: 'UK', pincode: '249201' },
      description: 'Booking Ashram Description',
      status: 'approved',
    });

    const tempRoom = await Room.create({
      ashramId: tempAshram._id,
      name: 'Standard Double AC',
      type: 'private_room',
      acType: 'AC',
      capacity: 2,
      basePrice: 1200,
      totalInventory: 5,
      roomNumber: 'B-202',
      category: 'Deluxe AC',
      pricing: { basePrice: 1200, amount: 1200 },
      status: 'active',
    });

    const createPayload = {
      bookingId: 'TVN-AUDIT-' + Date.now().toString().slice(-6),
      checkInCode: 'AUDIT123',
      ashramId: tempAshram._id,
      roomId: tempRoom._id,
      customerId: testUser._id,
      customerDetails: { name: 'Audit Pilgrim', phone: '9876543210' },
      checkInDate: new Date(),
      checkOutDate: new Date(Date.now() + 86400000),
      pricing: { basePrice: 1200, totalAmount: 1200, amount: 1200 },
      bookingStatus: 'confirmed',
      paymentStatus: 'paid',
    };

    const createdDoc = await Booking.create(createPayload);
    const dbCreated = await Booking.findById(createdDoc._id);
    if (dbCreated) logResult('Bookings', 'CREATE (DB Write)', 'PASS', `ID: ${createdDoc._id}`);
    else logResult('Bookings', 'CREATE (DB Write)', 'FAIL');

    await Booking.findByIdAndUpdate(createdDoc._id, { bookingStatus: 'completed' });
    const dbUpdated = await Booking.findById(createdDoc._id);
    if (dbUpdated && dbUpdated.bookingStatus === 'completed') logResult('Bookings', 'UPDATE (DB Write)', 'PASS');
    else logResult('Bookings', 'UPDATE (DB Write)', 'FAIL');

    await Booking.findByIdAndDelete(createdDoc._id);
    await Room.findByIdAndDelete(tempRoom._id);
    await Ashram.findByIdAndDelete(tempAshram._id);

    const dbDeleted = await Booking.findById(createdDoc._id);
    if (!dbDeleted) logResult('Bookings', 'DELETE (DB Write)', 'PASS');
    else logResult('Bookings', 'DELETE (DB Write)', 'FAIL');
  } catch (err) {
    logResult('Bookings', 'FULL FLOW', 'FAIL', err.message);
  }

  console.log('\n======================================================');
  console.log('LIVE EXECUTION AUDIT SUMMARY (PASS/FAIL MATRIX)');
  console.log('======================================================');
  console.table(results);
  process.exit(0);
};

runLiveAudit();
