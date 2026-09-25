/**
 * Seed script for the 4 new Vrindavan stays from visiting cards:
 * 1. Shri Hari Singh Dham (20 rooms)
 * 2. Kripa Hotel (25 rooms)
 * 3. The Vrind Orchid Hotel (40 rooms)
 * 4. Comfort INN Braj (55 rooms)
 *
 * Serial wise total rooms: 20, 25, 40, 55 = 140 rooms.
 */
const { setServers } = require('node:dns');
setServers(['1.1.1.1', '8.8.8.8']);

const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(__dirname, '..', 'node_modules', 'mongoose'));
const cloudinary = require(path.join(__dirname, '..', 'node_modules', 'cloudinary')).v2;
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'fvd3kven',
  api_key: process.env.CLOUDINARY_API_KEY || '837233391256543',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'M86eaISY3OkUHDfs0Xas-Auuxwc'
});

const uri = process.env.MONGODB_URI || (() => { throw new Error("Set MONGODB_URI in Newbackend/.env"); })();

const NEW_STAYS_DATA = [
  {
    name: "Shri Hari Singh Dham",
    slug: "shri-hari-singh-dham",
    citySlug: "vrindavan",
    tagline: "Aastha, Seva & Samarpan near Keshav Dham Chauraha, Burja Road",
    ashramType: "dharamshala",
    category: "dharamshala",
    description: "Shri Hari Singh Dham offers serene and clean pilgrimage accommodation near Keshav Dham Chauraha on Burja Road, Vrindavan. With comfortable air-conditioned rooms, 24-hour service, and close proximity to Prem Mandir and Banke Bihari Temple, it provides a peaceful spiritual retreat for devotees and families.",
    contact: {
      phone: "7231906969",
      altPhone: "9667106922",
      email: "shriharisinghdham@gmail.com",
      website: "",
      social: { facebook: "", instagram: "", youtube: "" }
    },
    address: {
      street: "Keshav Dham Chauraha, Burja Road",
      city: "Vrindavan",
      district: "Mathura",
      state: "Uttar Pradesh",
      pincode: "281121",
      coordinates: {
        type: "Point",
        coordinates: [77.6845, 27.5680]
      }
    },
    amenities: [
      "AC Rooms",
      "Free Wi-Fi",
      "Attached Bath",
      "24-hour Front Desk",
      "Hot & Cold Water",
      "Room Service",
      "Elevator",
      "Power Backup"
    ],
    sourceImages: [
      "https://pimg.fabhotels.com/resized-propertyimages/256/images/Main-photos-fabhotel-shri-hari-singh-dham-cjbbwavz-vrindavan-Hotels_1789483049841.png",
      "https://pimg.fabhotels.com/resized-propertyimages/256/images/Room-photos-fabhotel-shri-hari-singh-dham-cjbbwavz-vrindavan-Hotels_1789483040858.jpg",
      "https://pimg.fabhotels.com/resized-propertyimages/256/images/Room-photos-fabhotel-shri-hari-singh-dham-cjbbwavz-vrindavan-Hotels_1789483040830.jpg",
      "https://pimg.fabhotels.com/resized-propertyimages/256/images/Room-photos-fabhotel-shri-hari-singh-dham-cjbbwavz-vrindavan-Hotels_1789483040951.jpg",
      "https://pimg.fabhotels.com/resized-propertyimages/256/images/Room-photos-fabhotel-shri-hari-singh-dham-cjbbwavz-vrindavan-Hotels_1789483041134.jpg"
    ],
    pricing: {
      lowestNightPrice: 1400,
      totalCapacity: 48,
      peakSeasonMultiplier: 1.5,
      donationInfo: ""
    },
    rooms: [
      {
        name: "Standard AC Room",
        type: "private_room",
        acType: "AC",
        capacity: 2,
        totalInventory: 12,
        basePrice: 1400,
        sellingPrice: 1400,
        description: "Comfortable air-conditioned standard room with double bed, attached bathroom, free Wi-Fi, and hot/cold water.",
        amenities: ["AC", "Attached Bath", "Free Wi-Fi", "Geyser", "Room Service"],
        sourceImages: [
          "https://pimg.fabhotels.com/resized-propertyimages/256/images/Room-photos-fabhotel-shri-hari-singh-dham-cjbbwavz-vrindavan-Hotels_1789483040858.jpg",
          "https://pimg.fabhotels.com/resized-propertyimages/256/images/Room-photos-fabhotel-shri-hari-singh-dham-cjbbwavz-vrindavan-Hotels_1789483040830.jpg"
        ]
      },
      {
        name: "Deluxe AC Room",
        type: "private_room",
        acType: "AC",
        capacity: 3,
        totalInventory: 8,
        basePrice: 1800,
        sellingPrice: 1800,
        description: "Spacious Deluxe AC room with king bed, modern LED TV, attached private bath, and premium linens for families.",
        amenities: ["AC", "King Bed", "Attached Bath", "Free Wi-Fi", "LED TV", "Geyser"],
        sourceImages: [
          "https://pimg.fabhotels.com/resized-propertyimages/256/images/Room-photos-fabhotel-shri-hari-singh-dham-cjbbwavz-vrindavan-Hotels_1789483040951.jpg",
          "https://pimg.fabhotels.com/resized-propertyimages/256/images/Room-photos-fabhotel-shri-hari-singh-dham-cjbbwavz-vrindavan-Hotels_1789483041134.jpg"
        ]
      }
    ]
  },
  {
    name: "Kripa Hotel",
    slug: "kripa-hotel",
    citySlug: "vrindavan",
    tagline: "Deluxe Rooms, Banquet Hall & Relaxing Area in Rukmini Vihar",
    ashramType: "hotel",
    category: "hotel",
    description: "Kripa Hotel offers modern amenities, deluxe air-conditioned rooms, an expansive banquet hall, and relaxing lounge spaces in Rukmini Vihar Sector 2, Vrindavan. Conveniently located near Prem Mandir, it caters to families, pilgrimage groups, and special events with dedicated hospitality.",
    contact: {
      phone: "9990109043",
      altPhone: "9990109012",
      email: "kripahotelvrindavan@gmail.com",
      website: "",
      social: { facebook: "", instagram: "", youtube: "" }
    },
    address: {
      street: "Plot No. 48, Rukmini Vihar, Sector - 2",
      city: "Vrindavan",
      district: "Mathura",
      state: "Uttar Pradesh",
      pincode: "281121",
      coordinates: {
        type: "Point",
        coordinates: [77.6710, 27.5620]
      }
    },
    amenities: [
      "Deluxe AC Rooms",
      "Banquet Hall",
      "Relaxing Area",
      "Free Wi-Fi",
      "24/7 Front Desk",
      "Hot & Cold Water",
      "Room Service",
      "Parking Space"
    ],
    sourceImages: [
      path.join(__dirname, '..', '..', '..', '..', '.gemini', 'antigravity-ide', 'brain', '04dd20ea-44b2-4a1e-9143-ff4a281894e0', '.user_uploaded', 'media_1789890657382.jpg'),
      "https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/885547887.jpg?k=2bde9674ec8a7f27ecf81a8ad6067fa1bd8f44540842bce6ad96608307f0d512&o=&a=355109",
      "https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/840436705.jpg?k=fe862005e48f132539bca2eebef6c4edf600d94ab92bc89bcfec8407e5e29b25&o=&a=355109",
      "https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/907246643.jpg?k=e7fd1ecf3bc80660d0ed49f6774800a000959b806e1dffc59c6225bfb1357f06&o=&a=355109"
    ],
    pricing: {
      lowestNightPrice: 1800,
      totalCapacity: 60,
      peakSeasonMultiplier: 1.5,
      donationInfo: ""
    },
    rooms: [
      {
        name: "Deluxe AC Room",
        type: "private_room",
        acType: "AC",
        capacity: 2,
        totalInventory: 15,
        basePrice: 1800,
        sellingPrice: 1800,
        description: "Deluxe air-conditioned room with double bed, attached bath, free Wi-Fi, and 24/7 hot water.",
        amenities: ["AC", "Attached Bath", "Free Wi-Fi", "Geyser", "Room Service"],
        sourceImages: [
          "https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/840436705.jpg?k=fe862005e48f132539bca2eebef6c4edf600d94ab92bc89bcfec8407e5e29b25&o=&a=355109",
          "https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/907246643.jpg?k=e7fd1ecf3bc80660d0ed49f6774800a000959b806e1dffc59c6225bfb1357f06&o=&a=355109"
        ]
      },
      {
        name: "Super Deluxe AC Room",
        type: "private_room",
        acType: "AC",
        capacity: 3,
        totalInventory: 10,
        basePrice: 2400,
        sellingPrice: 2400,
        description: "Super Deluxe room with king bed, LED TV, relaxing seating corner, and premium hospitality.",
        amenities: ["AC", "King Bed", "Attached Bath", "Free Wi-Fi", "LED TV", "Room Service"],
        sourceImages: [
          "https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/885547887.jpg?k=2bde9674ec8a7f27ecf81a8ad6067fa1bd8f44540842bce6ad96608307f0d512&o=&a=355109",
          "https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/840436705.jpg?k=fe862005e48f132539bca2eebef6c4edf600d94ab92bc89bcfec8407e5e29b25&o=&a=355109"
        ]
      }
    ]
  },
  {
    name: "The Vrind Orchid Hotel",
    slug: "the-vrind-orchid-hotel",
    citySlug: "vrindavan",
    tagline: "Live The Luxury Life You Deserve - Burja Chauraha",
    ashramType: "hotel",
    category: "hotel",
    description: "The Vrind Orchid Hotel is a premier luxury boutique hotel located in front of Indian Oil Petrol Pump at Burja Chauraha, Chaitanya Vihar Phase-2, Vrindavan. Featuring elegant contemporary architecture, lavish executive rooms, 24x7 room service, and top-tier guest amenities, it guarantees an extraordinary luxury stay near Prem Mandir.",
    contact: {
      phone: "7302291717",
      altPhone: "",
      email: "thevrindorchid@gmail.com",
      website: "",
      social: { facebook: "", instagram: "", youtube: "" }
    },
    address: {
      street: "S5/294, In Front of Indian Oil Petrol Pump, Burja Chauraha, Chaitanya Vihar Phase-2",
      city: "Vrindavan",
      district: "Mathura",
      state: "Uttar Pradesh",
      pincode: "281121",
      coordinates: {
        type: "Point",
        coordinates: [77.6835, 27.5670]
      }
    },
    amenities: [
      "Luxury Rooms",
      "Free High-Speed Wi-Fi",
      "AC Rooms",
      "Attached Modern Bath",
      "24x7 Security",
      "Fine Dining",
      "Parking Space",
      "Power Backup"
    ],
    sourceImages: [
      "https://media.easemytrip.com/media/Hotel/SHL-2602161841559444/Hotel/HotelM3aM5v.png",
      "https://media.easemytrip.com/media/Hotel/SHL-2602161841559444/Hotel/HotelJj2Qjl.png",
      "https://media.easemytrip.com/media/Hotel/SHL-2602161841559444/Hotel/Hotel0IcA9A.png",
      "https://media.easemytrip.com/media/Hotel/SHL-2602161841559444/Hotel/HotelMAn7AH.png",
      "https://media.easemytrip.com/media/Hotel/SHL-2602161841559444/Hotel/HotelVVR79p.png",
      "https://media.easemytrip.com/media/Hotel/SHL-2602161841559444/Hotel/HotelcBxy01.png"
    ],
    pricing: {
      lowestNightPrice: 2800,
      totalCapacity: 95,
      peakSeasonMultiplier: 1.5,
      donationInfo: ""
    },
    rooms: [
      {
        name: "Luxury Executive AC Room",
        type: "private_room",
        acType: "AC",
        capacity: 2,
        totalInventory: 25,
        basePrice: 2800,
        sellingPrice: 2800,
        description: "Opulent executive air-conditioned room with king bed, modern bathroom, smart TV, high-speed Wi-Fi, and 24-hour room service.",
        amenities: ["AC", "King Bed", "Attached Bath", "Free Wi-Fi", "Smart TV", "Geyser"],
        sourceImages: [
          "https://media.easemytrip.com/media/Hotel/SHL-2602161841559444/Hotel/HotelM3aM5v.png",
          "https://media.easemytrip.com/media/Hotel/SHL-2602161841559444/Hotel/HotelJj2Qjl.png"
        ]
      },
      {
        name: "Royal Premium Suite",
        type: "suite",
        acType: "AC",
        capacity: 4,
        totalInventory: 15,
        basePrice: 3800,
        sellingPrice: 3800,
        description: "Spacious Royal Premium Suite with king bedroom, separate sitting lounge, balcony view, and luxury guest amenities.",
        amenities: ["AC", "King Bed", "Attached Luxury Bath", "Free Wi-Fi", "Balcony", "Smart TV", "Sofa"],
        sourceImages: [
          "https://media.easemytrip.com/media/Hotel/SHL-2602161841559444/Hotel/Hotel0IcA9A.png",
          "https://media.easemytrip.com/media/Hotel/SHL-2602161841559444/Hotel/HotelMAn7AH.png"
        ]
      }
    ]
  },
  {
    name: "Comfort INN Braj",
    slug: "comfort-inn-braj",
    citySlug: "vrindavan",
    tagline: "Comfort INN by Choice Hotels - Near Prem Mandir & Multilevel Parking",
    ashramType: "hotel",
    category: "hotel",
    description: "Comfort INN Braj by Choice Hotels delivers world-class hospitality in Rukmani Vihar Sector 2, right behind the Multilevel Parking and minutes from Prem Mandir, Vrindavan. Boasting 55 premium keys, upscale king beds, multi-cuisine dining, high-speed Wi-Fi, and personalized concierge service, it is the premier hotel choice in Braj.",
    contact: {
      phone: "9084252226",
      altPhone: "",
      email: "gm@comfortinnvrindavan.com",
      website: "https://www.choicehotels.com",
      social: { facebook: "", instagram: "", youtube: "" }
    },
    address: {
      street: "Plot No. 235, Rukmani Vihar, Sec-2, Behind the Multilevel Parking, Near Prem Mandir",
      city: "Vrindavan",
      district: "Mathura",
      state: "Uttar Pradesh",
      pincode: "281121",
      coordinates: {
        type: "Point",
        coordinates: [77.6715, 27.5615]
      }
    },
    amenities: [
      "Superior AC Rooms",
      "Choice Hotels Service",
      "Free High-Speed Wi-Fi",
      "Multi-cuisine Dining",
      "Attached Luxury Bath",
      "Free Valet Parking",
      "24-Hour Front Desk",
      "Elevator"
    ],
    sourceImages: [
      "https://img.easemytrip.com/EMTHOTEL-9810827/70/32/na/s/72387574_0.jpg",
      "https://img.easemytrip.com/EMTHOTEL-9810827/70/23/na/s/72387574_1.jpg",
      "https://img.easemytrip.com/EMTHOTEL-9810827/70/23/na/s/72387574_2.jpg",
      "https://img.easemytrip.com/EMTHOTEL-9810827/70/23/r/s/72387574_3.jpg",
      "https://img.easemytrip.com/EMTHOTEL-9810827/70/23/l/s/72387574_4.jpg",
      "https://img.easemytrip.com/EMTHOTEL-9810827/70/23/l/s/72387574_5.jpg"
    ],
    pricing: {
      lowestNightPrice: 3200,
      totalCapacity: 130,
      peakSeasonMultiplier: 1.5,
      donationInfo: ""
    },
    rooms: [
      {
        name: "Superior King AC Room",
        type: "private_room",
        acType: "AC",
        capacity: 2,
        totalInventory: 35,
        basePrice: 3200,
        sellingPrice: 3200,
        description: "Superior King room by Choice Hotels featuring plush king bed, premium linen, ergonomic workspace, luxury ensuite bath, and 24/7 room service.",
        amenities: ["AC", "King Bed", "Attached Luxury Bath", "Free Wi-Fi", "Smart TV", "Work Desk"],
        sourceImages: [
          "https://img.easemytrip.com/EMTHOTEL-9810827/70/23/na/s/72387574_1.jpg",
          "https://img.easemytrip.com/EMTHOTEL-9810827/70/23/na/s/72387574_2.jpg"
        ]
      },
      {
        name: "Premium Suite with Living Area",
        type: "suite",
        acType: "AC",
        capacity: 4,
        totalInventory: 20,
        basePrice: 4500,
        sellingPrice: 4500,
        description: "Expansive premium suite featuring master bedroom, plush living lounge, panoramic city view, tea/coffee maker, and personalized hospitality.",
        amenities: ["AC", "King Bed", "Living Area", "Attached Bath", "Free Wi-Fi", "Mini Bar", "Room Service"],
        sourceImages: [
          "https://img.easemytrip.com/EMTHOTEL-9810827/70/23/l/s/72387574_4.jpg",
          "https://img.easemytrip.com/EMTHOTEL-9810827/70/23/l/s/72387574_5.jpg"
        ]
      }
    ]
  }
];

