import connectDB from '../config/db.js';
import VolunteerJob from '../models/VolunteerJob.js';
import Ashram from '../models/Ashram.js';

const seedVolunteerJobs = async () => {
  try {
    await connectDB();

    console.log('Clearing existing volunteer openings...');
    await VolunteerJob.deleteMany({});

    // Find any existing ashram or fallback ObjectId
    const sampleAshrams = await Ashram.find().limit(5);
    const ashramId = sampleAshrams[0]?._id || '650000000000000000000001';

    const jobs = [
      {
        ashramId,
        ashramName: 'Parmarth Niketan Ashram',
        city: 'Rishikesh',
        state: 'Uttarakhand',
        title: 'Ganga Aarti Event & Crowd Coordinator',
        department: 'Event Management',
        type: 'event_coordinator',
        openingsCount: 10,
        duration: '1 Month',
        accommodation: 'free_ashram_stay',
        food: 'satvik_free_3_meals',
        stipend: 'Free Ashram Stay + Satvik Meals',
        certificateProvided: true,
        responsibilities: [
          'Coordinate evening Ganga Aarti seating and pilgrim management',
          'Assist international and domestic devotees with seating queries',
          'Manage audio-visual desk during evening satsang',
        ],
        requirements: ['Fluent in English/Hindi', 'Devotional mindset', 'Physical fitness for standing during evening Aarti'],
        benefits: ['Certificate of Service from Parmarth Niketan', 'Daily satsang access with Pujya Swamiji', 'Free accommodation & meals'],
        contactPerson: { name: 'Acharya Ramdev', phone: '9876543210', email: 'seva@parmarth.org' },
        status: 'open',
        isGovtVerified: true,
      },
      {
        ashramId,
        ashramName: 'Sivananda Ashram (DLS)',
        city: 'Rishikesh',
        state: 'Uttarakhand',
        title: 'Resident Yoga & Meditation Assistant',
        department: 'Yoga & Wellness',
        type: 'volunteer',
        openingsCount: 4,
        duration: '3 Months',
        accommodation: 'free_ashram_stay',
        food: 'satvik_free_3_meals',
        stipend: 'Honorarium ₹5,000/mo + Stay',
        certificateProvided: true,
        responsibilities: [
          'Demonstrate yoga asanas during morning and evening practice',
          'Assist senior yoga acharyas in hall maintenance and mat layout',
          'Guide new yoga sadhakas on ashram rules and daily schedule',
        ],
        requirements: ['200-hour YTT certification or equivalent', 'Strict adherence to ashram brahmacharya rules'],
        benefits: ['Yoga Alliance recognized experience letter', 'Free room stay & 3 satvik meals'],
        contactPerson: { name: 'Swami Yogananda', phone: '9812345678', email: 'yoga@sivananda.org' },
        status: 'open',
        isGovtVerified: true,
      },
      {
        ashramId,
        ashramName: 'Shanti Kunj Ashram',
        city: 'Haridwar',
        state: 'Uttarakhand',
        title: 'Digital Content & Social Media Fellow',
        department: 'Digital Media',
        type: 'digital_marketing',
        openingsCount: 6,
        duration: '2 Months',
        accommodation: 'free_ashram_stay',
        food: 'satvik_free_3_meals',
        stipend: 'Stipend ₹8,000/mo + Free Room',
        certificateProvided: true,
        responsibilities: [
          'Capture high-quality photography and short reels of yajna and pravachan',
          'Manage daily Instagram & YouTube live broadcast setups',
          'Write spiritual articles for weekly e-magazine',
        ],
        requirements: ['Basic photography or reel editing skills', 'Familiarity with Canva/Premiere/Lightroom'],
        benefits: ['Certificate of Digital Fellowship', 'Portfolio expansion with high reach content'],
        contactPerson: { name: 'Dr. Chinmay Pandya', phone: '9898989898', email: 'media@shantikunj.org' },
        status: 'open',
        isGovtVerified: true,
      },
      {
        ashramId,
        ashramName: 'Kashi Annapurna Annakshetra',
        city: 'Varanasi',
        state: 'Uttar Pradesh',
        title: 'Mahaprasad Kitchen Seva Supervisor',
        department: 'Kitchen & Prasadam',
        type: 'kitchen_seva',
        openingsCount: 15,
        duration: '15 Days / 1 Month',
        accommodation: 'free_ashram_stay',
        food: 'satvik_free_3_meals',
        stipend: 'Free Stay + Satvik Mahaprasad',
        certificateProvided: true,
        responsibilities: [
          'Supervise queue management in 10,000+ daily pilgrim dining hall',
          'Ensure strict hygiene standards during vegetable chopping and serving',
          'Assist in kitchen inventory tracking and clean-up',
        ],
        requirements: ['Spirit of selfless service (Seva Bhav)', 'Ability to work in fast-paced environment'],
        benefits: ['Seva Samman Patra certificate', 'Free accommodation near Kashi Vishwanath corridor'],
        contactPerson: { name: 'Mahant Shankar Puri', phone: '9988776655', email: 'seva@kashiannapurna.org' },
        status: 'open',
        isGovtVerified: true,
      },
      {
        ashramId,
        ashramName: 'Bhakti Vedanta Ashram',
        city: 'Vrindavan',
        state: 'Uttar Pradesh',
        title: 'Gaushala Caretaker & Organic Farming Intern',
        department: 'Gaushala & Agriculture',
        type: 'internship',
        openingsCount: 8,
        duration: '1 Month',
        accommodation: 'free_ashram_stay',
        food: 'satvik_free_3_meals',
        stipend: 'Stipend ₹6,000/mo + Stay',
        certificateProvided: true,
        responsibilities: [
          'Care for 200+ indigenous Gir cows in Vrindavan gaushala',
          'Assist in preparation of organic Panchagavya and vermicompost',
          'Guide visiting school groups on Vedic farming practices',
        ],
        requirements: ['Love for animals and nature', 'Willingness for outdoor agricultural field work'],
        benefits: ['Certificate in Vedic Organic Agriculture', 'Free private room & satvik diet'],
        contactPerson: { name: 'Radha Charan Das', phone: '9765432109', email: 'gaushala@vrindavan.org' },
        status: 'open',
        isGovtVerified: true,
      },
      {
        ashramId,
        ashramName: 'Ram Janmabhoomi Pilgrim Service Desk',
        city: 'Ayodhya',
        state: 'Uttar Pradesh',
        title: 'Yatri Facilitation & Information Guide',
        department: 'Pilgrim Assistance',
        type: 'temple_guide',
        openingsCount: 20,
        duration: '1 Month',
        accommodation: 'free_ashram_stay',
        food: 'satvik_free_3_meals',
        stipend: 'Honorarium ₹7,500/mo + Stay',
        certificateProvided: true,
        responsibilities: [
          'Guide elderly and disabled pilgrims at Ayodhya Dham reception desk',
          'Manage locker facilities and cloakroom verification tags',
          'Provide directions for Ram Mandir, Hanumangarhi & Kanak Bhavan',
        ],
        requirements: ['Polite demeanor and customer empathy', 'Multi-lingual skills (Hindi, English, regional language a plus)'],
        benefits: ['Govt Enterprise Yatri Seva Certificate', 'Uniform provided + free stay & meals'],
        contactPerson: { name: 'Shri Champat Rai', phone: '9456789012', email: 'yatri@ayodhyatrust.org' },
        status: 'open',
        isGovtVerified: true,
      },
    ];

    await VolunteerJob.insertMany(jobs);
    console.log(`Successfully seeded ${jobs.length} verified Volunteer & Career openings!`);
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedVolunteerJobs();
