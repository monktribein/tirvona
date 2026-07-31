import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ashram from '../models/Ashram.js';
import Room from '../models/Room.js';
import connectDB from '../config/db.js';

dotenv.config();

const ASHRAM_UPDATES = [
  {
    name: 'Shantikunj Gayatri Pariwar Ashram',
    amenities: [
      'Meditation Hall',
      'Pure Vegetarian Food',
      'Cow Shelter',
      'Gardens',
      'Free Medical Dispensary',
      'Library',
      'Yoga Center',
    ],
    foodType: 'Satvik Pure Vegetarian',
    roomUpdates: [
      { nameMatch: 'Gayatri Sadhana Dormitory Bed', acType: 'Non-AC' },
      { nameMatch: 'Standard Single Non-AC Room', acType: 'Non-AC' },
      { nameMatch: 'Standard Double Non-AC Room', acType: 'Non-AC' },
      { nameMatch: 'Standard Double AC Room', newName: 'Standard Double Non-AC Room (Deluxe)', acType: 'Non-AC' },
      { nameMatch: 'Family Suite (4 Beds)', newName: 'Family Non-AC Suite (4 Beds)', acType: 'Non-AC' },
      { nameMatch: 'Deluxe Himalayan View Suite', newName: 'Deluxe Himalayan View Non-AC Suite', acType: 'Non-AC' },
    ],
  },
  {
    name: 'Prem Nagar Ashram',
    amenities: [
      'AC',
      'Meditation Hall',
      'Pure Vegetarian Food',
      'Gardens',
      'WiFi',
      'Lift',
      'Wheelchair Access',
      'Ample Parking',
    ],
    foodType: 'Satvik Vegetarian',
    roomUpdates: [],
  },
  {
    name: 'Bharat Sevashram Sangha',
    amenities: [
      'Pure Vegetarian Food',
      'Temple',
      'Community Kitchen',
      'Basic First Aid',
      'Security',
    ],
    foodType: 'Simple Vegetarian Prasad',
    roomUpdates: [
      { nameMatch: 'Pilgrim Subsidy Shared Dorm Bed', acType: 'Non-AC' },
      { nameMatch: 'Economy Single Non-AC Room', acType: 'Non-AC' },
      { nameMatch: 'Economy Double Non-AC Room', acType: 'Non-AC' },
      { nameMatch: 'Standard AC Twin Bed Room', newName: 'Standard Non-AC Twin Bed Room', acType: 'Non-AC' },
      { nameMatch: 'Family Hall (5 Beds)', acType: 'Non-AC' },
    ],
  },
  {
    name: 'Maa Anandamayi Ashram',
    amenities: [
      'Meditation Hall',
      'Pure Vegetarian Food',
      'Gardens',
      'Temple',
      'Library',
    ],
    foodType: 'Satvik Vegetarian',
    roomUpdates: [
      { nameMatch: 'Quiet Meditation Shared Dorm Bed', acType: 'Non-AC' },
      { nameMatch: 'Single Quiet Non-AC Room', acType: 'Non-AC' },
      { nameMatch: 'Standard Double Non-AC Room', acType: 'Non-AC' },
      { nameMatch: 'Standard Double AC Room', newName: 'Standard Double Non-AC Room', acType: 'Non-AC' },
      { nameMatch: 'Samadhi View Family Room', newName: 'Samadhi View Non-AC Family Room', acType: 'Non-AC' },
    ],
  },
  {
    name: 'Sapt Rishi Ashram',
    amenities: [
      'River View',
      'Pure Vegetarian Food',
      'Meditation Hall',
      'Gardens',
      'Cow Shelter',
    ],
    foodType: 'Satvik Pure Vegetarian',
    roomUpdates: [
      { nameMatch: 'Saptarishi Seven-Stream Dorm Bed', acType: 'Non-AC' },
      { nameMatch: 'Simple Single Non-AC Room', acType: 'Non-AC' },
      { nameMatch: 'Standard Twin Room', acType: 'Non-AC' },
      { nameMatch: 'Standard AC Double Room', newName: 'Standard Riverfront Non-AC Double Room', acType: 'Non-AC' },
      { nameMatch: 'Family Retreat Room (4 Beds)', newName: 'Family Retreat Non-AC Room (4 Beds)', acType: 'Non-AC' },
    ],
  },
  {
    name: 'Parmarth Niketan Ashram',
    amenities: [
      'AC',
      'River View',
      'Meditation Hall',
      'Pure Vegetarian Food',
      'Yoga Center',
      'Gardens',
      'WiFi',
      'Library',
      'Wheelchair Access',
    ],
    foodType: 'Satvik Vegetarian Ashram Dining',
    roomUpdates: [],
  },
  {
    name: 'Sivananda Ashram',
    amenities: [
      'Meditation Hall',
      'Library',
      'Pure Vegetarian Food',
      'Yoga Center',
      'Free Hospital',
      'Bookstore',
    ],
    foodType: 'Strict Monastic Satvik Meal',
    roomUpdates: [
      { nameMatch: 'Divine Life Yoga Dormitory Bed', acType: 'Non-AC' },
      { nameMatch: 'Sadhana Single Non-AC Room', acType: 'Non-AC' },
      { nameMatch: 'Sadhana Double Non-AC Room', acType: 'Non-AC' },
      { nameMatch: 'Executive Double AC Room', newName: 'Executive Double Non-AC Room', acType: 'Non-AC' },
      { nameMatch: 'Premium Spiritual Suite', newName: 'Premium Spiritual Non-AC Suite', acType: 'Non-AC' },
    ],
  },
  {
    name: 'Swami Dayananda Ashram',
    amenities: [
      'River View',
      'Meditation Hall',
      'Library',
      'Pure Vegetarian Food',
      'WiFi',
      'Temple',
    ],
    foodType: 'Satvik Vegetarian',
    roomUpdates: [
      { nameMatch: 'Vedanta Study Dormitory Bed', acType: 'Non-AC' },
      { nameMatch: 'Courtyard Single Room', acType: 'Non-AC' },
      { nameMatch: 'Riverfront Double Non-AC Room', acType: 'Non-AC' },
      { nameMatch: 'Riverfront Double AC Room', newName: 'Riverfront Double Non-AC Deluxe Room', acType: 'Non-AC' },
      { nameMatch: 'Study Suite with Library Access', newName: 'Study Suite Non-AC with Library Access', acType: 'Non-AC' },
    ],
  },
  {
    name: 'Omkarananda Ashram Himalayas',
    amenities: [
      'AC',
      'Meditation Hall',
      'Yoga Center',
      'Temple',
      'Pure Vegetarian Food',
      'Gardens',
      'WiFi',
    ],
    foodType: 'Pure Vegetarian',
    roomUpdates: [],
  },
  {
    name: 'Gita Bhawan Retreat',
    amenities: [
      'River View',
      'Pure Vegetarian Food',
      'Temple',
      'Dispensary',
      'Laxmi Narayan Temple',
      'Sanskrit Bookstore',
    ],
    foodType: 'Bhojnalaya Satvik Meals',
    roomUpdates: [
      { nameMatch: 'Subsidized Pilgrim Dormitory Bed', acType: 'Non-AC' },
      { nameMatch: 'Economy Single Non-AC Room', acType: 'Non-AC' },
      { nameMatch: 'Standard Double Non-AC Room', acType: 'Non-AC' },
      { nameMatch: 'Standard Triple Room', acType: 'Non-AC' },
      { nameMatch: 'Family Cottage (5 Beds)', newName: 'Family Cottage Non-AC (5 Beds)', acType: 'Non-AC' },
    ],
  },
  {
    name: 'ISKCON Vrindavan Guesthouse',
    amenities: [
      'AC',
      'Meditation Hall',
      'Pure Vegetarian Food',
      'WiFi',
      'Lift',
      'Wheelchair Access',
      'Restaurant',
      'Bookstore',
      'Ample Parking',
    ],
    foodType: 'Govinda Satvik Pure Veg',
    roomUpdates: [],
  },
  {
    name: 'MVT Guesthouse Vrindavan',
    amenities: [
      'AC',
      'Pure Vegetarian Food',
      'Gardens',
      'WiFi',
      'Restaurant',
      'Security',
    ],
    foodType: 'Pure Vegetarian International Guesthouse Dining',
    roomUpdates: [],
  },
  {
    name: 'Prem Mandir Dharamshala JKP',
    amenities: [
      'Pure Vegetarian Food',
      'Gardens',
      'Lift',
      'Ample Parking',
      'Temple',
    ],
    foodType: 'Satvik Prasadam',
    roomUpdates: [
      { nameMatch: 'JKP Pilgrim Shared Dormitory Bed', acType: 'Non-AC' },
      { nameMatch: 'Standard Double Non-AC Room', acType: 'Non-AC' },
      { nameMatch: 'Standard Double AC Room', newName: 'Standard Family Non-AC Room', acType: 'Non-AC' },
    ],
  },
  {
    name: 'Fogla Ashram Vrindavan',
    amenities: [
      'Pure Vegetarian Food',
      'Gardens',
      'Lift',
      'Ample Parking',
      'Dormitory',
    ],
    foodType: 'Pure Vegetarian',
    roomUpdates: [
      { nameMatch: 'Raman Reti Economy Dorm Bed', acType: 'Non-AC' },
      { nameMatch: 'Standard Single Non-AC Room', acType: 'Non-AC' },
      { nameMatch: 'Standard Double Non-AC Room', acType: 'Non-AC' },
      { nameMatch: 'Standard Double AC Room', newName: 'Deluxe Double Non-AC Room', acType: 'Non-AC' },
      { nameMatch: 'Family AC Room (4 Beds)', newName: 'Family Non-AC Room (4 Beds)', acType: 'Non-AC' },
    ],
  },
  {
    name: 'Bhagwat Dham Ashram',
    amenities: [
      'Meditation Hall',
      'Pure Vegetarian Food',
      'Gardens',
      'Temple',
    ],
    foodType: 'Satvik Vegetarian',
    roomUpdates: [
      { nameMatch: 'Satsang Shared Dormitory Bed', acType: 'Non-AC' },
      { nameMatch: 'Traditional Single Non-AC Room', acType: 'Non-AC' },
      { nameMatch: 'Traditional Double Non-AC Room', acType: 'Non-AC' },
      { nameMatch: 'Deluxe Family Room (4 Beds)', newName: 'Deluxe Family Non-AC Room (4 Beds)', acType: 'Non-AC' },
    ],
  },
];

