import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Ashram from '../models/Ashram.js';
import Room from '../models/Room.js';
import RoomAvailability from '../models/RoomAvailability.js';
import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import Payment from '../models/Payment.js';
import AuditLog from '../models/AuditLog.js';
import SupportTicket from '../models/SupportTicket.js';

dotenv.config();

const connStr = process.env.MONGODB_URI || 'mongodb://localhost:27017/ashray_bharat';

const clearDemoRecords = async (userIds, roomIds, seededAshramIds) => {
  console.log('Cleaning existing demo transaction records...');
  
  // Clean all old ashrams not in the newly seeded list
  const ashramDelete = await Ashram.deleteMany({ _id: { $nin: seededAshramIds } });
  console.log(`Deleted ${ashramDelete.deletedCount} old obsolete ashrams.`);

  // Clean all old rooms not in the newly seeded list
  const roomDelete = await Room.deleteMany({ _id: { $nin: roomIds } });
  console.log(`Deleted ${roomDelete.deletedCount} old obsolete rooms.`);

  // Delete all bookings associated with seeded demo users or rooms
  const bookingDelete = await Booking.deleteMany({
    $or: [
      { customerId: { $in: userIds } },
      { roomId: { $in: roomIds } }
    ]
  });
  console.log(`Deleted ${bookingDelete.deletedCount} existing demo bookings.`);

  // Delete all payments associated with seeded demo users
  const paymentDelete = await Payment.deleteMany({ userId: { $in: userIds } });
  console.log(`Deleted ${paymentDelete.deletedCount} existing demo payments.`);

  // Delete all reviews associated with seeded demo users
  const reviewDelete = await Review.deleteMany({ customerId: { $in: userIds } });
  console.log(`Deleted ${reviewDelete.deletedCount} existing demo reviews.`);

  // Delete all audit logs associated with seeded demo users
  const auditDelete = await AuditLog.deleteMany({ userId: { $in: userIds } });
  console.log(`Deleted ${auditDelete.deletedCount} existing demo audit logs.`);

  // Delete all support tickets associated with seeded demo users
  const supportDelete = await SupportTicket.deleteMany({ userId: { $in: userIds } });
  console.log(`Deleted ${supportDelete.deletedCount} existing demo support tickets.`);

  // Delete all room availability records for seeded demo rooms
  const availabilityDelete = await RoomAvailability.deleteMany({ roomId: { $in: roomIds } });
  console.log(`Deleted ${availabilityDelete.deletedCount} existing availability records.`);

  console.log('Demo transaction records cleaned successfully.');
};

const upsertUser = async (userData) => {
  let user = await User.findOne({ email: userData.email });
  if (!user) {
    user = await User.create(userData);
    console.log(`Created user: ${userData.email} (${userData.role})`);
  } else {
    user.name = userData.name;
    user.phone = userData.phone;
    user.role = userData.role;
    user.status = userData.status;
    user.passwordHash = userData.passwordHash;
    if (userData.district) user.district = userData.district;
    if (userData.state) user.state = userData.state;
    if (userData.govtId) user.govtId = userData.govtId;
    await user.save();
    console.log(`Updated user: ${userData.email} (${userData.role})`);
  }
  return user;
};

const upsertAshram = async (ashramData) => {
  let ashram = await Ashram.findOne({ name: ashramData.name });
  if (!ashram) {
    ashram = await Ashram.create(ashramData);
    console.log(`Created ashram: ${ashramData.name}`);
  } else {
    Object.assign(ashram, ashramData);
    await ashram.save();
    console.log(`Updated ashram: ${ashramData.name}`);
  }
  return ashram;
};

const upsertRoom = async (roomData) => {
  let room = await Room.findOne({ ashramId: roomData.ashramId, name: roomData.name });
  if (!room) {
    room = await Room.create(roomData);
  } else {
    Object.assign(room, roomData);
    await room.save();
  }
  return room;
};

const seedUsers = async () => {
  console.log('Seeding core and auxiliary users...');

  // Create Pilgrim / Customer
  const pilgrim = await upsertUser({
    name: 'Rajesh Sharma (Pilgrim)',
    email: 'pilgrim@tirvona.com',
    phone: '6666666666',
    passwordHash: 'admin123',
    role: 'customer',
    status: 'active'
  });

  // Create Owner
  const owner = await upsertUser({
    name: 'Swami Chinmayananda (Ashram Trust)',
    email: 'owner@tirvona.com',
    phone: '7777777777',
    passwordHash: 'admin123',
    role: 'owner',
    status: 'active'
  });

  // Create District Officer
  const officer = await upsertUser({
    name: 'Shri A. K. Dwivedi (District Magistrate)',
    email: 'officer@tirvona.com',
    phone: '8888888888',
    passwordHash: 'admin123',
    role: 'district_officer',
    district: 'Haridwar',
    state: 'Uttarakhand',
    status: 'active',
    govtId: {
      idType: 'Service ID',
      idNumber: 'GOV-DO-HAR-0921',
      documentUrl: 'https://res.cloudinary.com/ashray-bharat/raw/upload/ids/do_id_mock.pdf'
    }
  });

  // Create Super Admin
  const admin = await upsertUser({
    name: 'National Admin (Ministry of Tourism)',
    email: 'admin@tirvona.com',
    phone: '9999999999',
    passwordHash: 'admin123',
    role: 'super_admin',
    status: 'active'
  });

  // Create Govt Admin
  const govtAdmin = await upsertUser({
    name: 'Shri R. K. Singh (Director General Tourism)',
    email: 'govt.admin@tirvona.com',
    phone: '9123456780',
    passwordHash: 'admin123',
    role: 'govt_admin',
    state: 'Uttarakhand',
    status: 'active'
  });

  // Create Manager
  const manager = await upsertUser({
    name: 'Mohan Lal (Ashram Manager)',
    email: 'manager@tirvona.com',
    phone: '9123456781',
    passwordHash: 'admin123',
    role: 'manager',
    status: 'active'
  });

  // Create Receptionist
  const receptionist = await upsertUser({
    name: 'Karan Singh (Front Desk)',
    email: 'reception@tirvona.com',
    phone: '9123456782',
    passwordHash: 'admin123',
    role: 'reception',
    status: 'active'
  });

  // Create Housekeeping
  const housekeeping = await upsertUser({
    name: 'Ramu Prasad (Housekeeping Head)',
    email: 'housekeeping@tirvona.com',
    phone: '9123456783',
    passwordHash: 'admin123',
    role: 'housekeeping',
    status: 'active'
  });

  // Create Support Executive
  const support = await upsertUser({
    name: 'Amit Kumar (Support Lead)',
    email: 'support@tirvona.com',
    phone: '9123456784',
    passwordHash: 'admin123',
    role: 'support',
    status: 'active'
  });

  // Additional Customer Accounts for simulated review generation
  const simulatedPilgrims = [];
  const pilgrimNames = [
    'Aarav Patel', 'Ishaan Iyer', 'Vihaan Gupta', 'Siddharth Roy',
    'Meera Krishnan', 'Ananya Deshmukh', 'Aditya Verma', 'Rohan Mehta',
    'Sneha Joshi', 'Rahul Nair', 'Kavita Rao', 'Pooja Bhatia',
    'Vikram Singh', 'Pranav Mishra', 'Tanvi Desai', 'Deepak Choudhary'
  ];

  for (let i = 0; i < pilgrimNames.length; i++) {
    const p = await upsertUser({
      name: pilgrimNames[i],
      email: `pilgrim.${i + 1}@tirvona.com`,
      phone: `91000000${10 + i}`,
      passwordHash: 'admin123',
      role: 'customer',
      status: 'active'
    });
    simulatedPilgrims.push(p);
  }

  console.log('Core and auxiliary users seeded successfully.');
  return { pilgrim, owner, officer, admin, govtAdmin, manager, receptionist, housekeeping, support, simulatedPilgrims };
};

