import mongoose from 'mongoose';
import dns from 'dns';
import config from './env.js';

// Some machines have a misconfigured local DNS resolver (e.g. 127.0.0.1) that
// refuses SRV lookups, which breaks mongodb+srv:// connection strings with
// "querySrv ECONNREFUSED". Fall back to public resolvers that support SRV.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
