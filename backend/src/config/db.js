import mongoose from 'mongoose';
import dns from 'dns';
import config from './env.js';

// Fall back to Google & Cloudflare public DNS resolvers for reliable MongoDB SRV lookups
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // System DNS fallback
}

// Only query fields defined in the schema (avoids accidental full-object filters).
mongoose.set('strictQuery', true);

const connectDB = async (retries = 5, delay = 3000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(config.mongoUri, {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 20,      // reuse pooled connections under load instead of opening per request
        minPoolSize: 2,
        socketTimeoutMS: 45000,
      });
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      console.error(`Database Connection Attempt ${attempt}/${retries} Failed: ${error.message}`);
      if (attempt < retries) {
        console.log(`Retrying MongoDB connection in ${delay / 1000}s...`);
        await new Promise((res) => setTimeout(res, delay));
      } else {
        console.error('All MongoDB connection attempts exhausted. Keeping server alive for retries.');
      }
    }
  }
};

export default connectDB;
