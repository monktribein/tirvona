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

    // Find Prem Mandir Dharamshala
    let ashram = await ashramsCollection.findOne({
      $or: [
        { slug: 'prem-mandir-dharamshala' },
        { name: { $regex: /prem mandir/i } }
      ]
    });

    if (!ashram) {
      console.log('Prem Mandir Dharamshala not found');
      return;
    }

    await ashramsCollection.updateOne(
      { _id: ashram._id },
      {
        $set: {
          status: "approved",
          isVerified: true,
          'dayStayConfig.enabled': true,
          'dayStayConfig.operatingHours': { start: "06:00", end: "20:00", open: "06:00", close: "20:00" },
          'dayStayConfig.defaultGraceMinutes': 15,
          'dayStayConfig.defaultHousekeepingBufferMinutes': 45,
          'dayStayConfig.isBlockedToday': false,
          'dayStayConfig.blackoutDates': []
        }
      }
    );
    console.log(`Updated ashram ${ashram.name}`);

    // Update all rooms of Prem Mandir Dharamshala
    const rooms = await roomsCollection.find({ ashramId: ashram._id }).toArray();
    console.log(`Found ${rooms.length} rooms`);

    for (const room of rooms) {
      let fPrice = 499, d3Price = 899, d6Price = 1499;
      if (room.name.includes("Family")) {
        fPrice = 699; d3Price = 1299; d6Price = 1999;
      } else if (room.name.includes("Dormitory")) {
        fPrice = 299; d3Price = 499; d6Price = 799;
      } else if (room.name.includes("Standard")) {
        fPrice = 399; d3Price = 699; d6Price = 1199;
      }

      await roomsCollection.updateOne(
        { _id: room._id },
        {
          $set: {
            status: "active",
            'dayStayConfig.enabled': true,
            'dayStayConfig.allocatedInventory': room.count || room.totalInventory || 10,
            'dayStayConfig.priceMultiplier': 1.0,
            'dayStayConfig.pricingByProduct': {
              FRESHEN_UP: fPrice,
              DAY_REST_3H: d3Price,
              DAY_REST_6H: d6Price
            },
            'dayStayConfig.products': [
              {
                productCode: "FRESHEN_UP",
                durationMinutes: 90,
                price: fPrice,
                discountPrice: fPrice,
                enabled: true
              },
              {
                productCode: "DAY_REST_3H",
                durationMinutes: 180,
                price: d3Price,
                discountPrice: d3Price,
                enabled: true
              },
              {
                productCode: "DAY_REST_6H",
                durationMinutes: 360,
                price: d6Price,
                discountPrice: d6Price,
                enabled: true
              }
            ]
          }
        }
      );
      console.log(`Updated room: ${room.name} (${room._id}) with products!`);
    }

    console.log('All Prem Mandir rooms updated successfully!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
