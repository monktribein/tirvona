import fs from 'fs';
import path from 'path';
import dns from 'dns';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import BlogAuthor from '../models/BlogAuthor.js';
import BlogPost from '../models/BlogPost.js';
import BlogComment from '../models/BlogComment.js';
import VisitorArticle from '../models/visitorBlog/VisitorArticle.js';
import User from '../models/User.js';
import Ashram from '../models/Ashram.js';
import Booking from '../models/Booking.js';

dotenv.config();

const connStr = process.env.MONGODB_URI || 'mongodb://localhost:27017/ashray_bharat';

const artifactDir = `C:\\Users\\Mr.Panda\\.gemini\\antigravity-ide\\brain\\0f6bbb67-fe1b-456e-b0ef-240853322efc`;
const targetDir = path.resolve(process.cwd(), '../frontend/public/blogs');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Copy images
const imageMap = {
  ganga: 'ganga_aarti_vns_1785404714879.png',
  rishikesh: 'rishikesh_ashram_1785404729056.png',
  hindi: 'hindi_yatra_story_1785404742334.png',
  prasad: 'temple_prasad_1785404756481.png',
};

const copiedUrls = {};

for (const [key, filename] of Object.entries(imageMap)) {
  const src = path.join(artifactDir, filename);
  const dest = path.join(targetDir, filename);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    copiedUrls[key] = `/blogs/${filename}`;
    console.log(`Copied ${filename} to frontend/public/blogs/`);
  } else {
    console.warn(`File missing: ${src}`);
    copiedUrls[key] = 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=1200&q=80';
  }
}

const authorsData = [
  {
    name: 'स्वामी आनंद गिरि (Swami Anand Giri)',
    photo: copiedUrls.hindi,
    designation: 'वरिष्ठ वेदांत एवं योग शोधकर्ता (Senior Vedic Scholar)',
    organization: 'परमार्थ निकेतन आश्रम (Parmarth Niketan Ashram)',
    bio: 'ऋषिकेश एवं हरिद्वार के प्राचीन आश्रमों में 18 वर्षों का प्रवास। भगवद्गीता, सात्विक जीवन शैली और हिमालयी तीर्थ यात्राओं के विशेषज्ञ।',
    experience: '18+ वर्ष आश्रम प्रवास एवं शोध',
    email: 'anand.giri@tirvona.com',
    verified: true,
    articlesCount: 32,
  },
  {
    name: 'राधिका के. कुलकर्णी (Radhika Kulkarni)',
    photo: copiedUrls.rishikesh,
    designation: 'हिमालयी यात्रा एवं मंदिर इतिहासकार (Temple Heritage Writer)',
    organization: 'भारतीय तीर्थ शोध संस्थान (Indian Pilgrimage Research)',
    bio: 'चार धाम यात्रा, काशी विश्वनाथ और रामेश्वरम मंदिर परंपराओं पर 12 से अधिक शोध लेख प्रकाशित।',
    experience: '12+ Years Yatra Research',
    email: 'radhika.kulkarni@tirvona.com',
    verified: true,
    articlesCount: 24,
  },
  {
    name: 'पंडित रमेश शास्त्री (Pt. Ramesh Shastri)',
    photo: copiedUrls.ganga,
    designation: 'मुख्य पुजारी एवं देवस्थान शोधकर्ता',
    organization: 'काशी विद्वत परिषद',
    bio: 'काशी के प्राचीन घाटों एवं महाप्रसाद परंपराओं के विशेषज्ञ।',
    experience: '20+ वर्ष वैदिक कर्मकांड',
    email: 'ramesh.shastri@tirvona.com',
    verified: true,
    articlesCount: 19,
  },
];

