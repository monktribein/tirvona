import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}
import BlogAuthor from '../models/BlogAuthor.js';
import BlogPost from '../models/BlogPost.js';
import BlogComment from '../models/BlogComment.js';

dotenv.config();

const connStr = process.env.MONGODB_URI || 'mongodb://localhost:27017/ashray_bharat';

const authorsData = [
  {
    name: 'Gordon V. Shastri',
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&h=300&q=80',
    designation: 'Senior Temple Heritage Researcher',
    organization: 'Tirvona Sacred Research Cell',
    bio: 'Pujari and Vedic scholar who has spent 14 years documenting temple architecture, ancient rituals, and ashram paramparas across Uttarakhand & Kashi.',
    experience: '14+ Years Temple Research',
    email: 'gordon.shastri@tirvona.com',
    verified: true,
    articlesCount: 24,
  },
  {
    name: 'Radhika K. Kulkarni',
    photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&h=300&q=80',
    designation: 'Himalayan Yatra Specialist',
    organization: 'Indian Pilgrimage Writers Forum',
    bio: 'Avid trekker and spiritual travel writer specializing in Char Dham, Hemkund Sahib, and remote ashram stays across Garhwal and Kumaon.',
    experience: '9+ Years Yatra Writing',
    email: 'radhika.kulkarni@tirvona.com',
    verified: true,
    articlesCount: 18,
  },
  {
    name: 'Swami Anand Giri',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&h=300&q=80',
    designation: 'Yoga & Meditation Master',
    organization: 'Rishikesh Spiritual Trust',
    bio: 'Residing in Swarg Ashram Rishikesh for two decades, teaching Pranayama, Bhagavad Gita philosophy, and Mindful Living.',
    experience: '20+ Years Ashram Living',
    email: 'anand.giri@tirvona.com',
    verified: true,
    articlesCount: 32,
  },
];

