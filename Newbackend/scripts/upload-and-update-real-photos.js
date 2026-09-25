/**
 * Upload real verified Google / travel-portal photos of the 5 Vrindavan stays
 * to Cloudinary and update MongoDB ashrams + rooms, and frontend static datasets.
 */
const { setServers } = require('node:dns');
setServers(['1.1.1.1', '8.8.8.8']);

const path = require('path');
const mongoose = require(path.join(__dirname, '..', 'node_modules', 'mongoose'));
const cloudinary = require(path.join(__dirname, '..', 'node_modules', 'cloudinary')).v2;
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'fvd3kven',
  api_key: process.env.CLOUDINARY_API_KEY || '837233391256543',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'M86eaISY3OkUHDfs0Xas-Auuxwc'
});

const uri = process.env.MONGODB_URI || (() => { throw new Error("Set MONGODB_URI in Newbackend/.env"); })();

// Real image sources for each property
const REAL_SOURCES = {
  'hotel-sharda-palace': {
    stayImages: [
      'https://www.hotelshardapalace.in/assets/images/gallery/1.jpg',
      'https://www.hotelshardapalace.in/assets/images/gallery/2.jpg',
      'https://www.hotelshardapalace.in/assets/images/gallery/4.jpg',
      'https://www.hotelshardapalace.in/assets/images/gallery/5.jpg',
      'https://www.hotelshardapalace.in/assets/images/gallery/6.jpg',
      'https://www.hotelshardapalace.in/assets/images/gallery/8.jpg'
    ],
    roomImages: {
      'deluxe': [
        'https://www.hotelshardapalace.in/assets/images/gallery/1.jpg',
        'https://www.hotelshardapalace.in/assets/images/gallery/3.jpg'
      ],
      'super-deluxe': [
        'https://www.hotelshardapalace.in/assets/images/gallery/4.jpg',
        'https://www.hotelshardapalace.in/assets/images/gallery/7.jpg'
      ]
    }
  },
  'girraj-stay-inn': {
    stayImages: [
      'https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/885547887.jpg?k=2bde9674ec8a7f27ecf81a8ad6067fa1bd8f44540842bce6ad96608307f0d512&o=&a=355109',
      'https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/840436705.jpg?k=fe862005e48f132539bca2eebef6c4edf600d94ab92bc89bcfec8407e5e29b25&o=&a=355109',
      'https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/907246643.jpg?k=e7fd1ecf3bc80660d0ed49f6774800a000959b806e1dffc59c6225bfb1357f06&o=&a=355109',
      'https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/798514635.jpg?k=b9f919499dfe92a85b27576a3e35afe779080fd74285da8e0b9f7054cd9d5e4c&o=&a=355109',
      'https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/880777811.jpg?k=f9ee41bec6a2132d825cff1c43ba75a853bc903bb2cb8b99ac16a2970d8d2085&o=&a=355109',
      'https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/681041170.jpg?k=c086579dcd9627e875719850fb304b9ce7384111ec91b60bdea196815d7db86a&o=&a=355109'
    ],
    roomImages: {
      'luxury': [
        'https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/840436705.jpg?k=fe862005e48f132539bca2eebef6c4edf600d94ab92bc89bcfec8407e5e29b25&o=&a=355109',
        'https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/907246643.jpg?k=e7fd1ecf3bc80660d0ed49f6774800a000959b806e1dffc59c6225bfb1357f06&o=&a=355109'
      ],
      'deluxe': [
        'https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/798514635.jpg?k=b9f919499dfe92a85b27576a3e35afe779080fd74285da8e0b9f7054cd9d5e4c&o=&a=355109',
        'https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/880777811.jpg?k=f9ee41bec6a2132d825cff1c43ba75a853bc903bb2cb8b99ac16a2970d8d2085&o=&a=355109'
      ]
    }
  },
  'radha-palace': {
    stayImages: [
      'https://img.easemytrip.com/EMTHotel-10822093/70/32/l/s/72459414_0.jpg',
      'https://img.easemytrip.com/EMTHotel-10822093/70/32/l/s/72459414_1.jpg',
      'https://img.easemytrip.com/EMTHotel-10822093/70/32/l/s/72459414_2.jpg',
      'https://img.easemytrip.com/EMTHotel-10822093/70/32/l/s/72459414_3.jpg',
      'https://img.easemytrip.com/EMTHotel-10822093/70/32/l/s/72459414_4.jpg',
      'https://img.easemytrip.com/EMTHotel-10822093/70/32/l/s/72459414_5.jpg'
    ],
    roomImages: {
      'luxury': [
        'https://img.easemytrip.com/EMTHotel-10822093/70/32/l/s/72459414_1.jpg',
        'https://img.easemytrip.com/EMTHotel-10822093/70/32/l/s/72459414_2.jpg'
      ],
      'family': [
        'https://img.easemytrip.com/EMTHotel-10822093/70/32/l/s/72459414_3.jpg',
        'https://img.easemytrip.com/EMTHotel-10822093/70/32/l/s/72459414_4.jpg'
      ]
    }
  },
  'shri-prakash-dham': {
    stayImages: [
      'https://img.easemytrip.com/EMTHOTEL-9797546/70/32/l/s/64994325_0.jpg',
      'https://img.easemytrip.com/EMTHOTEL-9797546/70/32/l/s/64994325_1.jpg',
      'https://img.easemytrip.com/EMTHOTEL-9797546/70/32/l/s/64994325_2.jpg',
      'https://img.easemytrip.com/EMTHOTEL-9797546/70/32/i/s/64994325_3.jpg',
      'https://img.easemytrip.com/EMTHOTEL-9797546/70/32/i/s/64994325_4.jpg',
      'https://img.easemytrip.com/EMTHOTEL-9797546/70/32/i/s/64994325_5.jpg'
    ],
    roomImages: {
      'double': [
        'https://img.easemytrip.com/EMTHOTEL-9797546/70/32/l/s/64994325_1.jpg',
        'https://img.easemytrip.com/EMTHOTEL-9797546/70/32/l/s/64994325_2.jpg'
      ],
      'single': [
        'https://img.easemytrip.com/EMTHOTEL-9797546/70/32/i/s/64994325_4.jpg',
        'https://img.easemytrip.com/EMTHOTEL-9797546/70/32/i/s/64994325_5.jpg'
      ]
    }
  },
  'satya-nikunj-inn': {
    stayImages: [
      'https://img.easemytrip.com/EMTHOTEL-9316032/70/8/na/l/71601370_0.jpg',
      'https://img.easemytrip.com/EMTHOTEL-9316032/70/8/na/l/71601370_70.jpg',
      'https://img.easemytrip.com/EMTHOTEL-9316032/70/8/na/l/71601370_71.jpg',
      'https://img.easemytrip.com/EMTHOTEL-9316032/70/8/na/l/71601370_72.jpg',
      'https://img.easemytrip.com/EMTHOTEL-9316032/70/8/na/l/71601370_73.jpg',
      'https://img.easemytrip.com/EMTHOTEL-9316032/70/23/br/l/71601370_98.jpg'
    ],
    roomImages: {
      'deluxe': [
        'https://img.easemytrip.com/EMTHOTEL-9316032/70/8/na/l/71601370_70.jpg',
        'https://img.easemytrip.com/EMTHOTEL-9316032/70/8/na/l/71601370_71.jpg'
      ],
      'executive': [
        'https://img.easemytrip.com/EMTHOTEL-9316032/70/8/na/l/71601370_72.jpg',
        'https://img.easemytrip.com/EMTHOTEL-9316032/70/8/na/l/71601370_73.jpg'
      ]
    }
  }
};