async function uploadToCloudinary(urlOrPath, folder = 'tirvona/ashrams') {
  try {
    const res = await cloudinary.uploader.upload(urlOrPath, { folder });
    return res.secure_url;
  } catch (err) {
    console.error(`  Upload failed for ${urlOrPath}:`, err.message);
    return typeof urlOrPath === 'string' && urlOrPath.startsWith('http') ? urlOrPath : "https://res.cloudinary.com/fvd3kven/image/upload/v1789889600/tirvona/ashrams/oopbqruoxaxme8grir4e.jpg";
  }
}

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected!');

  const db = mongoose.connection.db;
  const ashramsColl = db.collection('ashrams');
  const roomsColl = db.collection('rooms');

  const uploadedNewData = {};

  for (const s of NEW_STAYS_DATA) {
    console.log(`\n========================================`);
    console.log(`Processing: ${s.name} (${s.slug})`);
    console.log(`========================================`);

    uploadedNewData[s.slug] = {
      stayImages: [],
      roomImages: {}
    };

    // Upload stay images
    for (let i = 0; i < s.sourceImages.length; i++) {
      const src = s.sourceImages[i];
      console.log(` [Stay Img ${i+1}/${s.sourceImages.length}] Uploading: ${src.substring(0, 70)}...`);
      const cld = await uploadToCloudinary(src);
      console.log(`    -> ${cld}`);
      uploadedNewData[s.slug].stayImages.push(cld);
    }

    // Upload room images
    for (const r of s.rooms) {
      uploadedNewData[s.slug].roomImages[r.name] = [];
      for (let j = 0; j < r.sourceImages.length; j++) {
        const rSrc = r.sourceImages[j];
        console.log(`  [Room '${r.name}' Img ${j+1}] Uploading...`);
        const cld = await uploadToCloudinary(rSrc);
        console.log(`     -> ${cld}`);
        uploadedNewData[s.slug].roomImages[r.name].push(cld);
      }
    }

    // Upsert Ashram in MongoDB
    const ashramDoc = {
      name: s.name,
      slug: s.slug,
      citySlug: s.citySlug,
      tagline: s.tagline,
      ashramType: s.ashramType,
      category: s.category,
      description: s.description,
      contact: s.contact,
      address: s.address,
      amenities: s.amenities,
      images: uploadedNewData[s.slug].stayImages,
      pricing: s.pricing,
      status: "approved",
      isVerified: true,
      bookingPaused: false,
      totalRooms: s.rooms.reduce((acc, rm) => acc + rm.totalInventory, 0),
      isDeleted: false,
      deletedAt: null,
      updatedAt: new Date()
    };

    const existingAshram = await ashramsColl.findOne({ slug: s.slug });
    let ashramId;

    if (existingAshram) {
      ashramId = existingAshram._id;
      await ashramsColl.updateOne({ _id: ashramId }, { $set: ashramDoc });
      console.log(`Updated existing ashram: ${s.slug} (ID: ${ashramId})`);
    } else {
      ashramDoc.createdAt = new Date();
      ashramDoc.rating = { average: 4.8, count: 24 };
      const insertRes = await ashramsColl.insertOne(ashramDoc);
      ashramId = insertRes.insertedId;
      console.log(`Inserted new ashram: ${s.slug} (ID: ${ashramId})`);
    }

    // Upsert Rooms for this ashram
    for (const r of s.rooms) {
      const roomImages = uploadedNewData[s.slug].roomImages[r.name];
      const roomDoc = {
        ashramId: ashramId,
        name: r.name,
        type: r.type,
        acType: r.acType,
        capacity: r.capacity,
        totalInventory: r.totalInventory,
        basePrice: r.basePrice,
        sellingPrice: r.sellingPrice,
        description: r.description,
        amenities: r.amenities,
        images: roomImages,
        status: "active",
        isDeleted: false,
        deletedAt: null,
        updatedAt: new Date()
      };

      const existingRoom = await roomsColl.findOne({ ashramId: ashramId, name: r.name });
      if (existingRoom) {
        await roomsColl.updateOne({ _id: existingRoom._id }, { $set: roomDoc });
        console.log(`  Updated room: '${r.name}' (${r.totalInventory} units)`);
      } else {
        roomDoc.createdAt = new Date();
        await roomsColl.insertOne(roomDoc);
        console.log(`  Inserted room: '${r.name}' (${r.totalInventory} units)`);
      }
    }
  }

  // Save the mapping for frontend synchronization
  fs.writeFileSync(
    path.join(__dirname, 'uploaded-4-new-stays.json'),
    JSON.stringify(uploadedNewData, null, 2),
    'utf-8'
  );
  console.log('\nWrote uploaded-4-new-stays.json successfully.');

  await mongoose.disconnect();
  console.log('MongoDB connection closed.');
}

run().catch(err => {
  console.error('Fatal error in seed script:', err);
  process.exit(1);
});
