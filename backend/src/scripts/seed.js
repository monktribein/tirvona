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

const clearDemoRecords = async (userIds, roomIds) => {
  console.log('Cleaning existing demo transaction records...');
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
    // Update properties and trigger save (which hashes password if it is plaintext)
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
    email: 'pilgrim@ashraybharat.gov.in',
    phone: '6666666666',
    passwordHash: 'password123',
    role: 'customer',
    status: 'active'
  });

  // Create Owner
  const owner = await upsertUser({
    name: 'Swami Chinmayananda (Ashram Trust)',
    email: 'owner@ashraybharat.gov.in',
    phone: '7777777777',
    passwordHash: 'password123',
    role: 'owner',
    status: 'active'
  });

  // Create District Officer
  const officer = await upsertUser({
    name: 'Shri A. K. Dwivedi (District Magistrate)',
    email: 'officer@ashraybharat.gov.in',
    phone: '8888888888',
    passwordHash: 'password123',
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
    email: 'admin@ashraybharat.gov.in',
    phone: '9999999999',
    passwordHash: 'password123',
    role: 'super_admin',
    status: 'active'
  });

  // Create Govt Admin
  const govtAdmin = await upsertUser({
    name: 'Shri R. K. Singh (Director General Tourism)',
    email: 'govt.admin@ashraybharat.gov.in',
    phone: '9123456780',
    passwordHash: 'password123',
    role: 'govt_admin',
    state: 'Uttarakhand',
    status: 'active'
  });

  // Create Manager
  const manager = await upsertUser({
    name: 'Mohan Lal (Ashram Manager)',
    email: 'manager@ashraybharat.gov.in',
    phone: '9123456781',
    passwordHash: 'password123',
    role: 'manager',
    status: 'active'
  });

  // Create Receptionist
  const receptionist = await upsertUser({
    name: 'Karan Singh (Front Desk)',
    email: 'reception@ashraybharat.gov.in',
    phone: '9123456782',
    passwordHash: 'password123',
    role: 'reception',
    status: 'active'
  });

  // Create Housekeeping
  const housekeeping = await upsertUser({
    name: 'Ramu Prasad (Housekeeping Head)',
    email: 'housekeeping@ashraybharat.gov.in',
    phone: '9123456783',
    passwordHash: 'password123',
    role: 'housekeeping',
    status: 'active'
  });

  // Create Support Executive
  const support = await upsertUser({
    name: 'Amit Kumar (Support Lead)',
    email: 'support@ashraybharat.gov.in',
    phone: '9123456784',
    passwordHash: 'password123',
    role: 'support',
    status: 'active'
  });

  // Additional Customer Accounts for simulated review generation
  const simulatedPilgrims = [];
  const pilgrimNames = [
    'Aarav Patel', 'Ishaan Iyer', 'Vihaan Gupta', 'Siddharth Roy',
    'Meera Krishnan', 'Ananya Deshmukh', 'Aditya Verma', 'Rohan Mehta',
    'Sneha Joshi', 'Rahul Nair', 'Kavita Rao', 'Pooja Bhatia',
    'Vikram Singh', 'Pranav Mishra', 'Tanvi Desai', 'Deepak choudhary'
  ];

  for (let i = 0; i < pilgrimNames.length; i++) {
    const p = await upsertUser({
      name: pilgrimNames[i],
      email: `pilgrim.${i + 1}@ashraybharat.gov.in`,
      phone: `91000000${10 + i}`,
      passwordHash: 'password123',
      role: 'customer',
      status: 'active'
    });
    simulatedPilgrims.push(p);
  }

  console.log('Core and auxiliary users seeded successfully.');
  return { pilgrim, owner, officer, admin, govtAdmin, manager, receptionist, housekeeping, support, simulatedPilgrims };
};

const getUnsplashImages = () => {
  return [
    'https://images.unsplash.com/photo-1506461883276-594a12b11db3?auto=format&fit=crop&w=800&q=80', // Haridwar Ghats
    'https://images.unsplash.com/photo-1598370988775-680c6db08c69?auto=format&fit=crop&w=800&q=80', // Ganga River Bank & buildings
    'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80', // Vrindavan Temple Gate
    'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=800&q=80', // Ashram Mandir roof
    'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=800&q=80', // Traditional courtyard
    'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=800&q=80', // Ancient temple gateway
    'https://images.unsplash.com/photo-1606293926075-69a007f4e863?auto=format&fit=crop&w=800&q=80', // Simple brick temple
    'https://images.unsplash.com/photo-1612438214708-f428a707dd4e?auto=format&fit=crop&w=800&q=80', // Rishikesh bridge
    'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=800&q=80', // Quiet prayer hall
    'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80'  // Simple garden lawn
  ];
};

