import mongoose from 'mongoose';
import config from '../config/env.js';
import ContentChangeRequest from '../models/ContentChangeRequest.js';

const run = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('Connected to MongoDB');

    // Delete test change requests for hero_banner & festival_banner so old image is restored
    const result = await ContentChangeRequest.deleteMany({
      section: { $in: ['hero_banner', 'festival_banner', 'slider'] },
    });

    console.log(`Reset ${result.deletedCount} test CMS change requests.`);
    process.exit(0);
  } catch (err) {
    console.error('Reset error:', err);
    process.exit(1);
  }
};

run();
