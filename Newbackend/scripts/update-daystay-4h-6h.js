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
    const productsCollection = db.collection('day_stay_products');
    const roomsCollection = db.collection('rooms');

    // 1. Remove deprecated products
    await productsCollection.deleteMany({ productCode: { $in: ["FRESHEN_UP", "DAY_REST_3H"] } });
    console.log('Removed deprecated FRESHEN_UP and DAY_REST_3H products');

    // 2. Upsert DAY_REST_4H and DAY_REST_6H in catalog
    const newProducts = [
      {
        productCode: "DAY_REST_4H",
        productType: "day_rest",
        displayName: "Day Rest (4 Hours)",
        durationMinutes: 240,
        sortOrder: 1,
        active: true,
        description: "Comfortable private AC room to relax, unpack, freshen up, and re-energize.",
        updatedAt: new Date(),
      },
      {
        productCode: "DAY_REST_6H",
        productType: "day_rest",
        displayName: "Day Rest (6 Hours)",
        durationMinutes: 360,
        sortOrder: 2,
        active: true,
        description: "Extended peace and comfort for elderly family members, yatris, and tired pilgrims.",
        updatedAt: new Date(),
      },
    ];

    for (const p of newProducts) {
      await productsCollection.updateOne(
        { productCode: p.productCode },
        { $set: p },
        { upsert: true }
      );
    }
    console.log('Upserted DAY_REST_4H and DAY_REST_6H catalog products');

    // 3. Update room configurations
    const rooms = await roomsCollection.find({ 'dayStayConfig.enabled': true }).toArray();
    for (const room of rooms) {
      let base4H = 699;
      let base6H = 1199;

      const roomName = (room.name || '').toLowerCase();
      if (roomName.includes('deluxe') || roomName.includes('ac double')) {
        base4H = 699;
        base6H = 899;
      } else if (roomName.includes('family') || roomName.includes('suite')) {
        base4H = 999;
        base6H = 1299;
      } else if (roomName.includes('standard') || roomName.includes('non-ac')) {
        base4H = 499;
        base6H = 699;
      } else if (roomName.includes('dorm') || roomName.includes('shared')) {
        base4H = 349;
        base6H = 499;
      }

      await roomsCollection.updateOne(
        { _id: room._id },
        {
          $set: {
            'dayStayConfig.enabled': true,
            'dayStayConfig.pricingByProduct': {
              DAY_REST_4H: base4H,
              DAY_REST_6H: base6H,
            },
            'dayStayConfig.products': [
              {
                productCode: "DAY_REST_4H",
                durationMinutes: 240,
                price: base4H,
                discountPrice: base4H,
                enabled: true,
              },
              {
                productCode: "DAY_REST_6H",
                durationMinutes: 360,
                price: base6H,
                discountPrice: base6H,
                enabled: true,
              },
            ],
          },
        }
      );
      console.log(`Updated room ${room.name} (${room._id}): 4H=₹${base4H}, 6H=₹${base6H}`);
    }

    console.log('Day Stay 4h/6h migration completed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