const getGalleryImages = () => {
  return [
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80', // Simple clean single room
    'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80', // Simple shared dormitory
    'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=800&q=80', // Simple clean double bed room
    'https://images.unsplash.com/photo-1536304997881-a372c179924b?auto=format&fit=crop&w=800&q=80', // Simple community dining / prasad bhandara
    'https://images.unsplash.com/photo-1598977123418-45f04b61582e?auto=format&fit=crop&w=800&q=80', // Goshala cow shelter
    'https://images.unsplash.com/photo-1609137144813-7d84b06385a7?auto=format&fit=crop&w=800&q=80', // Prayers & oil lamps
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80', // Simple yoga mats on the floor
    'https://images.unsplash.com/photo-1592861956120-e524fc739696?auto=format&fit=crop&w=800&q=80', // Satvik food thali
    'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80'  // Simple garden flower pathway
  ];
};

const getRoomImages = () => {
  return {
    dormitory: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80',
    private_room: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
    double_room: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=800&q=80',
    family_room: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80',
    deluxe_room: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80',
    vip_suite: 'https://images.unsplash.com/photo-1582719478250-c89cae4db85b?auto=format&fit=crop&w=800&q=80'
  };
};

const seedData = async (users) => {
  const { pilgrim, owner, officer, admin, govtAdmin, manager, receptionist, housekeeping, support, simulatedPilgrims } = users;
  
  const ashramConfigs = [
    // === HARIDWAR (10 Ashrams) ===
    {
      name: 'Shanti Kunj Ashram',
      city: 'Haridwar',
      district: 'Haridwar',
      state: 'Uttarakhand',
      pincode: '249411',
      coordinates: [78.1962, 29.9881],
      description: 'Shantikunj is a world-renowned spiritual center and the headquarters of All World Gayatri Pariwar. Nestled on the banks of holy river Ganges, it provides a sanctuary for moral and spiritual regeneration.',
      history: 'Established in 1971 by Pandit Shriram Sharma Acharya, Shantikunj has grown from a small spiritual academy to a global movement propagating scientific spirituality and Gayatri Sadhana.',
      rules: ['Gayatri Mantra chanting at 4:30 AM is recommended.', 'Only satvik organic vegetarian meals served.', 'No entry permitted after 9:30 PM.', 'Simple clothing covering shoulders and knees is mandatory.'],
      amenities: ['Meditation Hall', 'Pure Vegetarian Food', 'Cow Shelter', 'Gardens', 'Free Medical Dispensary', 'Library', 'Yoga Center'],
      nearbyAttractions: ['Har Ki Pauri', 'Chandi Devi Temple', 'Mansa Devi Temple', 'Sapt Rishi Ashram'],
      email: 'contact@shantikunj.org',
      website: 'www.awgp.org'
    },
    {
      name: 'Parmarth Ashram Haridwar',
      city: 'Haridwar',
      district: 'Haridwar',
      state: 'Uttarakhand',
      pincode: '249401',
      coordinates: [78.1638, 29.9575],
      description: 'A serene sanctuary located in Haridwar, offering pilgrims comfortable, clean and spiritual lodging. It runs regular spiritual discourses, yoga classes and prasad distribution.',
      history: 'Founded in the mid-20th century under the guidance of respected gurus to provide resting spaces for Ganga pilgrims and to teach standard Vedas and Sanskrit texts to children.',
      rules: ['Prasad/meals served during designated times only.', 'Alcohol, smoking, and loud noises are strictly prohibited.', 'Attend evening prayers at 6:00 PM.'],
      amenities: ['Meditation Hall', 'Pure Vegetarian Food', 'Hot Water', 'WiFi', 'River View', 'Wheelchair Access'],
      nearbyAttractions: ['Har Ki Pauri', 'Bharat Mata Mandir', 'Bara Bazar'],
      email: 'haridwar@parmarth.org',
      website: 'www.parmarthharidwar.org'
    },
    {
      name: 'Sapt Rishi Ashram',
      city: 'Haridwar',
      district: 'Haridwar',
      state: 'Uttarakhand',
      pincode: '249411',
      coordinates: [78.1985, 29.9928],
      description: 'Sapt Rishi Ashram is an ancient, holy retreat where the Ganga river divides into seven distinct streams (Sapt Dhara). It is a highly peaceful location ideal for intense meditation.',
      history: 'According to Hindu mythology, seven great sages (Saptarishis) meditated here. Ganga, not wanting to disturb their deep meditation, split herself into seven channels around them.',
      rules: ['Quietness must be maintained at all times.', 'Guests must keep their rooms clean.', 'Dhoti/Sari or simple kurta-pyjama is preferred.'],
      amenities: ['Meditation Hall', 'Pure Vegetarian Food', 'Gardens', 'River View', 'Cow Shelter'],
      nearbyAttractions: ['Sapt Sarovar', 'Bhimgoda Barrage', 'Har Ki Pauri'],
      email: 'info@saptrishiashram.in',
      website: ''
    },
    {
      name: 'Prem Nagar Ashram',
      city: 'Haridwar',
      district: 'Haridwar',
      state: 'Uttarakhand',
      pincode: '249408',
      coordinates: [78.1252, 29.9248],
      description: 'Prem Nagar Ashram is a massive spiritual complex designed as a haven of peace. It features beautiful garden landscapes, large meditation halls, and daily discourses.',
      history: 'Established in 1943 by Yogiraj Satgurudev Shri Hans Ji Maharaj, it was built by volunteers seeking a common platform for universal brotherhood and spiritual transmission.',
      rules: ['Observe absolute silence in the meditation halls.', 'Outside food is not allowed inside the rooms.', 'Do not waste water or electricity.'],
      amenities: ['Meditation Hall', 'Pure Vegetarian Food', 'Gardens', 'WiFi', 'Lift', 'AC', 'Wheelchair Access', 'Ample Parking'],
      nearbyAttractions: ['Daksh Mahadev Temple', 'Kankhal', 'Hari ki Pauri'],
      email: 'stay@premnagarashram.com',
      website: 'www.premnagarashram.com'
    },
    {
      name: 'Pawan Dham Ashram',
      city: 'Haridwar',
      district: 'Haridwar',
      state: 'Uttarakhand',
      pincode: '249411',
      coordinates: [78.1882, 29.9803],
      description: 'Famous for its exquisite temple interior covered in intricate glass and mirror work, Pawan Dham provides a spiritual visual experience alongside low-cost pilgrim accommodations.',
      history: 'Built under the auspices of Swami Vedvyasanand Ji Maharaj, the ashram is renowned for its architectural heritage where deities are decorated with colorful glass panels.',
      rules: ['Do not touch or photograph the delicate glass panels.', 'Maintain the sanctity of the temple shrine.', 'Check-out strictly by 11:00 AM.'],
      amenities: ['Pure Vegetarian Food', 'Hot Water', 'Temple', 'Gardens', 'Free Parking'],
      nearbyAttractions: ['Glass Temple', 'Bharat Mata Mandir', 'Ganga Riverfront'],
      email: 'booking@pawandham.org',
      website: ''
    },
    {
      name: 'Bharat Sevashram Sangha',
      city: 'Haridwar',
      district: 'Haridwar',
      state: 'Uttarakhand',
      pincode: '249401',
      coordinates: [78.1565, 29.9512],
      description: 'A charitable, non-profit ashram offering safe, hygienic and highly economical lodging. The sangha is active in community service, disaster relief and free health clinics.',
      history: 'Bharat Sevashram Sangha was founded in 1917 by Acharya Shrimat Swami Pranavanandaji Maharaj, dedicated to serving the poor and protecting spiritual pilgrims.',
      rules: ['Strict discipline is maintained.', 'Mandatory attendance for evening Aarti.', 'No room service; self-service is encouraged.'],
      amenities: ['Dormitory', 'Pure Vegetarian Food', 'Temple', 'Community Kitchen', 'Basic First Aid'],
      nearbyAttractions: ['Haridwar Railway Station', 'Har Ki Pauri', 'Chandi Devi Ropeway'],
      email: 'haridwar@bharatsevashram.org',
      website: 'www.bharatsevashramsangha.org'
    },
    {
      name: 'Jai Ram Ashram',
      city: 'Haridwar',
      district: 'Haridwar',
      state: 'Uttarakhand',
      pincode: '249401',
      coordinates: [78.1691, 29.9621],
      description: 'Jai Ram Ashram is famous for its large dioramas of Hindu gods and goddesses, beautifully manicured lawns, and comfortable lodging blocks.',
      history: 'Founded by Adi Guru Shri Jai Ram Maharaj, this ashram has served pilgrims for over a century, providing food, clean lodging, and charity eye operations.',
      rules: ['Keep the campus premises clean.', 'Loud music is not permitted.', 'Prior registration is required for spiritual workshops.'],
      amenities: ['Meditation Hall', 'Pure Vegetarian Food', 'Gardens', 'Hot Water', 'WiFi', 'Lift', 'Diioramas exhibition'],
      nearbyAttractions: ['Har Ki Pauri', 'Bhima Goda Tank', 'Saptrishi'],
      email: 'stay@jairamashram.org',
      website: 'www.jairamashram.org'
    },
    {
      name: 'Bhole Giri Ashram',
      city: 'Haridwar',
      district: 'Haridwar',
      state: 'Uttarakhand',
      pincode: '249401',
      coordinates: [78.1612, 29.9542],
      description: 'Located directly adjacent to the holy ghats, Bhole Giri Ashram provides simple rooms, peaceful atmosphere, and a ringside seat to the daily rituals of Haridwar.',
      history: 'An ancient Akhada-affiliated ashram hosting Naga sadhus and pilgrims during major Melas like Kumbh Mela and Ardh Kumbh.',
      rules: ['Respect the local sadhus and spiritual seekers.', 'Traditional Indian attire is requested.', 'Main doors close at 9:00 PM.'],
      amenities: ['Pure Vegetarian Food', 'Temple', 'River View', 'Hot Water', 'Basic Bedding'],
      nearbyAttractions: ['Birla Ghat', 'Har Ki Pauri', 'Subhash Ghat'],
      email: 'bholegiri@gmail.com',
      website: ''
    },
    {
      name: 'Kankhal Mahanirvan Ashram',
      city: 'Haridwar',
      district: 'Haridwar',
      state: 'Uttarakhand',
      pincode: '249408',
      coordinates: [78.1292, 29.9288],
      description: 'Situated in the historic town of Kankhal, this ashram belongs to the Mahanirvani Akhada. It provides a peaceful setting away from the main city rush.',
      history: 'Kankhal is rich in history as the site of Daksha Yajna. The ashram houses an ancient banyan tree and is a key seat for ascetic monks.',
      rules: ['Consumption of non-veg and intoxicants is a punishable offense.', 'Silence is appreciated.', 'Keep mobile phones on silent inside temple area.'],
      amenities: ['Meditation Hall', 'Temple', 'Gardens', 'Pure Vegetarian Food', 'Hot Water'],
      nearbyAttractions: ['Daksha Mahadev Temple', 'Sati Kund', 'Harihar Ashram'],
      email: 'kankhal@mahanirvan.org',
      website: ''
    },
    {
      name: 'Vyas Ashram Haridwar',
      city: 'Haridwar',
      district: 'Haridwar',
      state: 'Uttarakhand',
      pincode: '249411',
      coordinates: [78.1971, 29.9901],
      description: 'Vyas Ashram is a calm, tree-shaded sanctuary in northern Haridwar. It is focused on Vedantic studies, meditation retreats, and Ayurvedic lifestyle.',
      history: 'Dedicated to Sage Vyas, the compiler of the Vedas, this ashram was established to continue the tradition of textual studies and Sanskrit teaching.',
      rules: ['Attend morning satsangs.', 'Only vegetarian organic ingredients used.', 'No room check-in after sunset.'],
      amenities: ['Meditation Hall', 'Library', 'Pure Vegetarian Food', 'Gardens', 'Ayurveda center'],
      nearbyAttractions: ['Sapt Rishi Ashram', 'Ganga Canal', 'Bharat Mata Mandir'],
      email: 'vyasashram@gmail.com',
      website: ''
    },

    // === RISHIKESH (10 Ashrams) ===
    {
      name: 'Parmarth Niketan Ashram',
      city: 'Rishikesh',
      district: 'Dehradun',
      state: 'Uttarakhand',
      pincode: '249201',
      coordinates: [78.3125, 30.1191],
      description: 'Parmarth Niketan is the largest ashram in Rishikesh. Located on the banks of holy river Ganges, it provides a clean, pure and sacred atmosphere with 1000+ rooms.',
      history: 'Founded in 1942 by Pujya Swami Shukdevanandji Maharaj, it is famous globally for its Ganga Aarti at sunset, Yoga Festival, and humanitarian projects.',
      rules: ['Strict vegetarian diet only.', 'Attend the sunset Ganga Aarti.', 'No smoking, alcohol, or illicit substances.', 'Observe silence during early morning hours.'],
      amenities: ['Meditation Hall', 'River View', 'Pure Vegetarian Food', 'Yoga Center', 'Gardens', 'WiFi', 'Library', 'Wheelchair Access'],
      nearbyAttractions: ['Ram Jhula', 'Laxman Jhula', 'Beatles Ashram', 'Triveni Ghat'],
      email: 'stay@parmarth.com',
      website: 'www.parmarth.org'
    },
    {
      name: 'Sivananda Ashram',
      city: 'Rishikesh',
      district: 'Tehri Garhwal',
      state: 'Uttarakhand',
      pincode: '249137',
      coordinates: [78.3092, 30.1245],
      description: 'The Divine Life Society (Sivananda Ashram) is a highly respected spiritual institution dedicated to the dissemination of spiritual knowledge and yoga.',
      history: 'Founded in 1936 by the great saint Swami Sivananda Saraswati, this ashram has produced many legendary yoga gurus and continues to distribute free books and medicines.',
      rules: ['Prior written request is required for stays.', 'Daily attendance at morning & evening meditation is expected.', 'Modest white or light clothing preferred.'],
      amenities: ['Meditation Hall', 'Library', 'Pure Vegetarian Food', 'Yoga Center', 'Free Hospital', 'Bookstore'],
      nearbyAttractions: ['Ram Jhula', 'Ganga Ghats', 'Sivananda Jhula'],
      email: 'bookings@divinelife.org',
      website: 'www.divinelife.org'
    },
    {
      name: 'Beatles Ashram (Chaurasi Kutia)',
      city: 'Rishikesh',
      district: 'Dehradun',
      state: 'Uttarakhand',
      pincode: '249201',
      coordinates: [78.3155, 30.1158],
      description: 'Formerly the academy of Maharishi Mahesh Yogi, this historic ashram inside the Rajaji National Park is now a heritage site famous for its stone dome kutias and graffiti art.',
      history: 'In 1968, the legendary English rock band The Beatles stayed here to learn Transcendental Meditation, writing over 40 songs in their most creative phase.',
      rules: ['Do not litter in the eco-zone.', 'Strictly day visits or booked cottages only.', 'Do not touch the historical graffiti paintings.'],
      amenities: ['Gardens', 'Forest View', 'Historical Domes', 'Meditation Spaces', 'Cafe'],
      nearbyAttractions: ['Rajaji National Park', 'Ram Jhula', 'Ghats'],
      email: 'info@beetlesashram.gov.in',
      website: 'www.uttarakhandtourism.gov.in'
    },
    {
      name: 'Geeta Bhawan Retreat',
      city: 'Rishikesh',
      district: 'Dehradun',
      state: 'Uttarakhand',
      pincode: '249201',
      coordinates: [78.3142, 30.1182],
      description: 'Geeta Bhawan is a massive complex located on the banks of Ganga, offering free or highly subsidized accommodation for thousands of pilgrims simultaneously.',
      history: 'Managed by the Gita Press of Gorakhpur, it contains paintings representing events from Ramayana and Mahabharata, and provides free ferry transport across Ganga.',
      rules: ['Strict adherence to religious guidelines.', 'Do not use plastic bags inside the ashram.', 'Keep guest registers updated.'],
      amenities: ['Pure Vegetarian Food', 'River View', 'Temple', 'Dispensary', 'Laxmi Narayan Temple', 'Sanskrit Bookstore'],
      nearbyAttractions: ['Ram Jhula', 'Gita Press Depot', 'Parmarth Aarti Ghat'],
      email: 'geetabhawan@gitapress.org',
      website: 'www.gitapress.org'
    },
    {
      name: 'Swami Dayananda Ashram',
      city: 'Rishikesh',
      district: 'Dehradun',
      state: 'Uttarakhand',
      pincode: '249201',
      coordinates: [78.3031, 30.1102],
      description: 'An oasis of tranquility located right on the Ganga canal. It is a premier center for the study of Vedanta, Sanskrit, Upanishads, and Gita.',
      history: 'Established in the 1960s by Swami Dayananda Saraswati, a renowned teacher of Vedanta, it features a beautiful temple dedicated to Lord Gangadhareswarar.',
      rules: ['Guests must attend the daily Vedic lectures.', 'Main gates lock at 9:30 PM.', 'Silence must be maintained in the temple courtyard.'],
      amenities: ['Meditation Hall', 'Library', 'Pure Vegetarian Food', 'River View', 'Hot Water', 'WiFi', 'Temple'],
      nearbyAttractions: ['Chandreshwar Mahadev Temple', 'Triveni Ghat', 'Ram Jhula'],
      email: 'dayananda@vedantastudies.org',
      website: 'www.dayanandashram.org'
    },
    {
      name: 'Phool Chatti Ashram',
      city: 'Rishikesh',
      district: 'Pauri Garhwal',
      state: 'Uttarakhand',
      pincode: '249304',
      coordinates: [78.3582, 30.1385],
      description: 'Situated further upstream in a forested mountain valley, Phool Chatti (Land of Flowers) is famous for its structured 7-day residential yoga and meditation programs.',
      history: 'Founded in the late 1800s by Sri Devi Dayal Ji Maharaj, it has welcomed international and Indian spiritual seekers in a nature-rich, rustic setting.',
      rules: ['Must join the full 7-day program course.', 'No access to mobile phones during classes.', 'Early morning river baths are voluntary but encouraged.'],
      amenities: ['Meditation Hall', 'Pure Vegetarian Food', 'Gardens', 'Forest View', 'Yoga Center', 'Natural River Bathing Area'],
      nearbyAttractions: ['Garud Chatti Waterfall', 'Neelkanth Mahadev Temple'],
      email: 'info@phoolchattiashram.com',
      website: 'www.phoolchattiashram.com'
    },
    {
      name: 'Anand Prakash Yoga Ashram',
      city: 'Rishikesh',
      district: 'Dehradun',
      state: 'Uttarakhand',
      pincode: '249201',
      coordinates: [78.3181, 30.1292],
      description: 'Located in the popular Tapovan area, Anand Prakash offers a modern spiritual vibe and is home to the Akhanda Yoga tradition, combining yoga, chanting, and philosophy.',
      history: 'Founded in 2007 by Yogi Vishvketu and Yogrishi, it serves as a global hub for yoga teacher training and yogic lifestyle.',
      rules: ['Attend morning fire ceremony (Havan).', 'Maintain room hygiene.', 'Vegetarian satvik organic prasad served daily.'],
      amenities: ['Meditation Hall', 'Yoga Center', 'WiFi', 'Pure Vegetarian Food', 'Hot Water', 'Gardens'],
      nearbyAttractions: ['Tapovan Bridge', 'Secret Waterfall', 'Laxman Jhula'],
      email: 'stay@akhandayoga.com',
      website: 'www.akhandayoga.com'
    },
    {
      name: 'Osho Ganga Dham Ashram',
      city: 'Rishikesh',
      district: 'Dehradun',
      state: 'Uttarakhand',
      pincode: '249201',
      coordinates: [78.3412, 30.1298],
      description: 'Located on Badrinath Road, Osho Ganga Dham is positioned directly on the river Ganga, surrounded by hills. It offers Osho active meditation programs.',
      history: 'Set up by Osho disciples to practice Osho Kundalini, dynamic and silent meditation on the white sands of Ganga.',
      rules: ['Participation in Osho meditations is required.', 'Maroon robes during day, white robes during evening satsang.', 'Respect everyone\'s personal space.'],
      amenities: ['Meditation Hall', 'Pure Vegetarian Food', 'River View', 'Private Beach', 'WiFi', 'AC'],
      nearbyAttractions: ['Phool Chatti', 'Badrinath Road Treks', 'Laxman Jhula'],
      email: 'info@oshogangadham.com',
      website: 'www.oshogangadham.com'
    },
    {
      name: 'Sadhana Mandir Trust',
      city: 'Rishikesh',
      district: 'Dehradun',
      state: 'Uttarakhand',
      pincode: '249201',
      coordinates: [78.2981, 30.1082],
      description: 'Sadhana Mandir is a quiet meditative ashram located on the banks of Ganga, offering systematic training in the Himalayan tradition of meditation and breathing.',
      history: 'Founded in 1966 by the legendary sage Swami Rama, author of "Living with the Himalayan Masters", to serve as a quiet retreat for advanced practices.',
      rules: ['Strict silence must be observed during silent retreats.', 'No children below 12 years are permitted.', 'Satvik diet is strictly enforced.'],
      amenities: ['Meditation Hall', 'Library', 'Pure Vegetarian Food', 'Gardens', 'River View', 'Hot Water'],
      nearbyAttractions: ['Triveni Ghat', 'Bharat Mandir', 'Ram Jhula'],
      email: 'sadhanamandir@gmail.com',
      website: 'www.sadhanamandir.org'
    },
    {
      name: 'Kriya Yoga Ashram Rishikesh',
      city: 'Rishikesh',
      district: 'Dehradun',
      state: 'Uttarakhand',
      pincode: '249201',
      coordinates: [78.3195, 30.1251],
      description: 'Dedicated to Kriya Yoga as taught by Lahiri Mahasaya and Paramahansa Yogananda, this ashram provides training in self-realization techniques.',
      history: 'Established by realized master Swami Shankarananda Giri to provide seekers a platform for learning cosmic breath control and chakra concentration.',
      rules: ['Prior instruction in Kriya Yoga is preferred.', 'Strict Satvik diet.', 'Maintain meditation schedules.'],
      amenities: ['Meditation Hall', 'Yoga Center', 'Pure Vegetarian Food', 'Gardens', 'WiFi'],
      nearbyAttractions: ['Ram Jhula', 'Laxman Jhula', 'Tapovan Market'],
      email: 'kriyayoga@gmail.com',
      website: 'www.kriyayogaashram.net'
    },

    // === VRINDAVAN (10 Ashrams) ===
    {
      name: 'ISKCON Vrindavan Guesthouse',
      city: 'Vrindavan',
      district: 'Mathura',
      state: 'Uttar Pradesh',
      pincode: '281121',
      coordinates: [77.6852, 27.5721],
      description: 'Located in the Krishna Balaram Mandir complex, this guesthouse provides standard, deluxe and suite rooms for devotees worldwide. Safe, comfortable and highly spiritual.',
      history: 'Inaugurated in 1975 by ISKCON founder A.C. Bhaktivedanta Swami Prabhupada, it remains a premier destination for international pilgrims visiting Vraja.',
      rules: ['Follow the four regulative principles (No meat, no intoxication, no gambling, no illicit sex).', 'No entry inside temple complex with shoes.', 'Lockers should be used for valuables.'],
      amenities: ['Meditation Hall', 'Pure Vegetarian Food', 'WiFi', 'AC', 'Lift', 'Wheelchair Access', 'Restaurant', 'Bookstore'],
      nearbyAttractions: ['Krishna Balaram Mandir', 'Prem Mandir', 'Bankey Bihari Temple'],
      email: 'guesthouse@iskconvrindavan.com',
      website: 'www.iskconvrindavan.com'
    },
    {
      name: 'Prem Mandir Dharamshala',
      city: 'Vrindavan',
      district: 'Mathura',
      state: 'Uttar Pradesh',
      pincode: '281121',
      coordinates: [77.6791, 27.5685],
      description: 'Conveniently located near the magnificent Prem Mandir, this dharamshala offers spacious rooms for families and pilgrim groups visiting Vrindavan.',
      history: 'Developed by Jagadguru Kripalu Parishat to host devotees coming to witness the light and sound show and temple complex of Prem Mandir.',
      rules: ['Strict vegetarian guidelines apply.', 'Keep room check-in code ready at counter.', 'Lights out at 10:30 PM.'],
      amenities: ['Pure Vegetarian Food', 'Gardens', 'Hot Water', 'Lift', 'Ample Parking', 'AC'],
      nearbyAttractions: ['Prem Mandir', 'Maa Vaishno Devi Dham', 'ISKCON'],
      email: 'prem.dharamshala@jkp.org',
      website: 'www.jkp.org'
    },
    {
      name: 'Radha Raman Niwas',
      city: 'Vrindavan',
      district: 'Mathura',
      state: 'Uttar Pradesh',
      pincode: '281121',
      coordinates: [77.7012, 27.5841],
      description: 'Radha Raman Niwas is a traditional spiritual lodging in old Vrindavan, adjacent to the historic Radha Raman Temple. Ideal for devotees seeking an authentic devotional experience.',
      history: 'An old structure restored to provide lodgings. Radha Raman temple is over 500 years old, housing a self-manifested deity of Krishna.',
      rules: ['Respect local traditions and goswamis.', 'Do not carry leather items inside the temple.', 'Observe quietness.'],
      amenities: ['Pure Vegetarian Food', 'Temple', 'Basic Room Services', 'Hot Water', 'Friendly staff'],
      nearbyAttractions: ['Radha Raman Temple', 'Nidhivan', 'Radha Vallabh Temple'],
      email: 'radharamanniwas@gmail.com',
      website: ''
    },
    {
      name: 'Bankey Bihari Spiritual Stay',
      city: 'Vrindavan',
      district: 'Mathura',
      state: 'Uttar Pradesh',
      pincode: '281121',
      coordinates: [77.6985, 27.5798],
      description: 'A cozy guesthouse located in the heart of old Vrindavan markets, providing quick access to Sri Bankey Bihari Mandir.',
      history: 'Built by Vrindavan heritage trust to provide clean beds for Bankey Bihari temple line queue visitors.',
      rules: ['Beware of monkeys; keep room balconies closed.', 'Traditional attire is recommended.', 'Cooperate with security screening.'],
      amenities: ['Pure Vegetarian Food', 'Hot Water', 'WiFi', 'AC', 'Locker access'],
      nearbyAttractions: ['Bankey Bihari Temple', 'Radha Vallabh Temple', 'Yamuna River Ghats'],
      email: 'stay@bankeybiharistay.com',
      website: ''
    },
    {
      name: 'Fogla Ashram Vrindavan',
      city: 'Vrindavan',
      district: 'Mathura',
      state: 'Uttar Pradesh',
      pincode: '281121',
      coordinates: [77.6881, 27.5732],
      description: 'Fogla Ashram is a popular, high-capacity lodge in Raman Reti, offering very cheap dormitories and family rooms. It has a peaceful courtyard.',
      history: 'Founded by a charitable merchant trust from Rajasthan to provide affordable, standard accommodation for North Indian pilgrims.',
      rules: ['Dormitory check-out is 10:00 AM.', 'No smoking or tobacco allowed on the premises.', 'Outside visitors not allowed in rooms after 8 PM.'],
      amenities: ['Dormitory', 'Pure Vegetarian Food', 'Hot Water', 'Gardens', 'Ample Parking', 'Lift'],
      nearbyAttractions: ['ISKCON Temple', 'Prem Mandir', 'Lata Mangeshkar Memorial'],
      email: 'foglaashram@gmail.com',
      website: ''
    },
    {
      name: 'Shri Bindu Sewa Sansthan',
      city: 'Vrindavan',
      district: 'Mathura',
      state: 'Uttar Pradesh',
      pincode: '281121',
      coordinates: [77.6901, 27.5741],
      description: 'An ashram focused on spiritual study, environmental work (cleaning Yamuna), and cow protection (Goshala). It offers neat and simple lodgings.',
      history: 'Founded by Swami Balendu, the ashram is known for yoga, meditation, and feeding poor children in the Vrindavan community.',
      rules: ['Do not waste food served as prasad.', 'We encourage volunteer work at our Goshala.', 'No loud conversations.'],
      amenities: ['Meditation Hall', 'Pure Vegetarian Food', 'Gardens', 'Cow Shelter', 'WiFi', 'Yoga Center'],
      nearbyAttractions: ['Raman Reti', 'Yamuna River', 'ISKCON'],
      email: 'info@binduashram.org',
      website: 'www.binduashram.org'
    },
    {
      name: 'Balaji Ashram Vrindavan',
      city: 'Vrindavan',
      district: 'Mathura',
      state: 'Uttar Pradesh',
      pincode: '281121',
      coordinates: [77.6741, 27.5612],
      description: 'Balaji Ashram is a quiet retreat on Chhatikara road, providing modern air-conditioned rooms, a peaceful temple, and a lush green lawn.',
      history: 'Dedicated to Lord Venkateswara, this South-Indian style ashram provides traditional Vedic stays for South Indian tourists.',
      rules: ['No footwear allowed in the dining area.', 'Register all guest IDs correctly.', 'Curfew at 10:00 PM.'],
      amenities: ['Pure Vegetarian Food', 'Temple', 'Gardens', 'AC', 'WiFi', 'Ample Parking', 'Lift'],
      nearbyAttractions: ['Garuda Govindji Temple', 'Prem Mandir', 'Pagal Baba Temple'],
      email: 'balajiashram@gmail.com',
      website: ''
    },
    {
      name: 'Jaipur Temple Ashram',
      city: 'Vrindavan',
      district: 'Mathura',
      state: 'Uttar Pradesh',
      pincode: '281121',
      coordinates: [77.7081, 27.5855],
      description: 'The historic Jaipur Temple guest lodge offers an old-world heritage stay. Built in red sandstone, it has massive halls and royal architecture.',
      history: 'Built in 1917 by Sawai Madho Singh II, the Maharaja of Jaipur, the temple and adjacent lodge represent exquisite Rajasthani carvings.',
      rules: ['Do not damage the heritage red sandstone walls.', 'Respect the traditional temple pujaris.', 'Entry timing limits apply.'],
      amenities: ['Temple', 'Gardens', 'Pure Vegetarian Food', 'Basic Room Services', 'Historical Courtyard'],
      nearbyAttractions: ['Jaipur Temple', 'Kesi Ghat', 'Yamuna River'],
      email: 'jaipurtemple@rajtourism.gov.in',
      website: ''
    },
    {
      name: 'Gita Mandir Lodge',
      city: 'Vrindavan',
      district: 'Mathura',
      state: 'Uttar Pradesh',
      pincode: '281121',
      coordinates: [77.6721, 27.5512],
      description: 'Located near Mathura-Vrindavan road, this ashram guesthouse surrounds the beautiful Gita Mandir temple where the whole Bhagavad Gita is carved on red stone pillars.',
      history: 'Built by the Birla Trust, it provides cheap, spacious pilgrim stays and beautiful stone sculptures of Krishna.',
      rules: ['Keep voice low inside the Gita Pillars complex.', 'Check out at 12:00 noon.', 'Keep room keys safe.'],
      amenities: ['Temple', 'Gardens', 'Pure Vegetarian Food', 'Hot Water', 'Ample Parking'],
      nearbyAttractions: ['Gita Mandir', 'Akshaya Patra Kitchen', 'Birla Temple Mathura'],
      email: 'gitamandirlodge@birla.org',
      website: ''
    },
    {
      name: 'Vrindavan Chandrodaya Guesthouse',
      city: 'Vrindavan',
      district: 'Mathura',
      state: 'Uttar Pradesh',
      pincode: '281121',
      coordinates: [77.6612, 27.5681],
      description: 'A modern, premium guesthouse within the upcoming world\'s tallest temple complex. Extremely clean, safe, and offers high-class services.',
      history: 'Conceived by devotees of ISKCON Bangalore, this guesthouse provides international standard accommodations and daily prasad.',
      rules: ['Strictly no smoking, alcohol or meat.', 'Register vehicle number plate at main gate.', 'Attend morning Bhagavad Gita lectures.'],
      amenities: ['Meditation Hall', 'Pure Vegetarian Food', 'WiFi', 'AC', 'Lift', 'Wheelchair Access', 'Ample Parking', 'Gardens', 'Restaurant'],
      nearbyAttractions: ['Chandrodaya Mandir', 'Prem Mandir', 'Mathura border'],
      email: 'stay@vcm.org',
      website: 'www.vcm.org'
    }
  ];

  console.log(`Seeding exactly ${ashramConfigs.length} approved Ashrams...`);
  const seededAshrams = [];
  const seededRooms = [];

  const heroImages = getUnsplashImages();
  const galleryImages = getGalleryImages();
  const roomImages = getRoomImages();

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
      images: [
        heroImages[idx % heroImages.length],
        ...galleryImages
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

    // Create Rooms for this Ashram
    const roomCategories = [
      { name: 'Vedic Shared Dormitory Bed', type: 'dormitory', ac: 'Non-AC', cap: 1, inventory: 40, price: 1150, img: roomImages.dormitory, desc: 'Single bed in a spacious, air-cooled 10-bed shared dormitory hall.' },
      { name: 'Standard Single AC Room', type: 'private_room', ac: 'AC', cap: 1, inventory: 15, price: 1500, img: roomImages.private_room, desc: 'Comfortable single occupancy room with attached bathroom and window view.' },
      { name: 'Standard Double AC Room', type: 'private_room', ac: 'AC', cap: 2, inventory: 20, price: 1800, img: roomImages.double_room, desc: 'Ideal for couples or two pilgrims. Air-conditioned with writing desk and wardrobe.' },
      { name: 'Family Suite (4 Beds)', type: 'family_room', ac: 'AC', cap: 4, inventory: 10, price: 2200, img: roomImages.family_room, desc: 'Spacious room with four separate beds, attached bath, geyser, and closet.' },
      { name: 'Ganga View Deluxe AC Room', type: 'private_room', ac: 'AC', cap: 3, inventory: 12, price: 2600, img: roomImages.deluxe_room, desc: 'Premium room offering balcony views of the river/gardens, LCD TV, and hot water.' },
      { name: 'VIP Transcendental Suite', type: 'private_room', ac: 'AC', cap: 2, inventory: 5, price: 4000, img: roomImages.vip_suite, desc: 'Highly premium suite with separate living area, private puja altar, and VIP parking access.' }
    ];

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

  // Clear existing transactions cleanly to avoid duplicate keys / conflicts
  await clearDemoRecords(userIds, roomIds);

  // Re-seed availability calendar, historical bookings, payments, and reviews
  console.log('Generating dynamic availability calendar, bookings, and reviews...');
  
  const today = new Date();
  const availabilityDocs = [];
  
  for (let room of seededRooms) {
    const isDorm = room.type === 'dormitory';
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