const seedBlogHub = async () => {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(connStr);
    console.log('Connected to MongoDB Atlas.');

    await BlogAuthor.deleteMany({});
    await BlogPost.deleteMany({});
    await BlogComment.deleteMany({});
    console.log('Cleared previous blog authors, posts & comments.');

    const createdAuthors = await BlogAuthor.insertMany(authorsData);
    console.log(`Inserted ${createdAuthors.length} verified blog authors.`);

    const author1 = createdAuthors[0]._id;
    const author2 = createdAuthors[1]._id;
    const author3 = createdAuthors[2]._id;

    const postsData = [
      {
        title: 'Essential Guide To Planning Your First Sacred Ashram Stay',
        slug: 'guide-planning-first-ashram-stay',
        subtitle: 'Everything you need to know about ashram etiquette, daily schedule, satvik dining, and spiritual code of conduct.',
        content: `
Planning your first stay at a traditional Indian ashram is a life-changing experience. Unlike commercial hotel stays, an ashram is a sanctuary of peace, self-reflection, and spiritual discipline. Whether you are travelling to Rishikesh, Haridwar, Vrindavan, or Varanasi, following basic guidelines ensures a harmonious stay.

### 1. Understanding Ashram Etiquette
Ashrams operate on traditional Vedic principles. Rise early for morning Aarti and meditation. Respect quiet hours after 9:00 PM, and maintain cleanliness in public halls and dining areas.

### 2. Dress Code & Satvik Lifestyle
Modest Indian attire (kurtas, dhotis, sarees, or loose cotton trousers) is encouraged. Meals served at ashram mess halls (Bhojnalaya) are strictly pure vegetarian and cooked without onion or garlic to foster a sattvic state of mind.

### 3. Participating in Daily Seva
Many ashrams welcome guests to participate in voluntary service (Seva) such as preparing garlands, serving prasad, or maintaining gardens. Seva brings immense mental clarity and spiritual joy.
        `.trim(),
        excerpt: 'Discover essential etiquette, daily schedules, satvik food rules, and spiritual seva tips for a peaceful first ashram experience.',
        contentType: 'article',
        coverImage: '/blogs/rishikesh_ashram_1785404729056.png',
        gallery: [
          '/blogs/rishikesh_ashram_1785404729056.png',
          '/blogs/ganga_aarti_vns_1785404714879.png',
        ],
        authorId: author1,
        category: 'Travel Guide',
        tags: ['Ashram Stay', 'Rishikesh', 'Satvik Living', 'Spiritual Guide'],
        status: 'published',
        featured: true,
        views: 3820,
        likes: 420,
        readingTime: '6 min read',
        seoTitle: 'Essential Ashram Stay Guide | Tirvona Sacred Travel',
        seoDescription: 'Complete first-time guide for staying in traditional Indian ashrams in Rishikesh, Haridwar and Varanasi.',
      },
      {
        title: 'Sacred Ganga Aarti Varanasi: Evening Rituals & Spiritual Meaning',
        slug: 'ganga-aarti-varanasi-spiritual-video',
        subtitle: 'Watch the grand evening Aarti ceremony held at Dashashwamedh Ghat Varanasi with chanting of Vedic hymns.',
        content: `
Experience the divine energy of Kashi Ganga Aarti at Dashashwamedh Ghat. Every evening after sunset, priests clad in saffron robes perform the grand ritual with large multi-tiered brass lamps, conch shells, and incense.

### Spiritual Significance
The Aarti is an offering of gratitude to Mother Ganga, who is revered as the giver of life and spiritual purification. Thousands of devotees gather on boat decks and riverbank steps to witness the rhythmic brass lamp movements.
        `.trim(),
        excerpt: 'Watch the mesmerizing evening Ganga Aarti at Dashashwamedh Ghat Varanasi with divine brass lamp rituals and conch sounds.',
        contentType: 'video',
        coverImage: '/blogs/ganga_aarti_vns_1785404714879.png',
        youtubeUrl: 'https://www.youtube.com/watch?v=0kFhPVA888U',
        youtubeVideoId: '0kFhPVA888U',
        youtubeDuration: '18:45',
        youtubeViews: '128K Views',
        youtubeChannel: 'Kashi Heritage Media',
        authorId: author2,
        category: 'Videos',
        tags: ['Ganga Aarti', 'Varanasi', 'Kashi', 'Spiritual Video'],
        status: 'published',
        featured: true,
        views: 12400,
        likes: 1850,
        readingTime: 'Video (18:45)',
        seoTitle: 'Varanasi Ganga Aarti Video Documentary | Kashi Vishwanath',
        seoDescription: 'HD Video of Varanasi Dashashwamedh Ghat Ganga Aarti with live chanting & brass lamps.',
      },
      {
        title: 'Secrets of Temple Mahaprasad: Sacred Culinary Traditions of India',
        slug: 'secrets-temple-mahaprasad-traditions',
        subtitle: 'From Puri Jagannath 56 Bhog to Tirupati Srivari Laddu and Varanasi Lal Peda.',
        content: `
Temple Mahaprasad in Hinduism is not merely food; it is sanctified grace (Prasad) consecrated through ancient Vedic rituals.

### 1. Puri Jagannath Rosaghara
The kitchen at Puri Shri Mandir is the largest sacred kitchen in the world. Cooks prepare 56 varieties of food (Chhappan Bhog) in earthen pots stacked over clay stoves using water from holy wells.

### 2. Mathura & Kashi Sweet Traditions
Peda offerings at Kashi and Mathura are slow-roasted over low wood flames for hours to achieve divine aroma and caramelized golden texture.
        `.trim(),
        excerpt: 'Explore the sacred preparation, secret recipes, and spiritual significance of Mahaprasad across India\'s ancient temples.',
        contentType: 'article',
        coverImage: '/blogs/temple_prasad_1785404756481.png',
        authorId: author3,
        category: 'Temple History',
        tags: ['Mahaprasad', 'Puri Khaja', 'Tirupati Laddu', 'Prasad'],
        status: 'published',
        featured: true,
        views: 2950,
        likes: 310,
        readingTime: '8 min read',
        seoTitle: 'Temple Mahaprasad Traditions & History | Tirvona',
        seoDescription: 'Discover how sacred temple Mahaprasad is prepared in Puri, Tirupati and Varanasi.',
      },
      {
        title: 'Kedarnath Temple Documentary: High Himalayan Yatra',
        slug: 'kedarnath-temple-documentary-video',
        subtitle: 'A cinematic journey into the 12th century stone temple of Lord Shiva situated at 11,755 ft.',
        content: `
Journey to the holy shrine of Kedarnath nestled amidst snow-capped peaks of the Rudra Himalaya range. This documentary covers the trek from Gaurikund, stone architecture, and evening Aarti.
        `.trim(),
        excerpt: 'Experience the breathtaking journey to Kedarnath Temple with 4K drone visuals, stone architecture breakdown, and pilgrim stories.',
        contentType: 'video',
        coverImage: '/blogs/hindi_yatra_story_1785404742334.png',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        youtubeVideoId: 'dQw4w9WgXcQ',
        youtubeDuration: '24:10',
        youtubeViews: '94K Views',
        youtubeChannel: 'Himalayan Yatra Films',
        authorId: author1,
        category: 'Videos',
        tags: ['Kedarnath', 'Himalayas', 'Shiva', 'Video Guide'],
        status: 'published',
        featured: true,
        views: 8900,
        likes: 1120,
        readingTime: 'Video (24:10)',
        seoTitle: 'Kedarnath Temple Yatra Video Documentary | Tirvona',
        seoDescription: 'Watch high definition Kedarnath Temple Yatra video documentary.',
      },
    ];

    const createdPosts = await BlogPost.insertMany(postsData);
    console.log(`Inserted ${createdPosts.length} spiritual media & blog posts.`);

    // Seed sample comments
    const commentsData = [
      {
        postId: createdPosts[0]._id,
        userName: 'Aarti Deshmukh',
        userEmail: 'aarti@gmail.com',
        comment: 'Very helpful article! Staying at Swarg Ashram last month was the most peaceful 5 days of my life.',
        rating: 5,
      },
      {
        postId: createdPosts[1]._id,
        userName: 'Vikramaditya Singh',
        userEmail: 'vikram@gmail.com',
        comment: 'The video footage of Ganga Aarti brings tears of devotion. Har Har Gange!',
        rating: 5,
      },
    ];

    await BlogComment.insertMany(commentsData);
    console.log('Inserted sample blog comments.');

    console.log('\nSuccessfully seeded Spiritual Media & Knowledge Hub into MongoDB Atlas!\n');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding blog hub:', error);
    process.exit(1);
  }
};

seedBlogHub();