async function uploadToCloudinary(url, folder = 'tirvona/ashrams') {
  try {
    const res = await cloudinary.uploader.upload(url, { folder });
    return res.secure_url;
  } catch (err) {
    console.error(`  Upload failed for ${url}:`, err.message);
    // If upload fails, return the original URL as fallback
    return url;
  }
}

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected!');

  const db = mongoose.connection.db;
  const ashramsColl = db.collection('ashrams');
  const roomsColl = db.collection('rooms');

  const uploadedData = {};

  for (const [slug, data] of Object.entries(REAL_SOURCES)) {
    console.log(`\n========================================`);
    console.log(`Uploading real photos for: ${slug}`);
    console.log(`========================================`);

    uploadedData[slug] = {
      stayImages: [],
      roomImages: {}
    };

    for (let i = 0; i < data.stayImages.length; i++) {
      const src = data.stayImages[i];
      console.log(` [${i+1}/${data.stayImages.length}] Uploading stay image: ${src.substring(0, 60)}...`);
      const cldUrl = await uploadToCloudinary(src);
      console.log(`    -> ${cldUrl}`);
      uploadedData[slug].stayImages.push(cldUrl);
    }

    for (const [roomKey, rImgs] of Object.entries(data.roomImages)) {
      uploadedData[slug].roomImages[roomKey] = [];
      for (let j = 0; j < rImgs.length; j++) {
        const src = rImgs[j];
        console.log(`   Uploading room [${roomKey}] image ${j+1}: ${src.substring(0, 60)}...`);
        const cldUrl = await uploadToCloudinary(src);
        console.log(`      -> ${cldUrl}`);
        uploadedData[slug].roomImages[roomKey].push(cldUrl);
      }
    }

    // Update MongoDB ashram
    const ashramRes = await ashramsColl.updateOne(
      { slug },
      { $set: { images: uploadedData[slug].stayImages, updatedAt: new Date() } }
    );
    console.log(`Updated ashram document for ${slug}: matched=${ashramRes.matchedCount}, modified=${ashramRes.modifiedCount}`);

    // Update MongoDB rooms for this ashram
    const ashramDoc = await ashramsColl.findOne({ slug });
    if (ashramDoc) {
      const rooms = await roomsColl.find({ ashramId: ashramDoc._id }).toArray();
      console.log(`Found ${rooms.length} rooms for ashram ${slug}`);
      for (const room of rooms) {
        let selectedRoomImgs = uploadedData[slug].stayImages.slice(0, 2);
        const nameLower = (room.name || '').toLowerCase();
        if (slug === 'hotel-sharda-palace') {
          if (nameLower.includes('super')) selectedRoomImgs = uploadedData[slug].roomImages['super-deluxe'];
          else selectedRoomImgs = uploadedData[slug].roomImages['deluxe'];
        } else if (slug === 'girraj-stay-inn') {
          if (nameLower.includes('luxury')) selectedRoomImgs = uploadedData[slug].roomImages['luxury'];
          else selectedRoomImgs = uploadedData[slug].roomImages['deluxe'];
        } else if (slug === 'radha-palace') {
          if (nameLower.includes('royal') || nameLower.includes('family')) selectedRoomImgs = uploadedData[slug].roomImages['family'];
          else selectedRoomImgs = uploadedData[slug].roomImages['luxury'];
        } else if (slug === 'shri-prakash-dham') {
          if (nameLower.includes('single') || nameLower.includes('non-ac')) selectedRoomImgs = uploadedData[slug].roomImages['single'];
          else selectedRoomImgs = uploadedData[slug].roomImages['double'];
        } else if (slug === 'satya-nikunj-inn') {
          if (nameLower.includes('executive')) selectedRoomImgs = uploadedData[slug].roomImages['executive'];
          else selectedRoomImgs = uploadedData[slug].roomImages['deluxe'];
        }

        await roomsColl.updateOne(
          { _id: room._id },
          { $set: { images: selectedRoomImgs, updatedAt: new Date() } }
        );
        console.log(`  Updated room '${room.name}' with ${selectedRoomImgs.length} images`);
      }
    }
  }

  // Save the mapping to a local json file for easy frontend update
  const fs = require('fs');
  fs.writeFileSync(
    path.join(__dirname, 'uploaded-stay-images.json'),
    JSON.stringify(uploadedData, null, 2),
    'utf-8'
  );
  console.log('\nWrote uploaded-stay-images.json successfully.');

  await mongoose.disconnect();
  console.log('Done!');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