const getRoomImages = () => {
  return {
    dormitory: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80',
    private_room: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
    double_room: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=800&q=80',
    family_room: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80',
    deluxe_room: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80',
    vip_suite: 'https://images.unsplash.com/photo-1582719478250-c89cae4db85b?auto=format&fit=crop&w=800&q=80'
  };
};

const getAshramRooms = (idx, roomImages) => {
  const roomSets = [
    // 0: Shantikunj Gayatri Pariwar Ashram (Haridwar) -> Starting ₹200
    [
      { name: 'Gayatri Sadhana Dormitory Bed', type: 'dormitory', ac: 'Non-AC', cap: 1, inventory: 50, price: 200, img: roomImages.dormitory, desc: 'Single bed in quiet, air-cooled shared Gayatri sadhana hall with locker.' },
      { name: 'Standard Single Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 1, inventory: 20, price: 450, img: roomImages.private_room, desc: 'Simple single room with attached bath and garden view.' },
      { name: 'Standard Double Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 2, inventory: 25, price: 750, img: roomImages.double_room, desc: 'Clean double occupancy room for pilgrims.' },
      { name: 'Standard Double AC Room', type: 'private_room', ac: 'AC', cap: 2, inventory: 15, price: 1100, img: roomImages.double_room, desc: 'Air-conditioned double bed room with study desk.' },
      { name: 'Family Suite (4 Beds)', type: 'family_room', ac: 'AC', cap: 4, inventory: 10, price: 1600, img: roomImages.family_room, desc: 'Spacious family hall with four beds and attached bath.' },
      { name: 'Deluxe Himalayan View Suite', type: 'private_room', ac: 'AC', cap: 3, inventory: 8, price: 2000, img: roomImages.deluxe_room, desc: 'Balcony view of Devatma Himalaya temple.' }
    ],

    // 1: Prem Nagar Ashram (Haridwar) -> Starting ₹250
    [
      { name: 'Universal Peace Shared Dorm Bed', type: 'dormitory', ac: 'Non-AC', cap: 1, inventory: 40, price: 250, img: roomImages.dormitory, desc: 'Air-cooled shared dormitory in Prem Nagar campus.' },
      { name: 'Single Garden-Facing Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 1, inventory: 18, price: 500, img: roomImages.private_room, desc: 'Quiet single room facing flower gardens.' },
      { name: 'Double Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 2, inventory: 20, price: 850, img: roomImages.double_room, desc: 'Comfortable double bed room.' },
      { name: 'Double AC Room', type: 'private_room', ac: 'AC', cap: 2, inventory: 12, price: 1300, img: roomImages.double_room, desc: 'Cool AC double room with hot water shower.' },
      { name: 'Family Suite (4 Beds)', type: 'family_room', ac: 'AC', cap: 4, inventory: 8, price: 1900, img: roomImages.family_room, desc: 'Large suite for pilgrim families.' },
      { name: 'Spiritual Garden View Deluxe Suite', type: 'private_room', ac: 'AC', cap: 3, inventory: 6, price: 2300, img: roomImages.deluxe_room, desc: 'Premium room overlooking fountains and gardens.' }
    ],

    // 2: Bharat Sevashram Sangha (Haridwar) -> Starting ₹120
    [
      { name: 'Pilgrim Subsidy Shared Dorm Bed', type: 'dormitory', ac: 'Non-AC', cap: 1, inventory: 60, price: 120, img: roomImages.dormitory, desc: 'Economical dormitory bed for devout pilgrims.' },
      { name: 'Economy Single Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 1, inventory: 25, price: 300, img: roomImages.private_room, desc: 'Basic clean single room.' },
      { name: 'Economy Double Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 2, inventory: 30, price: 550, img: roomImages.double_room, desc: 'Standard double bed room with attached bath.' },
      { name: 'Standard AC Twin Bed Room', type: 'private_room', ac: 'AC', cap: 2, inventory: 10, price: 950, img: roomImages.double_room, desc: 'Air-conditioned room with twin beds.' },
      { name: 'Family Hall (5 Beds)', type: 'family_room', ac: 'Non-AC', cap: 5, inventory: 8, price: 1100, img: roomImages.family_room, desc: 'Economical large hall for pilgrim groups.' }
    ],

    // 3: Maa Anandamayi Ashram (Haridwar) -> Starting ₹180
    [
      { name: 'Quiet Meditation Shared Dorm Bed', type: 'dormitory', ac: 'Non-AC', cap: 1, inventory: 35, price: 180, img: roomImages.dormitory, desc: 'Silent dormitory bed near Samadhi hall.' },
      { name: 'Single Quiet Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 1, inventory: 15, price: 400, img: roomImages.private_room, desc: 'Peaceful single room for introspection.' },
      { name: 'Standard Double Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 2, inventory: 18, price: 700, img: roomImages.double_room, desc: 'Quiet twin bed room.' },
      { name: 'Standard Double AC Room', type: 'private_room', ac: 'AC', cap: 2, inventory: 10, price: 1150, img: roomImages.double_room, desc: 'Air-conditioned room with work desk.' },
      { name: 'Samadhi View Family Room', type: 'family_room', ac: 'AC', cap: 4, inventory: 6, price: 1750, img: roomImages.family_room, desc: 'Spacious room overlooking inner courtyard.' }
    ],

    // 4: Sapt Rishi Ashram (Haridwar) -> Starting ₹150
    [
      { name: 'Saptarishi Seven-Stream Dorm Bed', type: 'dormitory', ac: 'Non-AC', cap: 1, inventory: 45, price: 150, img: roomImages.dormitory, desc: 'Shared bed near Ganga Sapt Dhara stream.' },
      { name: 'Simple Single Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 1, inventory: 20, price: 350, img: roomImages.private_room, desc: 'Simple ventilated single room.' },
      { name: 'Standard Twin Room', type: 'private_room', ac: 'Non-AC', cap: 2, inventory: 22, price: 600, img: roomImages.double_room, desc: 'Double bed room with river breeze.' },
      { name: 'Standard AC Double Room', type: 'private_room', ac: 'AC', cap: 2, inventory: 12, price: 1050, img: roomImages.double_room, desc: 'AC double room with attached hot water bath.' },
      { name: 'Family Retreat Room (4 Beds)', type: 'family_room', ac: 'AC', cap: 4, inventory: 8, price: 1550, img: roomImages.family_room, desc: 'Large retreat room for families.' }
    ],

    // 5: Parmarth Niketan Ashram (Rishikesh) -> Starting ₹300
    [
      { name: 'Ganga Ghat Shared Dormitory Bed', type: 'dormitory', ac: 'Non-AC', cap: 1, inventory: 50, price: 300, img: roomImages.dormitory, desc: 'Bed in iconic Parmarth Niketan dormitory.' },
      { name: 'Standard Single Ganges Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 1, inventory: 25, price: 650, img: roomImages.private_room, desc: 'Single room near yoga halls.' },
      { name: 'Deluxe Double Room', type: 'private_room', ac: 'Non-AC', cap: 2, inventory: 30, price: 1250, img: roomImages.double_room, desc: 'Twin beds room with attached bath and fan.' },
      { name: 'Deluxe Double AC Room with Balcony', type: 'private_room', ac: 'AC', cap: 2, inventory: 20, price: 1800, img: roomImages.double_room, desc: 'AC room with private balcony view.' },
      { name: 'Family Suite (4 Beds)', type: 'family_room', ac: 'AC', cap: 4, inventory: 12, price: 2500, img: roomImages.family_room, desc: 'Spacious air-conditioned suite.' },
      { name: 'Executive Ganga View Suite', type: 'private_room', ac: 'AC', cap: 2, inventory: 5, price: 3400, img: roomImages.vip_suite, desc: 'Direct view of sunset Ganga Aarti.' }
    ],

    // 6: Sivananda Ashram (Rishikesh) -> Starting ₹220
    [
      { name: 'Divine Life Yoga Dormitory Bed', type: 'dormitory', ac: 'Non-AC', cap: 1, inventory: 30, price: 220, img: roomImages.dormitory, desc: 'Shared bed in Divine Life Society campus.' },
      { name: 'Sadhana Single Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 1, inventory: 15, price: 480, img: roomImages.private_room, desc: 'Simple quiet single room for yoga practitioners.' },
      { name: 'Sadhana Double Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 2, inventory: 18, price: 850, img: roomImages.double_room, desc: 'Standard double bed room.' },
      { name: 'Executive Double AC Room', type: 'private_room', ac: 'AC', cap: 2, inventory: 10, price: 1450, img: roomImages.double_room, desc: 'Air-conditioned double room.' },
      { name: 'Premium Spiritual Suite', type: 'private_room', ac: 'AC', cap: 3, inventory: 4, price: 2200, img: roomImages.vip_suite, desc: 'Spacious suite with study desk and terrace view.' }
    ],

    // 7: Swami Dayananda Ashram (Rishikesh) -> Starting ₹280
    [
      { name: 'Vedanta Study Dormitory Bed', type: 'dormitory', ac: 'Non-AC', cap: 1, inventory: 25, price: 280, img: roomImages.dormitory, desc: 'Quiet bed for Vedanta students.' },
      { name: 'Courtyard Single Room', type: 'private_room', ac: 'Non-AC', cap: 1, inventory: 12, price: 550, img: roomImages.private_room, desc: 'Single room facing temple courtyard.' },
      { name: 'Riverfront Double Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 2, inventory: 15, price: 950, img: roomImages.double_room, desc: 'Twin beds room right by Ganga canal.' },
      { name: 'Riverfront Double AC Room', type: 'private_room', ac: 'AC', cap: 2, inventory: 10, price: 1450, img: roomImages.double_room, desc: 'Air-conditioned room with river view.' },
      { name: 'Study Suite with Library Access', type: 'private_room', ac: 'AC', cap: 2, inventory: 5, price: 2100, img: roomImages.deluxe_room, desc: 'Spacious room with study setup.' }
    ],

    // 8: Omkarananda Ashram Himalayas (Rishikesh) -> Starting ₹350
    [
      { name: 'Himalayan Quiet Dormitory Bed', type: 'dormitory', ac: 'Non-AC', cap: 1, inventory: 20, price: 350, img: roomImages.dormitory, desc: 'Clean dormitory bed in Muni Ki Reti.' },
      { name: 'Classic Single Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 1, inventory: 10, price: 700, img: roomImages.private_room, desc: 'Comfortable single room.' },
      { name: 'Classic Double AC Room', type: 'private_room', ac: 'AC', cap: 2, inventory: 15, price: 1350, img: roomImages.double_room, desc: 'Modern AC double room.' },
      { name: 'Deluxe Studio Apartment', type: 'private_room', ac: 'AC', cap: 3, inventory: 8, price: 2600, img: roomImages.deluxe_room, desc: 'Studio apartment with kitchenette.' },
      { name: 'Royal Himalayan Family Suite', type: 'private_room', ac: 'AC', cap: 4, inventory: 4, price: 3800, img: roomImages.vip_suite, desc: 'Luxury suite with mountain panoramas.' }
    ],

    // 9: Gita Bhawan Retreat (Rishikesh) -> Starting ₹100
    [
      { name: 'Subsidized Pilgrim Dormitory Bed', type: 'dormitory', ac: 'Non-AC', cap: 1, inventory: 100, price: 100, img: roomImages.dormitory, desc: 'Highly subsidized clean bed for devotees.' },
      { name: 'Economy Single Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 1, inventory: 30, price: 250, img: roomImages.private_room, desc: 'Simple economical single room.' },
      { name: 'Standard Double Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 2, inventory: 40, price: 480, img: roomImages.double_room, desc: 'Clean double room with attached bath.' },
      { name: 'Standard Triple Room', type: 'private_room', ac: 'Non-AC', cap: 3, inventory: 20, price: 680, img: roomImages.double_room, desc: 'Triple bed room for families.' },
      { name: 'Family Cottage (5 Beds)', type: 'family_room', ac: 'AC', cap: 5, inventory: 10, price: 1250, img: roomImages.family_room, desc: 'Spacious cottage near Ganga ferry.' }
    ],

    // 10: ISKCON Vrindavan Guesthouse (Vrindavan) -> Starting ₹450
    [
      { name: 'Devotee Shared Dormitory Bed', type: 'dormitory', ac: 'AC', cap: 1, inventory: 30, price: 450, img: roomImages.dormitory, desc: 'Air-conditioned dormitory bed inside ISKCON complex.' },
      { name: 'Standard Single AC Room', type: 'private_room', ac: 'AC', cap: 1, inventory: 15, price: 950, img: roomImages.private_room, desc: 'Quiet AC single room.' },
      { name: 'Standard Double AC Room', type: 'private_room', ac: 'AC', cap: 2, inventory: 25, price: 1650, img: roomImages.double_room, desc: 'Air-conditioned room with twin beds.' },
      { name: 'Temple View Family Suite', type: 'family_room', ac: 'AC', cap: 4, inventory: 10, price: 2800, img: roomImages.family_room, desc: 'Overlooks Krishna Balaram Mandir.' },
      { name: 'Executive Prabhupada VIP Suite', type: 'private_room', ac: 'AC', cap: 2, inventory: 4, price: 4800, img: roomImages.vip_suite, desc: 'Premium luxury suite for visiting dignitaries.' }
    ],

    // 11: MVT Guesthouse Vrindavan (Vrindavan) -> Starting ₹850
    [
      { name: 'Garden View Single Room', type: 'private_room', ac: 'AC', cap: 1, inventory: 10, price: 850, img: roomImages.private_room, desc: 'Peaceful single room in garden compound.' },
      { name: 'Standard Double AC Room', type: 'private_room', ac: 'AC', cap: 2, inventory: 15, price: 1750, img: roomImages.double_room, desc: 'Deluxe double room with WiFi and AC.' },
      { name: 'Deluxe 2-BHK Family Apartment', type: 'family_room', ac: 'AC', cap: 4, inventory: 8, price: 3500, img: roomImages.family_room, desc: 'Fully furnished 2-BHK apartment with kitchen.' },
      { name: 'Penthouse Suite with Terrace', type: 'private_room', ac: 'AC', cap: 3, inventory: 3, price: 5500, img: roomImages.vip_suite, desc: 'Top floor penthouse with private roof terrace.' }
    ],

    // 12: Prem Mandir Dharamshala JKP (Vrindavan) -> Starting ₹320
    [
      { name: 'JKP Pilgrim Shared Dormitory Bed', type: 'dormitory', ac: 'Non-AC', cap: 1, inventory: 40, price: 320, img: roomImages.dormitory, desc: 'Bed in JKP Dharamshala hall.' },
      { name: 'Standard Double Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 2, inventory: 20, price: 750, img: roomImages.double_room, desc: 'Double bed room near Prem Mandir.' },
      { name: 'Standard Double AC Room', type: 'private_room', ac: 'AC', cap: 2, inventory: 25, price: 1250, img: roomImages.double_room, desc: 'AC double room with lift access.' },
      { name: 'Premium Family Suite (4 Beds)', type: 'family_room', ac: 'AC', cap: 4, inventory: 12, price: 2200, img: roomImages.family_room, desc: 'Family suite with 4 beds.' },
      { name: 'Grand Family Hall (6 Beds)', type: 'family_room', ac: 'AC', cap: 6, inventory: 5, price: 3200, img: roomImages.family_room, desc: 'Large hall for family groups.' }
    ],

    // 13: Fogla Ashram Vrindavan (Vrindavan) -> Starting ₹160
    [
      { name: 'Raman Reti Economy Dorm Bed', type: 'dormitory', ac: 'Non-AC', cap: 1, inventory: 50, price: 160, img: roomImages.dormitory, desc: 'Economical shared bed in Fogla Ashram.' },
      { name: 'Standard Single Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 1, inventory: 20, price: 380, img: roomImages.private_room, desc: 'Simple clean single room.' },
      { name: 'Standard Double Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 2, inventory: 25, price: 620, img: roomImages.double_room, desc: 'Double room with attached bath.' },
      { name: 'Standard Double AC Room', type: 'private_room', ac: 'AC', cap: 2, inventory: 15, price: 980, img: roomImages.double_room, desc: 'Air-conditioned double bed room.' },
      { name: 'Family AC Room (4 Beds)', type: 'family_room', ac: 'AC', cap: 4, inventory: 8, price: 1650, img: roomImages.family_room, desc: 'AC room for 4 guests.' }
    ],

    // 14: Bhagwat Dham Ashram (Vrindavan) -> Starting ₹240
    [
      { name: 'Satsang Shared Dormitory Bed', type: 'dormitory', ac: 'Non-AC', cap: 1, inventory: 35, price: 240, img: roomImages.dormitory, desc: 'Shared bed in Bhagwat discourse hall.' },
      { name: 'Traditional Single Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 1, inventory: 15, price: 460, img: roomImages.private_room, desc: 'Quiet single room.' },
      { name: 'Traditional Double Non-AC Room', type: 'private_room', ac: 'Non-AC', cap: 2, inventory: 18, price: 780, img: roomImages.double_room, desc: 'Traditional double bed room.' },
      { name: 'Traditional Double AC Room', type: 'private_room', ac: 'AC', cap: 2, inventory: 12, price: 1200, img: roomImages.double_room, desc: 'AC double room.' },
      { name: 'Deluxe Family Room (4 Beds)', type: 'family_room', ac: 'AC', cap: 4, inventory: 6, price: 1850, img: roomImages.family_room, desc: 'Spacious room for families.' }
    ]
  ];

  return roomSets[idx % roomSets.length];
};

const seedData = async (users) => {
  const { pilgrim, owner, officer, admin, govtAdmin, manager, receptionist, housekeeping, support, simulatedPilgrims } = users;
  
  const ashramConfigs = [
    // === HARIDWAR (5 Ashrams) ===
    {
      name: 'Shantikunj Gayatri Pariwar Ashram',
      city: 'Haridwar',
      district: 'Haridwar',
      state: 'Uttarakhand',
      pincode: '249411',
      coordinates: [78.1981, 29.9880],
      images: [
        'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1545389336-cf090694435e?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80'
      ],
      description: 'Shantikunj is a world-renowned academy for social and spiritual awakening, serving as the headquarters of All World Gayatri Pariwar (AWGP). Nestled amidst peaceful greenery, it offers a sanctuary for Gayatri sadhana, self-discipline, and moral regeneration.\n\n■ TRAVEL & CONTACT DETAILS:\n• Landmark: Near Dev Sanskriti University\n• Temple: Devatma Himalaya Temple\n• Railway Station: Haridwar Junction (6.2 km)\n• Bus Stand: Haridwar Bus Stand (6.5 km)\n• Contact: +91 1334 260602\n• Website: www.awgp.org',
      history: 'Established in 1971 by the patron founder Pandit Shriram Sharma Acharya, Shantikunj has grown from a spiritual academy into a global movement propagating scientific spirituality and Yagya practices.',
      rules: ['Silent Gayatri Mantra chanting at 4:30 AM is recommended.', 'Strictly satvik vegetarian organic meals served.', 'No entry permitted inside campus after 9:30 PM.', 'Modest clothing covering shoulders and knees is mandatory.'],
      amenities: ['Meditation Hall', 'Pure Vegetarian Food', 'Cow Shelter', 'Gardens', 'Free Medical Dispensary', 'Library', 'Yoga Center'],
      nearbyAttractions: ['Har Ki Pauri', 'Dev Sanskriti Vishwavidyalaya', 'Sapt Rishi Ashram']
    },
    {
      name: 'Prem Nagar Ashram',
      city: 'Haridwar',
      district: 'Haridwar',
      state: 'Uttarakhand',
      pincode: '249407',
      coordinates: [78.1252, 29.9248],
      images: [
        'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80'
      ],
      description: 'Prem Nagar Ashram is a massive spiritual complex designed as a haven of peace and universal brotherhood. It features beautiful garden landscapes, large meditation halls, and daily spiritual discourses.\n\n■ TRAVEL & CONTACT DETAILS:\n• Landmark: Jwalapur Road\n• Temple: Prem Nagar Ashram Mandir\n• Railway Station: Jwalapur Railway Station (3 km)\n• Bus Stand: Haridwar Bus Stand (4.5 km)\n• Contact: +91 1334 240578\n• Website: www.premnagarashram.com',
      history: 'Established in 1943 by Yogiraj Satgurudev Shri Hans Ji Maharaj, it was built by volunteers seeking a common platform for spiritual transmission and universal brotherhood.',
      rules: ['Observe absolute silence in the meditation halls.', 'Outside food is not allowed inside the rooms.', 'Do not waste water or electricity.'],
      amenities: ['Meditation Hall', 'Pure Vegetarian Food', 'Gardens', 'WiFi', 'Lift', 'AC', 'Wheelchair Access', 'Ample Parking'],
      nearbyAttractions: ['Daksh Mahadev Temple', 'Kankhal', 'Hari ki Pauri']
    },
    {
      name: 'Bharat Sevashram Sangha',
      city: 'Haridwar',
      district: 'Haridwar',
      state: 'Uttarakhand',
      pincode: '249401',
      coordinates: [78.1705, 29.9723],
      images: [
        'https://images.unsplash.com/photo-1598977123418-45f04b61582e?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'
      ],
      description: 'A charitable, non-profit ashram offering safe, hygienic, and highly economical lodging for pilgrims. The sangha is active in community service, disaster relief, and free healthcare.\n\n■ TRAVEL & CONTACT DETAILS:\n• Landmark: Bhupatwala\n• Temple: Pranavananda Temple\n• Railway Station: Haridwar Junction (3.8 km)\n• Bus Stand: Haridwar Bus Stand (4.0 km)\n• Contact: +91 1334 265672\n• Website: www.bharatsevashramsangha.org',
      history: 'Bharat Sevashram Sangha was founded in 1917 by Acharya Shrimat Swami Pranavanandaji Maharaj, dedicated to serving the poor and protecting spiritual pilgrims.',
      rules: ['Strict discipline must be maintained on campus.', 'Mandatory attendance for evening Aarti.', 'No room service; self-service is encouraged.'],
      amenities: ['Pure Vegetarian Food', 'Temple', 'Community Kitchen', 'Basic First Aid', 'Security'],
      nearbyAttractions: ['Haridwar Railway Station', 'Har Ki Pauri', 'Chandi Devi Ropeway']
    },
    {
      name: 'Maa Anandamayi Ashram',
      city: 'Haridwar',
      district: 'Haridwar',
      state: 'Uttarakhand',
      pincode: '249408',
      coordinates: [78.1285, 29.9282],
      images: [
        'https://images.unsplash.com/photo-1606293926075-69a007f4e863?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80'
      ],
      description: 'Maa Anandamayi Ashram in Kankhal is a peaceful spiritual retreat housing the holy Samadhi shrine of Sri Maa Anandamayi. It is a quiet oasis for introspection and meditation.\n\n■ TRAVEL & CONTACT DETAILS:\n• Landmark: Kankhal Market\n• Temple: Maa Anandamayi Samadhi Mandir\n• Railway Station: Haridwar Junction (4.5 km)\n• Bus Stand: Haridwar Bus Stand (4.7 km)\n• Contact: +91 1334 246509\n• Website: www.anandamayi.org',
      history: 'Founded to preserve the teachings of spiritual master Sri Anandamayi Ma, the ashram continues to draw seekers from all parts of the globe.',
      rules: ['Respect the silence of the Samadhi hall.', 'Dress modestly in traditional Indian attire.', 'No smoking, tobacco, or alcohol allowed.'],
      amenities: ['Meditation Hall', 'Pure Vegetarian Food', 'Gardens', 'Temple', 'Hot Water'],
      nearbyAttractions: ['Daksha Mahadev Temple', 'Sati Kund', 'Birla Ghat']
    },
    {
      name: 'Sapt Rishi Ashram',
      city: 'Haridwar',
      district: 'Haridwar',
      state: 'Uttarakhand',
      pincode: '249411',
      coordinates: [78.1985, 29.9928],
      images: [
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1582719478250-c89cae4db85b?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=800&q=80'
      ],
      description: 'Sapt Rishi Ashram is an ancient, holy retreat where the Ganga river divides into seven distinct streams (Sapt Dhara). It is a highly peaceful location ideal for intense meditation.\n\n■ TRAVEL & CONTACT DETAILS:\n• Landmark: Sapt Sarovar Marg\n• Temple: Saptarishi Temple\n• Railway Station: Motichur Railway Station (1.5 km)\n• Bus Stand: Haridwar Bus Stand (7.5 km)\n• Contact: Public inquiry desk at gate\n• Website: N/A',
      history: 'According to Hindu mythology, seven great sages (Saptarishis) meditated here. Ganga, not wanting to disturb their deep meditation, split herself into seven channels around them.',
      rules: ['Quietness must be maintained at all times.', 'Guests must keep their rooms clean.', 'Dhoti/Sari or simple kurta-pyjama is preferred.'],
      amenities: ['Meditation Hall', 'Pure Vegetarian Food', 'Gardens', 'River View', 'Cow Shelter'],
      nearbyAttractions: ['Sapt Sarovar', 'Bhimgoda Barrage', 'Har Ki Pauri']
    },

    // === RISHIKESH (5 Ashrams) ===
    {
      name: 'Parmarth Niketan Ashram',
      city: 'Rishikesh',
      district: 'Dehradun',
      state: 'Uttarakhand',
      pincode: '249304',
      coordinates: [78.3125, 30.1191],
      images: [
        '/images/parmarth_niketan/shiva_statue.jpg',
        '/images/parmarth_niketan/aarti_ghat.jpg',
        '/images/parmarth_niketan/yoga_hall.jpg',
        '/images/parmarth_niketan/campus_gardens.jpg',
        '/images/parmarth_niketan/balcony_suite.jpg'
      ],
      description: 'Parmarth Niketan is the largest ashram in Rishikesh. Located on the banks of the holy river Ganges, it provides a clean, pure, and sacred atmosphere with 1000+ rooms for yoga and meditation.\n\n■ TRAVEL & CONTACT DETAILS:\n• Landmark: Near Ram Jhula\n• Temple: Parmarth Mandir & Ganga Ghat\n• Railway Station: Rishikesh Railway Station (4.5 km)\n• Bus Stand: Rishikesh Bus Stand (5.0 km)\n• Contact: +91 135 2434430\n• Website: www.parmarth.org',
      history: 'Founded in 1942 by Pujya Swami Shukdevanandji Maharaj, it is famous globally for its Ganga Aarti at sunset, international Yoga Festival, and humanitarian projects.',
      rules: ['Strict vegetarian diet only.', 'Attend the sunset Ganga Aarti.', 'No smoking, alcohol, or illicit substances.', 'Observe silence during early morning hours.'],
      amenities: ['Meditation Hall', 'River View', 'Pure Vegetarian Food', 'Yoga Center', 'Gardens', 'WiFi', 'Library', 'Wheelchair Access'],
      nearbyAttractions: ['Ram Jhula', 'Laxman Jhula', 'Beatles Ashram', 'Triveni Ghat']
    },
    {
      name: 'Sivananda Ashram',
      city: 'Rishikesh',
      district: 'Tehri Garhwal',
      state: 'Uttarakhand',
      pincode: '249192',
      coordinates: [78.3092, 30.1245],
      images: [
        '/images/sivananda_ashram/divine_life_gate.jpg',
        '/images/sivananda_ashram/vishwanath_temple.jpg',
        '/images/sivananda_ashram/yoga_hall.jpg',
        '/images/sivananda_ashram/sadhana_room.jpg',
        '/images/sivananda_ashram/vedic_library.jpg'
      ],
      description: 'The Divine Life Society (Sivananda Ashram) is a highly respected spiritual institution dedicated to the dissemination of spiritual knowledge and yoga practice.\n\n■ TRAVEL & CONTACT DETAILS:\n• Landmark: Near Shivananda Jhula\n• Temple: Vishwanath Mandir\n• Railway Station: Rishikesh Railway Station (3.5 km)\n• Bus Stand: Rishikesh Bus Stand (3.8 km)\n• Contact: +91 135 2430040\n• Website: www.divinelife.org',
      history: 'Founded in 1936 by the great saint Swami Sivananda Saraswati, this ashram has produced many legendary yoga gurus and continues to distribute free books and medicines.',
      rules: ['Prior written request is required for stays.', 'Daily attendance at morning & evening meditation is expected.', 'Modest white or light clothing preferred.'],
      amenities: ['Meditation Hall', 'Library', 'Pure Vegetarian Food', 'Yoga Center', 'Free Hospital', 'Bookstore'],
      nearbyAttractions: ['Ram Jhula', 'Ganga Ghats', 'Sivananda Jhula']
    },
    {
      name: 'Swami Dayananda Ashram',
      city: 'Rishikesh',
      district: 'Dehradun',
      state: 'Uttarakhand',
      pincode: '249201',
      coordinates: [78.3031, 30.1102],
      images: [
        'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80'
      ],
      description: 'An oasis of tranquility located right on the Ganga canal. It is a premier center for the study of Vedanta, Sanskrit, Upanishads, and Gita.\n\n■ TRAVEL & CONTACT DETAILS:\n• Landmark: Purani Jhadi\n• Temple: Lord Gangadhareswarar Temple\n• Railway Station: Rishikesh Railway Station (2.8 km)\n• Bus Stand: Rishikesh Bus Stand (3.0 km)\n• Contact: +91 135 2430769\n• Website: www.dayanandashram.org',
      history: 'Established in the 1960s by Swami Dayananda Saraswati, a renowned teacher of Vedanta, it features a beautiful temple dedicated to Lord Gangadhareswarar.',
      rules: ['Guests must attend the daily Vedic lectures.', 'Main gates lock at 9:30 PM.', 'Silence must be maintained in the temple courtyard.'],
      amenities: ['Meditation Hall', 'Library', 'Pure Vegetarian Food', 'River View', 'Hot Water', 'WiFi', 'Temple'],
      nearbyAttractions: ['Chandreshwar Mahadev Temple', 'Triveni Ghat', 'Ram Jhula']
    },
    {
      name: 'Omkarananda Ashram Himalayas',
      city: 'Rishikesh',
      district: 'Tehri Garhwal',
      state: 'Uttarakhand',
      pincode: '249192',
      coordinates: [78.3045, 30.1262],
      images: [
        'https://images.unsplash.com/photo-1598977123418-45f04b61582e?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1582719478250-c89cae4db85b?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'
      ],
      description: 'Located in Muni Ki Reti, Omkarananda Ashram is dedicated to spiritual development, yoga, and Hindustani classical arts. It is famous for its strict Vedic discipline.\n\n■ TRAVEL & CONTACT DETAILS:\n• Landmark: Muni Ki Reti\n• Temple: Omkarananda-Kamakshi-Devi Mandir\n• Railway Station: Rishikesh Railway Station (4.0 km)\n• Bus Stand: Rishikesh Bus Stand (4.2 km)\n• Contact: +91 135 2430713\n• Website: www.oah.in',
      history: 'Founded by Sage Omkarananda Saraswati, this ashram is dedicated to spiritual and educational activities, yoga courses, and daily temple pujas in a scenic setting.',
      rules: ['Attend the daily morning rituals.', 'Dress cleanly and modestly.', 'No non-vegetarian items allowed on campus.'],
      amenities: ['Meditation Hall', 'Yoga Center', 'Temple', 'Pure Vegetarian Food', 'Gardens', 'WiFi'],
      nearbyAttractions: ['Ram Jhula', 'Triveni Ghat', 'Neelkanth Temple']
    },
    {
      name: 'Gita Bhawan Retreat',
      city: 'Rishikesh',
      district: 'Dehradun',
      state: 'Uttarakhand',
      pincode: '249304',
      coordinates: [78.3142, 30.1182],
      images: [
        'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1606293926075-69a007f4e863?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=800&q=80'
      ],
      description: 'Geeta Bhawan is a massive complex located on the banks of Ganga, offering free or highly subsidized accommodation for thousands of pilgrims simultaneously.\n\n■ TRAVEL & CONTACT DETAILS:\n• Landmark: Swarg Ashram\n• Temple: Geeta Bhawan Mandir\n• Railway Station: Rishikesh Railway Station (4.8 km)\n• Bus Stand: Rishikesh Bus Stand (5.3 km)\n• Contact: +91 135 2430122\n• Website: www.gitapress.org',
      history: 'Managed by the Gita Press of Gorakhpur, it contains paintings representing events from Ramayana and Mahabharata, and provides free ferry transport across Ganga.',
      rules: ['Strict adherence to religious guidelines.', 'Do not use plastic bags inside the ashram.', 'Keep guest registers updated.'],
      amenities: ['Pure Vegetarian Food', 'River View', 'Temple', 'Dispensary', 'Laxmi Narayan Temple', 'Sanskrit Bookstore'],
      nearbyAttractions: ['Ram Jhula', 'Gita Press Depot', 'Parmarth Aarti Ghat']
    },

    // === VRINDAVAN (5 Ashrams) ===
    {
      name: 'ISKCON Vrindavan Guesthouse',
      city: 'Vrindavan',
      district: 'Mathura',
      state: 'Uttar Pradesh',
      pincode: '281121',
      coordinates: [77.6852, 27.5721],
      images: [
        'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1545389336-cf090694435e?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1582719478250-c89cae4db85b?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80'
      ],
      description: 'Located in the Krishna Balaram Mandir complex, this guesthouse provides standard, deluxe and suite rooms for devotees worldwide. Safe, comfortable, and highly spiritual.\n\n■ TRAVEL & CONTACT DETAILS:\n• Landmark: Raman Reti\n• Temple: Krishna Balaram Mandir\n• Railway Station: Vrindavan Railway Station (2.5 km)\n• Bus Stand: Vrindavan Bus Stand (3.0 km)\n• Contact: +91 565 2540021\n• Website: www.iskconvrindavan.com',
      history: 'Inaugurated in 1975 by ISKCON founder A.C. Bhaktivedanta Swami Prabhupada, it remains a premier destination for international pilgrims visiting Vraja.',
      rules: ['Follow the four regulative principles (No meat/fish/eggs, no intoxication, no gambling, no illicit sex).', 'No entry inside temple complex with shoes.', 'Lockers should be used for valuables.'],
      amenities: ['Meditation Hall', 'Pure Vegetarian Food', 'WiFi', 'AC', 'Lift', 'Wheelchair Access', 'Restaurant', 'Bookstore'],
      nearbyAttractions: ['Krishna Balaram Mandir', 'Prem Mandir', 'Bankey Bihari Temple']
    },
    {
      name: 'MVT Guesthouse Vrindavan',
      city: 'Vrindavan',
      district: 'Mathura',
      state: 'Uttar Pradesh',
      pincode: '281121',
      coordinates: [77.6845, 27.5735],
      images: [
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=800&q=80'
      ],
      description: 'Nestled in a peaceful garden compound right behind ISKCON, MVT provides quiet, premium rooms, apartments, and an excellent pure-vegetarian restaurant.\n\n■ TRAVEL & CONTACT DETAILS:\n• Landmark: Behind ISKCON Temple\n• Temple: Krishna Balaram Temple\n• Railway Station: Vrindavan Railway Station (2.6 km)\n• Bus Stand: Vrindavan Bus Stand (3.2 km)\n• Contact: +91 999 7738666\n• Website: www.mvtvrindavan.com',
      history: 'Built to provide high-quality accommodation for international and Indian devotees visiting Vrindavan for spiritual studies.',
      rules: ['No outside vehicles inside the compound.', 'Strictly vegetarian and no smoking/alcohol.', 'Quiet hours from 10 PM to 6 AM.'],
      amenities: ['Pure Vegetarian Food', 'Gardens', 'WiFi', 'AC', 'Locker access', 'Restaurant', 'Security'],
      nearbyAttractions: ['ISKCON Temple', 'Prem Mandir', 'Kaliya Dah']
    },
    {
      name: 'Prem Mandir Dharamshala JKP',
      city: 'Vrindavan',
      district: 'Mathura',
      state: 'Uttar Pradesh',
      pincode: '281121',
      coordinates: [77.6791, 27.5685],
      images: [
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1598977123418-45f04b61582e?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80'
      ],
      description: 'Conveniently located near the magnificent Prem Mandir, this dharamshala offers spacious rooms for families and pilgrim groups visiting Vrindavan.\n\n■ TRAVEL & CONTACT DETAILS:\n• Landmark: Raman Reti Road\n• Temple: Prem Mandir\n• Railway Station: Vrindavan Railway Station (3.2 km)\n• Bus Stand: Vrindavan Bus Stand (3.5 km)\n• Contact: +91 565 2540050\n• Website: www.jkp.org',
      history: 'Developed by Jagadguru Kripalu Parishat to host devotees coming to witness the light and sound show and temple complex of Prem Mandir.',
      rules: ['Strict vegetarian guidelines apply.', 'Keep room check-in code ready at counter.', 'Lights out at 10:30 PM.'],
      amenities: ['Pure Vegetarian Food', 'Gardens', 'Hot Water', 'Lift', 'Ample Parking', 'AC'],
      nearbyAttractions: ['Prem Mandir', 'Maa Vaishno Devi Dham', 'ISKCON']
    },
    {
      name: 'Fogla Ashram Vrindavan',
      city: 'Vrindavan',
      district: 'Mathura',
      state: 'Uttar Pradesh',
      pincode: '281121',
      coordinates: [77.6881, 27.5732],
      images: [
        'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=800&q=80'
      ],
      description: 'Fogla Ashram is a popular, high-capacity lodge in Raman Reti, offering clean, economical dormitories and family rooms. It has a peaceful courtyard.\n\n■ TRAVEL & CONTACT DETAILS:\n• Landmark: Near ISKCON Temple\n• Temple: Krishna Balaram Mandir\n• Railway Station: Vrindavan Railway Station (2.2 km)\n• Bus Stand: Vrindavan Bus Stand (2.8 km)\n• Contact: +91 565 2540112\n• Website: N/A',
      history: 'Founded by a charitable merchant trust from Rajasthan to provide affordable, standard accommodation for North Indian pilgrims.',
      rules: ['Dormitory check-out is 10:00 AM.', 'No smoking or tobacco allowed on the premises.', 'Outside visitors not allowed in rooms after 8 PM.'],
      amenities: ['Dormitory', 'Pure Vegetarian Food', 'Hot Water', 'Gardens', 'Ample Parking', 'Lift'],
      nearbyAttractions: ['ISKCON Temple', 'Prem Mandir', 'Lata Mangeshkar Memorial']
    },
    {
      name: 'Bhagwat Dham Ashram',
      city: 'Vrindavan',
      district: 'Mathura',
      state: 'Uttar Pradesh',
      pincode: '281121',
      coordinates: [77.6765, 27.5792],
      images: [
        'https://images.unsplash.com/photo-1606293926075-69a007f4e863?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1545389336-cf090694435e?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'
      ],
      description: 'A peaceful retreat focused on Bhagwat discourses, offering a quiet environment, simple lodging, and traditional temple worship.\n\n■ TRAVEL & CONTACT DETAILS:\n• Landmark: Sunrakh Road\n• Temple: Priya Kant Ju Temple\n• Railway Station: Vrindavan Railway Station (3.8 km)\n• Bus Stand: Vrindavan Bus Stand (4.2 km)\n• Contact: Public inquiry desk at gate\n• Website: N/A',
      history: 'An ashram centered around the dissemination of the Srimad Bhagavatam teachings and Vraja culture.',
      rules: ['Attend evening satsang sessions.', 'Observe cleanliness in common areas.', 'Simple modest dress code.'],
      amenities: ['Meditation Hall', 'Pure Vegetarian Food', 'Gardens', 'Temple', 'Hot Water'],
      nearbyAttractions: ['Priya Kant Ju Temple', 'Prem Mandir', 'Chandrodaya Mandir']
    }
  ];

  console.log(`Seeding exactly ${ashramConfigs.length} approved Ashrams...`);
  const seededAshrams = [];
  const seededRooms = [];

  const roomImages = getRoomImages();

  const coverImages = [
    'https://images.unsplash.com/photo-1598977123418-45f04b61582e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1606293926075-69a007f4e863?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=1200&q=80',
    'https://upload.wikimedia.org/wikipedia/commons/7/7e/Statue_of_lord_Shiva_at_the_Parmarth_Niketan%2C_in_Rishikesh%2C_Uttarakhand%2C_India.jpg',
    'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1612438214708-f428a707dd4e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1608958416801-9c60e3a6a908?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1200&q=80'
  ];

  const allGalleryImages = [
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1536304997881-a372c179924b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1598977123418-45f04b61582e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1609137144813-7d84b06385a7?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1592861956120-e524fc739696?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1506461883276-594a12b11db3?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1598370988775-680c6db08c69?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1606293926075-69a007f4e863?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1612438214708-f428a707dd4e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80'
  ];

  // Collision-free booking ID counter
  let bookingIdCounter = 10000;

  for (let idx = 0; idx < ashramConfigs.length; idx++) {
    const config = ashramConfigs[idx];
    
    // Create Ashram
    const ashram = await upsertAshram({
      ownerId: owner._id,
      name: config.name,
      description: config.description,
      history: config.history,
      rules: config.rules,
      address: {
        street: config.name + ' Campus Road',
        city: config.city,
        district: config.district,
        state: config.state,
        pincode: config.pincode,
        coordinates: {
          type: 'Point',
          coordinates: config.coordinates
        }
      },
      amenities: config.amenities,
      documents: {
        trustDeedUrl: 'https://res.cloudinary.com/ashray-bharat/raw/upload/deeds/trust_deed_mock.pdf',
        fireSafetyCertificateUrl: 'https://res.cloudinary.com/ashray-bharat/raw/upload/certificates/fire_safety_mock.pdf',
        landOwnershipUrl: 'https://res.cloudinary.com/ashray-bharat/raw/upload/deeds/land_ownership_mock.pdf'
      },
      images: config.images || [
        coverImages[idx % coverImages.length],
        ...allGalleryImages.slice((idx * 3) % 14, ((idx * 3) % 14) + 6)
      ],
      rating: {
        average: parseFloat((4.1 + Math.random() * 0.8).toFixed(1)),
        count: 15 + Math.floor(Math.random() * 11)
      },
      status: 'approved',
      inspectionDetails: {
        officerId: officer._id,
        scheduledDate: new Date(),
        comments: 'Inspection passed successfully. Facilities match safety regulations.',
        reportUrl: 'https://res.cloudinary.com/ashray-bharat/raw/upload/reports/inspection_report_mock.pdf'
      }
    });

    seededAshrams.push(ashram);

    // Create Audit Log for verification approval
    await AuditLog.create({
      userId: officer._id,
      action: 'ASHRAM_VERIFY',
      module: 'GOVT_APPROVAL',
      details: { ashramId: ashram._id, name: ashram.name, status: 'approved' },
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0'
    });

    // Create Rooms for this Ashram with unique pricing tiers per ashram
    const roomCategories = getAshramRooms(idx, roomImages);

    for (let rConfig of roomCategories) {
      const room = await upsertRoom({
        ashramId: ashram._id,
        name: rConfig.name,
        type: rConfig.type,
        acType: rConfig.ac,
        capacity: rConfig.cap,
        totalInventory: rConfig.inventory,
        basePrice: rConfig.price,
        amenities: ['Attached Bath', 'Hot Water', 'WiFi', 'Closet'],
        images: [rConfig.img],
        pricingRules: [
          { name: 'Diwali Festive', startDate: new Date('2026-11-01'), endDate: new Date('2026-11-10'), multiplier: 1.5 },
          { name: 'Kumbh Mela Peak', startDate: new Date('2026-03-01'), endDate: new Date('2026-04-30'), multiplier: 2.0 }
        ],
        status: 'active'
      });
      seededRooms.push(room);
    }
  }

  // Gather IDs for clearing existing demo transactions
  const userIds = [
    pilgrim._id,
    owner._id,
    officer._id,
    admin._id,
    govtAdmin._id,
    manager._id,
    receptionist._id,
    housekeeping._id,
    support._id,
    ...simulatedPilgrims.map(p => p._id)
  ];
  const roomIds = seededRooms.map(r => r._id);
  const seededAshramIds = seededAshrams.map(a => a._id);

  // Clear existing transactions cleanly to avoid duplicate keys / conflicts
  await clearDemoRecords(userIds, roomIds, seededAshramIds);

  // Re-seed availability calendar, historical bookings, payments, and reviews
  console.log('Generating dynamic availability calendar, bookings, and reviews...');
  
  const today = new Date();
  const availabilityDocs = [];
  
  for (let room of seededRooms) {
    const inventory = room.totalInventory;

    // Generate Room Availability for the next 90 days
    for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
      const currentDate = new Date(today);
      currentDate.setDate(today.getDate() + dayOffset);
      currentDate.setHours(0, 0, 0, 0);

      // Occupancy simulation: some dates have more bookings
      let booked = 0;
      const randomFactor = Math.random();
      if (randomFactor > 0.85) {
        booked = inventory; // Sold out
      } else if (randomFactor > 0.70) {
        booked = Math.floor(inventory * 0.85); // Almost full
      } else if (randomFactor > 0.40) {
        booked = Math.floor(inventory * 0.50); // Limited
      } else {
        booked = Math.floor(inventory * 0.15); // Available
      }

      availabilityDocs.push({
        roomId: room._id,
        date: currentDate,
        bookedCount: booked,
        maintenanceCount: 0
      });
    }
  }

  // Insert all availability docs in bulk (extremely fast!)
  await RoomAvailability.insertMany(availabilityDocs);
  console.log(`Successfully generated ${availabilityDocs.length} room availability calendar entries.`);

  // Generate historical bookings and reviews
  for (let ashram of seededAshrams) {
    const ashramRooms = seededRooms.filter(r => r.ashramId.toString() === ashram._id.toString());
    const ratingCount = ashram.rating.count;

    for (let bkIdx = 0; bkIdx < Math.min(ratingCount, simulatedPilgrims.length); bkIdx++) {
      const userForBooking = simulatedPilgrims[bkIdx];
      const room = ashramRooms[bkIdx % ashramRooms.length];
      const daysPast = 5 + bkIdx * 3;
      
      const checkInPast = new Date(today);
      checkInPast.setDate(today.getDate() - daysPast);
      checkInPast.setHours(12, 0, 0, 0);
      
      const checkOutPast = new Date(checkInPast);
      checkOutPast.setDate(checkInPast.getDate() + 2);
      checkOutPast.setHours(11, 0, 0, 0);

      const checkInCodePast = Math.floor(100000 + Math.random() * 900000).toString();
      const year = checkInPast.getFullYear();
      bookingIdCounter++;
      const bookingId = `AB-${year}-${bookingIdCounter}`;

      // pricing calc
      const base = room.basePrice * 2;
      const total = base + 150 * 2 * 1 + 500; // room + meals + donation

      const bookingStatus = bkIdx % 8 === 0 ? 'cancelled' :
                           bkIdx % 8 === 1 ? 'checked_in' :
                           bkIdx % 8 === 2 ? 'confirmed' : 'checked_out';

      const booking = await Booking.create({
        bookingId,
        customerId: userForBooking._id,
        ashramId: ashram._id,
        roomId: room._id,
        checkInDate: checkInPast,
        checkOutDate: checkOutPast,
        guestsCount: 1,
        roomsBookedCount: 1,
        status: bookingStatus,
        services: {
          meals: { ordered: true, price: 300 },
          parking: { ordered: false, price: 0 },
          locker: { ordered: false, price: 0 },
          donation: { amount: 500 }
        },
        pricing: {
          basePrice: base,
          servicesPrice: 300,
          donationAmount: 500,
          totalAmount: total,
          amountPaid: bookingStatus === 'cancelled' ? 0 : total
        },
        paymentStatus: bookingStatus === 'cancelled' ? 'pending' : 'fully_paid',
        checkInCode: checkInCodePast
      });

      // Seed Payment if paid
      if (booking.paymentStatus === 'fully_paid') {
        await Payment.create({
          bookingId: booking._id,
          userId: userForBooking._id,
          amount: total,
          method: 'upi',
          transactionId: `TXN-SEED-${booking._id}`,
          status: 'success'
        });
      }

      // Seed review if checked out / completed
      if (bookingStatus === 'checked_out') {
        const reviewRating = parseFloat((4.1 + Math.random() * 0.9).toFixed(1));
        
        const reviewComments = [
          'Extremely peaceful stay. The environment is pure spiritual bliss and clean.',
          'Delicious satvik vegetarian prasad and beautiful temple compound.',
          'Clean beds, very quiet and right next to the holy river. Perfect place.',
          'Helpful reception team. Excellent meditation hall facilities.',
          'Loved the morning Havan and spiritual satsangs. Very economical.',
          'Highly safe for solo women pilgrims. Clean toilets and beautiful gardens.'
        ];

        await Review.create({
          customerId: userForBooking._id,
          ashramId: ashram._id,
          bookingId: booking._id,
          rating: {
            overall: Math.round(reviewRating),
            cleanliness: 5,
            service: 4,
            location: 5,
            valueForMoney: 5
          },
          comment: reviewComments[bkIdx % reviewComments.length],
          status: 'approved'
        });
      }
    }
  }

  // Seed Support Tickets
  console.log('Seeding demo support tickets...');
  const supportTickets = [
    {
      userId: pilgrim._id,
      title: 'Refund Request for Cancelled Booking',
      description: 'I cancelled my booking AB-2026-10025 but the refund has not yet been credited to my bank account.',
      category: 'refund_request',
      status: 'open',
      priority: 'high',
      assignedTo: support._id,
      messages: [
        {
          senderId: pilgrim._id,
          text: 'Hello, I cancelled my booking but I have not received the refund yet. Can you please help?',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      ]
    },
    {
      userId: pilgrim._id,
      title: 'AC Not Working in Deluxe Room',
      description: 'The AC in Room 204 Ganga View Deluxe AC Room was making loud noise and not cooling properly.',
      category: 'ashram_complaint',
      status: 'resolved',
      priority: 'medium',
      assignedTo: support._id,
      messages: [
        {
          senderId: pilgrim._id,
          text: 'The AC in room 204 is not cooling properly and making a lot of noise.',
          timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000)
        },
        {
          senderId: support._id,
          text: 'Namaste. We have sent our technician and resolved the issue. We apologize for the inconvenience.',
          timestamp: new Date(Date.now() - 47 * 60 * 60 * 1000)
        }
      ]
    }
  ];

  await SupportTicket.insertMany(supportTickets);
  console.log(`Seeded ${supportTickets.length} support tickets.`);

  // Seeding Statistics Report Summary
  const usersCount = await User.countDocuments();
  const ashramsCount = await Ashram.countDocuments();
  const roomsCount = await Room.countDocuments();
  const bookingsCount = await Booking.countDocuments();
  const reviewsCount = await Review.countDocuments();
  const availabilityCount = await RoomAvailability.countDocuments();
  const paymentsCount = await Payment.countDocuments();
  const ticketsCount = await SupportTicket.countDocuments();

  console.log('\n======================================');
  console.log('      DATABASE SEEDING SUMMARY');
  console.log('======================================');
  console.log(`* Total Users:          ${usersCount}`);
  console.log(`* Total Ashrams:        ${ashramsCount}`);
  console.log(`* Total Rooms:          ${roomsCount}`);
  console.log(`* Room Availabilities:  ${availabilityCount}`);
  console.log(`* Total Bookings:       ${bookingsCount}`);
  console.log(`* Total Reviews:        ${reviewsCount}`);
  console.log(`* Total Payments:       ${paymentsCount}`);
  console.log(`* Support Tickets:      ${ticketsCount}`);
  console.log('======================================\n');
};

const runSeeder = async () => {
  try {
    await mongoose.connect(connStr);
    console.log('Connected to MongoDB at', connStr);
    
    const users = await seedUsers();
    await seedData(users);
    
    console.log('Database Seeding finished successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding process failed:', error);
    process.exit(1);
  }
};

runSeeder();
