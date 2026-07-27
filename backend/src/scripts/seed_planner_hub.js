import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PlannerTemplate from '../models/PlannerTemplate.js';
import LocalServiceItem from '../models/LocalServiceItem.js';

dotenv.config();

const connStr = process.env.MONGODB_URI || 'mongodb://localhost:27017/ashray_bharat';

const templateData = [
  {
    destination: 'Kedarnath & Char Dham',
    slug: 'kedarnath-char-dham-template',
    purpose: 'Pilgrimage & Darshan',
    durationDays: 7,
    bestSeason: 'May to October',
    crowdLevel: 'Moderate Crowd',
    weather: '14°C - Clear Sky',
    totalDistance: '1,450 km',
    estimatedCostPerPerson: 19700,
    dayPlans: [
      { day: 1, title: 'Arrival at Haridwar & Evening Ganga Aarti', morning: 'Reach Haridwar Station. Check-in Hari Har Ashram.', afternoon: 'Rest & Satvik Lunch.', evening: 'Attend Ganga Aarti at Har Ki Pauri.', night: 'Stay at Haridwar Ashram.' },
      { day: 2, title: 'Haridwar to Guptkashi Base Camp', morning: 'Depart via AC tourist coach along Bhagirathi River.', afternoon: 'Tea stop at Devprayag Sangam.', evening: 'Reach Guptkashi base camp.', night: 'Overnight rest.' },
      { day: 3, title: 'Kedarnath Dham Trek & Darshan', morning: 'Trek 16 km from Gaurikund to Kedarnath.', afternoon: 'Sacred darshan at Kedarnath Temple.', evening: 'Attend evening Bhasma Aarti.', night: 'Night stay at Kedarnath Dham.' },
    ],
    packingList: ['Government Aadhaar ID', 'Thermal Woolen Jackets', 'Trekking Shoes', 'Medical Kit', 'Reusable Water Bottle'],
  },
];

const localData = [
  {
    city: 'Varanasi',
    category: 'guides',
    title: 'Pandit Ramesh Shastri (Certified Kashi Guide)',
    location: 'Dashashwamedh Ghat, Varanasi',
    phone: '+91 98390 22222',
    rating: 5.0,
    badge: 'CERTIFIED SHASTRI',
    price: '₹1,200 / tour',
    description: 'Ministry of Tourism certified guide for Ganga Aarti history, temple corridor walks, and Sankat Mochan history.',
    image: 'https://images.unsplash.com/photo-1561361058-c24e36e56336?auto=format&fit=crop&w=600&q=80',
  },
  {
    city: 'Haridwar',
    category: 'transport',
    title: 'Haridwar AC Innova & Auto Taxi Stand',
    location: 'Haridwar Railway Station',
    phone: '+91 98765 11111',
    rating: 4.9,
    badge: 'VERIFIED OPERATOR',
    price: '₹400 / transfer',
    description: '24/7 prepaid auto rickshaws, station transfers, and hill cabs with certified mountain drivers.',
    image: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=600&q=80',
  },
];

const seedPlannerHub = async () => {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(connStr);
    console.log('Connected to MongoDB Atlas.');

    await PlannerTemplate.deleteMany({});
    await LocalServiceItem.deleteMany({});
    console.log('Cleared previous planner templates and local service items.');

    await PlannerTemplate.insertMany(templateData);
    await LocalServiceItem.insertMany(localData);

    console.log('\nSuccessfully seeded Planner & Local Hub data into MongoDB Atlas!\n');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding planner hub:', error);
    process.exit(1);
  }
};

seedPlannerHub();
