const { setServers } = require('node:dns');
setServers(['1.1.1.1', '8.8.8.8']);

const path = require('path');
const mongoose = require(path.join(__dirname, '..', 'node_modules', 'mongoose'));
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const uri = process.env.MONGODB_URI || "mongodb+srv://nktechipl_db_user:6xb6D9ZbvZ9KkUzY@cluster0.0zchdel.mongodb.net/test?retryWrites=true&w=majority";

async function run() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const ashramsCollection = db.collection('ashrams');
    const roomsCollection = db.collection('rooms');

    // Update Vrindavan ashrams to enable Day Stay
    const ashramResult = await ashramsCollection.updateMany(
      { 'address.city': { $regex: /vrindavan|mathura/i } },
      {
        $set: {
          'dayStayConfig.enabled': true,
          'dayStayConfig.operatingHours': { open: '06:00', close: '20:00' },
          'dayStayConfig.defaultGraceMinutes': 15,
          'dayStayConfig.defaultHousekeepingBufferMinutes': 45,
          'dayStayConfig.isBlockedToday': false,
          'dayStayConfig.blackoutDates': []
        }
      }
    );
    console.log(`Updated ${ashramResult.modifiedCount} Vrindavan ashrams with DayStayConfig.`);

    // Update rooms belonging to Vrindavan ashrams
    const vrindavanAshrams = await ashramsCollection.find({ 'address.city': { $regex: /vrindavan|mathura/i } }).toArray();
    const ashramIds = vrindavanAshrams.map(a => a._id);

    const roomResult = await roomsCollection.updateMany(
      { ashramId: { $in: ashramIds } },
      {
        $set: {
          'dayStayConfig.enabled': true,
          'dayStayConfig.pricingByProduct': {
            FRESHEN_UP: 499,
            DAY_REST_3H: 899,
            DAY_REST_6H: 1499
          },
          'dayStayConfig.priceMultiplier': 1.0
        }
      }
    );
    console.log(`Updated ${roomResult.modifiedCount} rooms with DayStayConfig.`);

    console.log('Day Stay enablement complete!');
  } catch (err) {
    console.error('Error enabling Day Stay:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