const seedBlogs = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(connStr);
    console.log('Connected to MongoDB.');

    await BlogAuthor.deleteMany({});
    await BlogPost.deleteMany({});
    await BlogComment.deleteMany({});
    await VisitorArticle.deleteMany({});
    console.log('Cleared existing blog posts, authors, and visitor articles.');

    const createdAuthors = await BlogAuthor.insertMany(authorsData);
    const author1 = createdAuthors[0]._id;
    const author2 = createdAuthors[1]._id;
    const author3 = createdAuthors[2]._id;

    const postsData = [
      {
        title: 'Essential Guide To Planning Your First Sacred Ashram Stay in Rishikesh',
        slug: 'guide-planning-first-ashram-stay',
        subtitle: 'Everything you need to know about ashram etiquette, daily schedule, satvik dining, and spiritual code of conduct.',
        content: `
Planning your first stay at a traditional Indian ashram is a transformative, soul-nourishing experience. Unlike commercial hotel stays, an ashram is a sanctuary of peace, inner discipline, and spiritual awakening. Whether you are traveling to Rishikesh, Haridwar, Vrindavan, or Varanasi, adhering to authentic Vedic guidelines ensures a harmonious yatra.

### 1. Understanding Ashram Etiquette & Daily Discipline
Traditional ashrams follow a disciplined daily routine starting with the Brahma Muhurta (4:00 AM). Guests are encouraged to wake up early for morning Ganga Aarti, meditation, and Pranayama sessions. Respect quiet hours after 9:00 PM and maintain silence (Mauna) during meals.

### 2. Dress Code & Satvik Culinary Rules
Modest Indian attire such as loose cotton kurtas, dhotis, sarees, or salwar suits is essential. Dining halls (Bhojnalaya) serve purely vegetarian Satvik meals cooked without onion or garlic, using fresh seasonal ingredients to foster mental clarity and spiritual lightness.

### 3. Participating in Voluntary Seva (Service)
Voluntary service (Seva) is an integral part of ashram living. Devotees can contribute by helping prepare flower garlands for temple pujas, serving prasad in the community kitchen, or tending to herbal gardens.
        `.trim(),
        excerpt: 'Discover essential etiquette, daily schedules, satvik food rules, and spiritual seva tips for a peaceful ashram stay in Rishikesh.',
        contentType: 'article',
        coverImage: copiedUrls.rishikesh,
        gallery: [copiedUrls.rishikesh, copiedUrls.ganga],
        authorId: author2,
        category: 'Travel Guide',
        tags: ['Ashram Stay', 'Rishikesh', 'Satvik Living', 'Spiritual Yatra'],
        status: 'published',
        featured: true,
        views: 4820,
        likes: 540,
        readingTime: '6 min read',
        seoTitle: 'Rishikesh Ashram Stay Guide | Tirvona Sacred Travel',
        seoDescription: 'Complete guide for first-time ashram stays in Rishikesh with daily schedule, satvik food rules & seva guidelines.',
      },
      {
        title: 'ऋषिकेश आश्रम प्रवास: आत्मिक शांति, दैनिक दिनचर्या और योग साधना का पावन अनुभव',
        slug: 'rishikesh-ashram-pravas-hindi-guide',
        subtitle: 'मां गंगा के पावन तट पर आश्रम जीवन की पवित्र परंपराएं, सात्विक भोजन और ध्यान साधना की संपूर्ण जानकारी।',
        content: `
मां भगवती गंगा के पावन तट पर स्थित ऋषिकेश के आश्रमों में प्रवास करना जीवन का एक अलौकिक एवं शांतिदायी अनुभव है। आधुनिक भागदौड़ भरे जीवन से दूर, आश्रम की पवित्र पृष्ठभूमि में मन को असीम शांति और नवऊर्जा की प्राप्ति होती है।

### 1. ब्रह्म मुहूर्त एवं दैनिक योग साधना
आश्रम में दिन की शुरुआत प्रात: 4:30 बजे ब्रह्म मुहूर्त से होती है। गंगा तट पर प्रातःकालीन ध्यान, प्राणायाम और योगाभ्यास से शरीर और आत्मा दोनों निर्मल होते हैं।

### 2. सात्विक आहार एवं आश्रम मर्यादा
आश्रम भोजनालय में पूर्णत: सात्विक (बिना प्याज और लहसुन) ताजा भोजन परोसा जाता है। भोजन से पूर्व वैदिक मंत्रों का पाठ मन में कृतज्ञता का भाव जगाता है।

### 3. सांध्य कालीन गंगा आरती एवं सेवा
संध्या समय परमार्थ निकेतन एवं त्रिवेणी घाट पर होने वाली गंगा आरती में भाग लेना अत्यंत फलदायी माना गया है। दीपदान और शंखध्वनि से पूरा वातावरण दिव्य हो उठता है।
        `.trim(),
        excerpt: 'ऋषिकेश आश्रम में प्रवास के नियम, ब्रह्म मुहूर्त ध्यान साधना, सात्विक खान-पान और संध्या गंगा आरती का प्रामाणिक अनुभव।',
        contentType: 'article',
        coverImage: copiedUrls.hindi,
        gallery: [copiedUrls.hindi, copiedUrls.rishikesh],
        authorId: author1,
        category: 'Pilgrim Story',
        tags: ['आश्रम प्रवास', 'ऋषिकेश', 'गंगा आरती', 'सात्विक जीवन'],
        status: 'published',
        featured: true,
        views: 6200,
        likes: 890,
        readingTime: '7 min read',
        seoTitle: 'ऋषिकेश आश्रम प्रवास और योग साधना | तिरवोना',
        seoDescription: 'ऋषिकेश के पावन आश्रमों में प्रवास, सात्विक भोजन और गंगा आरती का संपूर्ण हिंदी ब्लॉग।',
      },
      {
        title: 'Sacred Ganga Aarti Varanasi: Evening Rituals & Hymns at Dashashwamedh Ghat',
        slug: 'ganga-aarti-varanasi-spiritual-video',
        subtitle: 'Watch the grand evening Aarti ceremony held at Dashashwamedh Ghat Varanasi with chanting of Vedic mantras.',
        content: `
Experience the transcendent divine energy of Kashi Ganga Aarti at Dashashwamedh Ghat. Every evening after sunset, young priests clad in saffron robes perform the grand traditional ritual with multi-tiered burning brass lamps, incense, and conch shells.

### Spiritual Significance of Kashi Ganga Aarti
The Aarti is a supreme offering of gratitude to Mother Ganga. Thousands of devotees gather on wooden boat decks and ancient stone steps to behold the rhythmic movements of multi-tiered oil lamps illuminating the sacred river waters.
        `.trim(),
        excerpt: 'Watch the grand evening Ganga Aarti at Dashashwamedh Ghat Varanasi featuring live Vedic chanting, brass oil lamps, and divine riverfront visuals.',
        contentType: 'video',
        coverImage: copiedUrls.ganga,
        youtubeUrl: 'https://www.youtube.com/watch?v=0kFhPVA888U',
        youtubeVideoId: '0kFhPVA888U',
        youtubeDuration: '18:45',
        youtubeViews: '142K Views',
        youtubeChannel: 'Kashi Heritage Media',
        authorId: author3,
        category: 'Videos',
        tags: ['Ganga Aarti', 'Varanasi', 'Dashashwamedh Ghat', 'Kashi'],
        status: 'published',
        featured: true,
        views: 14200,
        likes: 2150,
        readingTime: 'Video (18:45)',
        seoTitle: 'Varanasi Ganga Aarti Video & Hymns | Tirvona Sacred Travel',
        seoDescription: 'High definition video documentary of Varanasi Dashashwamedh Ghat Ganga Aarti ceremony.',
      },
      {
        title: 'Secrets of Temple Mahaprasad: Sacred Culinary Traditions of Ancient India',
        slug: 'secrets-temple-mahaprasad-traditions',
        subtitle: 'From Puri Jagannath 56 Bhog to Tirupati Srivari Laddu and Mathura Peda traditions.',
        content: `
Temple Mahaprasad in Hindu tradition is far more than physical nourishment; it is consecrated divine grace. Prepared strictly according to ancient Agama scriptures, Mahaprasad carries centuries of spiritual heritage.

### 1. Puri Jagannath Shri Mandir Rosaghara
The kitchen at Puri Jagannath Temple is recognized as the largest sacred kitchen in the world. Cooks prepare 56 traditional dishes (Chhappan Bhog) in unglazed earthen pots stacked one over another on wood-fired clay hearths.

### 2. Kashi & Mathura Sweet Offerings
Special peda and kheer prasad in Varanasi and Mathura are slow-cooked over low flame using pure A2 cow milk and cardamom, creating an aromatic golden delicacy offered to the deity before distribution to devotees.
        `.trim(),
        excerpt: 'Explore the sacred preparation, ancient wood-fire recipes, and spiritual importance of Mahaprasad in India\'s renowned temples.',
        contentType: 'article',
        coverImage: copiedUrls.prasad,
        gallery: [copiedUrls.prasad],
        authorId: author2,
        category: 'Temple History',
        tags: ['Mahaprasad', 'Puri Jagannath', 'Temple Traditions', 'Satvik Prasad'],
        status: 'published',
        featured: true,
        views: 3950,
        likes: 480,
        readingTime: '8 min read',
        seoTitle: 'Secrets of Temple Mahaprasad Traditions | Tirvona',
        seoDescription: 'Discover how sacred temple Mahaprasad is prepared in Puri Jagannath, Mathura and Kashi.',
      },
    ];

    const createdPosts = await BlogPost.insertMany(postsData);
    console.log(`Successfully inserted ${createdPosts.length} authentic Indian blog posts.`);

    // Seed Verified Visitor Articles
    let user = await User.findOne({ email: 'satyamkumarpandey4567@gmail.com' });
    if (!user) {
      user = await User.findOne({});
    }

    let ashram = await Ashram.findOne({ status: 'approved' });
    if (!ashram) {
      ashram = await Ashram.findOne({});
    }

    let booking = await Booking.findOne({ customerId: user?._id });
    if (!booking && user && ashram) {
      booking = await Booking.create({
        bookingId: `TVN-BKG-${Date.now().toString().slice(-6)}`,
        customerId: user._id,
        ashramId: ashram._id,
        roomId: ashram._id,
        checkInDate: new Date('2026-07-01'),
        checkOutDate: new Date('2026-07-05'),
        status: 'completed',
        pricing: { basePrice: 1200, totalAmount: 1200, amountPaid: 1200 },
        checkInCode: 'TVN123',
      });
    }

    if (user && ashram && booking) {
      const visitorArticles = [
        {
          visitorId: user._id,
          bookingId: booking._id,
          ashramId: ashram._id,
          ownerId: ashram.ownerId || user._id,
          title: 'काशी विश्वनाथ दर्शन एवं अस्सी घाट प्रभात आरती: एक सत्य यात्री का संस्मरण',
          slug: 'kashi-vishwanath-yatra-hindi-visitor-article',
          category: 'Experience',
          shortDescription: 'परमार्थ आश्रम में 3 दिन बिताने का अद्भुत अनुभव। प्रात:काल मां गंगा के दर्शन और मंदिर दर्शन की पावन अनुभूतियां।',
          content: `
काशी की पवित्र धरती पर तीन दिन का प्रवास मेरे जीवन का सबसे अद्भुत और कल्याणकारी अनुभव रहा। आश्रम का शांत वातावरण और प्रात:काल मंदिर से गूंजती शंखध्वनि मन को असीम शांति प्रदान करती है।

### आश्रम प्रवास और दैनिक अनुभव
आश्रम के कमरों की स्वच्छता और कर्मचारियों का सहयोगात्मक व्यवहार प्रशंसनीय है। प्रतिदिन प्रातःकाल गंगा तट पर ध्यान साधना और तत्पश्चात भगवान विश्वनाथ के सुगम दर्शन ने इस यात्रा को अविस्मरणीय बना दिया।

### सात्विक भोजनालय
आश्रम के भोजनालय में मिलने वाला शुद्ध देशी घी से निर्मित भोजन सात्विक और सुपाच्य है। सभी यात्रियों को एक साथ बैठकर भोजन ग्रहण करते देखना भारतीय संस्कृति की महानता को दर्शाता है।
          `.trim(),
          featuredImage: copiedUrls.hindi,
          galleryImages: [copiedUrls.hindi, copiedUrls.ganga],
          tags: ['काशी यात्रा', 'आश्रम अनुभव', 'सत्यात्री संस्मरण', 'गंगा दर्शन'],
          language: 'Hindi',
          status: 'approved',
          isVerifiedStay: true,
          visitDate: new Date('2026-07-01'),
          visitMonth: 'July 2026',
          publishedAt: new Date(),
          viewsCount: 1850,
          likesCount: 230,
        },
        {
          visitorId: user._id,
          bookingId: booking._id,
          ashramId: ashram._id,
          ownerId: ashram.ownerId || user._id,
          title: 'My Peaceful 5-Day Stay at Parmarth Niketan Ashram in Rishikesh',
          slug: 'my-peaceful-stay-at-parmarth-niketan-rishikesh',
          category: 'Experience',
          shortDescription: 'An authentic pilgrim experience detailing daily Ganga Aarti, yoga hall meditation, and satvik bhojnalaya meals.',
          content: `
Staying at Parmarth Niketan Ashram in Rishikesh was the most rejuvenating 5 days I have experienced. Nestled under the Himalayan mountains right along the banks of Ganga, the environment radiates calm and spiritual vibrations.

### Highlights of the Stay
- **Morning Meditation**: Waking up at 5:00 AM to gentle chanting and meditating on the wooden deck facing the holy river.
- **Satvik Food**: Freshly prepared hot meals served with extreme reverence in the main dining hall.
- **Evening Aarti**: Joining hundreds of yatris for the sunset Ganga Aarti led by ashram rishikumars.
          `.trim(),
          featuredImage: copiedUrls.rishikesh,
          galleryImages: [copiedUrls.rishikesh, copiedUrls.prasad],
          tags: ['Rishikesh Ashram', 'Ganga Aarti', 'Verified Stay', 'Pilgrim Story'],
          language: 'English',
          status: 'approved',
          isVerifiedStay: true,
          visitDate: new Date('2026-07-01'),
          visitMonth: 'July 2026',
          publishedAt: new Date(),
          viewsCount: 2420,
          likesCount: 310,
        },
      ];

      await VisitorArticle.insertMany(visitorArticles);
      console.log('Successfully inserted verified visitor articles (English & Hindi).');
    }

    console.log('\nAll Indian demo blogs & Hindi articles seeded successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding demo blogs:', error);
    process.exit(1);
  }
};

seedBlogs();