const VALID_STATUSES = ['pending_docs', 'pending_inspection', 'approved', 'rejected', 'suspended'];
const VALID_ROOM_STATUSES = ['active', 'maintenance', 'archived'];

async function updateFacilities() {
  await connectDB();
  console.log('--- STARTING REALISTIC FACILITY MIGRATION ---');

  for (const config of ASHRAM_UPDATES) {
    const ashram = await Ashram.findOne({ name: config.name });
    if (!ashram) {
      console.warn(`Ashram not found: ${config.name}`);
      continue;
    }

    // Fix invalid status if present in legacy records
    if (!VALID_STATUSES.includes(ashram.status)) {
      ashram.status = 'approved';
    }

    // Update Ashram amenities & foodType
    ashram.amenities = config.amenities;
    if (config.foodType) {
      if (!ashram.food) ashram.food = {};
      ashram.food.foodType = config.foodType;
    }
    await ashram.save();
    console.log(`Updated Ashram: [${ashram.name}] -> Amenities: ${JSON.stringify(ashram.amenities)}`);

    const rooms = await Room.find({ ashramId: ashram._id });
    for (const r of rooms) {
      if (!VALID_ROOM_STATUSES.includes(r.status)) {
        r.status = 'active';
      }

      if (config.roomUpdates && config.roomUpdates.length > 0) {
        const updateRule = config.roomUpdates.find((u) => u.nameMatch === r.name);
        if (updateRule) {
          if (updateRule.newName) r.name = updateRule.newName;
          if (updateRule.acType) r.acType = updateRule.acType;
          await r.save();
          console.log(`  -> Room updated: "${r.name}" (acType: ${r.acType})`);
        } else if (!ashram.amenities.includes('AC') && r.acType === 'AC') {
          r.acType = 'Non-AC';
          if (r.name.includes('AC')) {
            r.name = r.name.replace(/AC/g, 'Non-AC');
          }
          await r.save();
          console.log(`  -> Room auto-converted to Non-AC: "${r.name}"`);
        } else {
          await r.save();
        }
      } else if (!config.amenities.includes('AC')) {
        if (r.acType === 'AC') {
          r.acType = 'Non-AC';
          if (r.name.includes('AC')) {
            r.name = r.name.replace(/AC/g, 'Non-AC');
          }
          await r.save();
          console.log(`  -> Room auto-converted to Non-AC: "${r.name}"`);
        } else {
          await r.save();
        }
      } else {
        await r.save();
      }
    }
  }

  console.log('\n--- MIGRATION COMPLETE ---');
  process.exit(0);
}

updateFacilities().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
