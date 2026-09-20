/**
 * Seed script for the 5 Vrindavan stays from visiting cards:
 * 1. Hotel Sharda Palace (14 rooms)
 * 2. Girraj Stay Inn (20 rooms)
 * 3. Radha Palace (10 rooms)
 * 4. Shri Prakash Dham (15 rooms)
 * 5. Satya Nikunj Inn (20 rooms)
 *
 * Serial wise total rooms: 14, 20, 10, 15, 20 = 79 rooms.
 */
const { setServers } = require('node:dns');
setServers(['1.1.1.1', '8.8.8.8']);

const path = require('path');
const mongoose = require(path.join(__dirname, '..', 'node_modules', 'mongoose'));
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const uri = "mongodb+srv://nktechipl_db_user:6xb6D9ZbvZ9KkUzY@cluster0.0zchdel.mongodb.net/test?retryWrites=true&w=majority";

const STAYS_SEED_DATA = [
  {
    name: "Hotel Sharda Palace",
    slug: "hotel-sharda-palace",
    citySlug: "vrindavan",
    tagline: "Comfortable hospitality near Sabji Mandi, Akrur Road",
    ashramType: "hotel",
    category: "hotel",
    description: "Hotel Sharda Palace offers warm hospitality, comfortable air-conditioned rooms, and dedicated service in Vrindavan. Conveniently located near Sabji Mandi on Akrur Road, it provides easy access to Prem Mandir and Banke Bihari Temple for pilgrims and families.",
    contact: {
      phone: "7505863439",
      altPhone: "9528624322",
      email: "sharda@gmail.com",
      website: "",
      social: { facebook: "", instagram: "", youtube: "" }
    },
    address: {
      street: "Near Sabji Mandi, Akrur Road",
      city: "Vrindavan",
      district: "Mathura",
      state: "Uttar Pradesh",
      pincode: "281121",
      coordinates: {
        type: "Point",
        coordinates: [77.6890, 27.5685]
      }
    },
    amenities: [
      "AC Rooms",
      "Free Wi-Fi",
      "Attached Bath",
      "Hot & Cold Water",
      "Room Service",
      "Parking Space",
      "Power Backup",
      "24-hour Front Desk"
    ],
    images: [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80&auto=format&fit=crop",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789815086/tirvona/ashrams/lolnlnpwqmij3gnwvtzj.webp"
    ],
    pricing: {
      lowestNightPrice: 2200,
      totalCapacity: 28,
      peakSeasonMultiplier: 1.5,
      donationInfo: ""
    },
    rooms: [
      {
        name: "Deluxe AC Room",
        type: "private_room",
        acType: "AC",
        capacity: 2,
        totalInventory: 10,
        basePrice: 2200,
        sellingPrice: 2200,
        description: "Well-appointed Deluxe AC room with double bed, attached private bathroom, free Wi-Fi, and 24/7 hot/cold water.",
        amenities: ["AC", "Attached Bath", "Free Wi-Fi", "Geyser", "Room Service"],
        images: [
          "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&q=80&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80&auto=format&fit=crop"
        ]
      },
      {
        name: "Super Deluxe AC Room",
        type: "private_room",
        acType: "AC",
        capacity: 2,
        totalInventory: 4,
        basePrice: 2800,
        sellingPrice: 2800,
        description: "Spacious Super Deluxe AC room with king bed, modern interiors, premium linens, and comfortable seating.",
        amenities: ["AC", "King Bed", "Attached Bath", "Free Wi-Fi", "LED TV", "Geyser"],
        images: [
          "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80&auto=format&fit=crop"
        ]
      }
    ]
  },
  {
    name: "Girraj Stay Inn",
    slug: "girraj-stay-inn",
    citySlug: "vrindavan",
    tagline: "Luxury Rooms in Kailash Nagar Road with 24x7 Security & Wi-Fi",
    ashramType: "hotel",
    category: "hotel",
    description: "Girraj Stay Inn provides modern luxury rooms on Kailash Nagar Road, Vrindavan. Featuring contemporary design, 24x7 security, high-speed Wi-Fi, air-conditioned rooms, and dedicated parking, it ensures a serene, comfortable retreat just minutes from Prem Mandir.",
    contact: {
      phone: "7300528912",
      altPhone: "",
      email: "girrajstayinn@gmail.com",
      website: "",
      social: { facebook: "", instagram: "", youtube: "" }
    },
    address: {
      street: "Kailash Nagar Road, Pushpa Garden",
      city: "Vrindavan",
      district: "Mathura",
      state: "Uttar Pradesh",
      pincode: "281121",
      coordinates: {
        type: "Point",
        coordinates: [77.6820, 27.5750]
      }
    },
    amenities: [
      "Luxury Rooms",
      "Free WiFi",
      "A/C Rooms",
      "24x7 Security",
      "Attached Bath",
      "Private Parking",
      "Room Service",
      "CCTV Surveillance"
    ],
    images: [
      "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1591088398332-8a7791972843?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=1200&q=80&auto=format&fit=crop"
    ],
    pricing: {
      lowestNightPrice: 1999,
      totalCapacity: 40,
      peakSeasonMultiplier: 1.5,
      donationInfo: ""
    },
    rooms: [
      {
        name: "Luxury AC Room",
        type: "private_room",
        acType: "AC",
        capacity: 2,
        totalInventory: 12,
        basePrice: 2500,
        sellingPrice: 2500,
        description: "Premium Luxury room featuring top-tier furnishings, ambient LED lighting, ultra-comfortable mattress, and clean attached bath.",
        amenities: ["AC", "Free WiFi", "Attached Bath", "24x7 Security", "Balcony"],
        images: [
          "https://images.unsplash.com/photo-1591088398332-8a7791972843?w=1200&q=80&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1200&q=80&auto=format&fit=crop"
        ]
      },
      {
        name: "Deluxe AC Room",
        type: "private_room",
        acType: "AC",
        capacity: 2,
        totalInventory: 8,
        basePrice: 1999,
        sellingPrice: 1999,
        description: "Comfortable Deluxe AC room with double bed, wardrobe, flat screen TV, high-speed Wi-Fi, and modern bathroom.",
        amenities: ["AC", "Free WiFi", "Attached Bath", "24x7 Security", "TV"],
        images: [
          "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1200&q=80&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=1200&q=80&auto=format&fit=crop"
        ]
      }
    ]
  },
  {
    name: "Radha Palace",
    slug: "radha-palace",
    citySlug: "vrindavan",
    tagline: "Luxury Rooms, Pure Veg Fine Dining & Event Booking in Chaitanya Vihar",
    ashramType: "hotel",
    category: "hotel",
    description: "Radha Palace in Chaitanya Vihar offers luxury accommodation, pure vegetarian fine dining, and serene event hosting in the holy city of Vrindavan. Located on Burjha Road near the petrol pump, it blends devotional charm with regal hospitality.",
    contact: {
      phone: "8920330316",
      altPhone: "8368652756",
      email: "radhapalacevrindavan@01.com",
      website: "",
      social: { facebook: "", instagram: "", youtube: "" }
    },
    address: {
      street: "Plot No. 109, Sector 5, Phase 2, Chaitanya Vihar, Burjha Road Near Petrol Pump",
      city: "Vrindavan",
      district: "Mathura",
      state: "Uttar Pradesh",
      pincode: "281121",
      coordinates: {
        type: "Point",
        coordinates: [77.6800, 27.5630]
      }
    },
    amenities: [
      "Luxury Rooms",
      "Pure Veg",
      "Fine Dining",
      "Event Booking",
      "AC Rooms",
      "Free Wi-Fi",
      "Attached Bath",
      "Parking Available",
      "Room Service"
    ],
    images: [
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1590490359683-658d3d23f972?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1200&q=80&auto=format&fit=crop"
    ],
    pricing: {
      lowestNightPrice: 2200,
      totalCapacity: 24,
      peakSeasonMultiplier: 1.5,
      donationInfo: ""
    },
    rooms: [
      {
        name: "Luxury AC Room",
        type: "private_room",
        acType: "AC",
        capacity: 2,
        totalInventory: 6,
        basePrice: 2200,
        sellingPrice: 2200,
        description: "Regal air-conditioned room with ornate decor, attached deluxe bathroom, pure veg room dining service, and scenic views.",
        amenities: ["AC", "Attached Bath", "Free Wi-Fi", "Pure Veg Dining", "Room Service"],
        images: [
          "https://images.unsplash.com/photo-1590490359683-658d3d23f972?w=1200&q=80&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1200&q=80&auto=format&fit=crop"
        ]
      },
      {
        name: "Royal Family Suite",
        type: "family_room",
        acType: "AC",
        capacity: 4,
        totalInventory: 4,
        basePrice: 3500,
        sellingPrice: 3500,
        description: "Spacious palace-style family suite for 4 guests with connected living space, luxury bedding, and complete comfort.",
        amenities: ["AC", "Family Suite", "Attached Bath", "Free Wi-Fi", "Fine Dining", "LED TV"],
        images: [
          "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1200&q=80&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1590490359683-658d3d23f972?w=1200&q=80&auto=format&fit=crop"
        ]
      }
    ]
  },
  {
    name: "Shri Prakash Dham",
    slug: "shri-prakash-dham",
    citySlug: "vrindavan",
    tagline: "Single & Double Bed AC and Non-AC Accommodation in Chaitanya Vihar",
    ashramType: "dharamshala",
    category: "dharamshala",
    description: "Shri Prakash Dham offers clean, peaceful, devotee-friendly lodging directly opposite the petrol pump in Chaitanya Vihar Phase-2. Providing both Single and Double Bed AC and Non-AC rooms with attached baths, it is the ideal budget stay for yatris visiting Vrindavan.",
    contact: {
      phone: "7851831618",
      altPhone: "9416962214",
      email: "shriprakashdham@gmail.com",
      website: "",
      social: { facebook: "", instagram: "", youtube: "" }
    },
    address: {
      street: "Chaitanya Vihar Phase-2, Front of Petrol Pump",
      city: "Vrindavan",
      district: "Mathura",
      state: "Uttar Pradesh",
      pincode: "281121",
      coordinates: {
        type: "Point",
        coordinates: [77.6795, 27.5635]
      }
    },
    amenities: [
      "AC & Non-AC Rooms",
      "Single & Double Bed",
      "Attached Bath",
      "Pure Veg Environment",
      "Hot Water Facility",
      "Free Wi-Fi",
      "24/7 Power Backup",
      "Devotee Hospitality"
    ],
    images: [
      "https://images.unsplash.com/photo-1549294413-26f195200c16?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1620626011761-996317b8d101?w=1200&q=80&auto=format&fit=crop"
    ],
    pricing: {
      lowestNightPrice: 999,
      totalCapacity: 30,
      peakSeasonMultiplier: 1.5,
      donationInfo: ""
    },
    rooms: [
      {
        name: "Double Bed AC Room",
        type: "private_room",
        acType: "AC",
        capacity: 2,
        totalInventory: 9,
        basePrice: 1500,
        sellingPrice: 1500,
        description: "Spacious Double Bed AC room with clean linens, attached private bathroom, hot water facility, and quiet pilgrim ambiance.",
        amenities: ["AC", "Double Bed", "Attached Bath", "Free Wi-Fi", "Geyser"],
        images: [
          "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=1200&q=80&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1620626011761-996317b8d101?w=1200&q=80&auto=format&fit=crop"
        ]
      },
      {
        name: "Single Bed / Non-AC Room",
        type: "private_room",
        acType: "Non-AC",
        capacity: 1,
        totalInventory: 6,
        basePrice: 999,
        sellingPrice: 999,
        description: "Budget-friendly single/twin Non-AC room with attached washroom, ceiling fan, and peaceful atmosphere for solo pilgrims and devotees.",
        amenities: ["Single Bed", "Attached Bath", "Ceiling Fan", "Hot Water"],
        images: [
          "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&q=80&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1620626011761-996317b8d101?w=1200&q=80&auto=format&fit=crop"
        ]
      }
    ]
  },
  {
    name: "Satya Nikunj Inn",
    slug: "satya-nikunj-inn",
    citySlug: "vrindavan",
    tagline: "24x7 AC Rooms Available in Sector 5 Phase 2, Chaitanya Vihar",
    ashramType: "hotel",
    category: "hotel",
    description: "Satya Nikunj Inn (॥ श्री कुंज बिहारी श्री हरिदास ॥) offers 24x7 air-conditioned rooms at Plot 132, Sector 5 Phase 2, Chaitanya Vihar, Vrindavan. Featuring modern multi-story amenities, 24-hour reception, free Wi-Fi, and secure parking close to Prem Mandir.",
    contact: {
      phone: "9762485131",
      altPhone: "9416962214",
      email: "satyanikunjinn@gmail.com",
      website: "",
      social: { facebook: "", instagram: "", youtube: "" }
    },
    address: {
      street: "132, Sector 5 Phase 2, Chaitanya Vihar",
      city: "Vrindavan",
      district: "Mathura",
      state: "Uttar Pradesh",
      pincode: "281121",
      coordinates: {
        type: "Point",
        coordinates: [77.6805, 27.5628]
      }
    },
    amenities: [
      "24X7 AC Rooms",
      "Free WiFi",
      "Attached Bath",
      "24x7 Security",
      "Hot & Cold Water",
      "Parking Available",
      "Power Backup",
      "Elevator"
    ],
    images: [
      "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1568495248636-6432b97bd949?w=1200&q=80&auto=format&fit=crop"
    ],
    pricing: {
      lowestNightPrice: 1800,
      totalCapacity: 40,
      peakSeasonMultiplier: 1.5,
      donationInfo: ""
    },
    rooms: [
      {
        name: "24x7 AC Deluxe Room",
        type: "private_room",
        acType: "AC",
        capacity: 2,
        totalInventory: 14,
        basePrice: 1800,
        sellingPrice: 1800,
        description: "24x7 Air-Conditioned Deluxe room with double bed, attached modern bath, high-speed Wi-Fi, and 24-hour service.",
        amenities: ["24x7 AC", "Double Bed", "Attached Bath", "Free WiFi", "Geyser"],
        images: [
          "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1568495248636-6432b97bd949?w=1200&q=80&auto=format&fit=crop"
        ]
      },
      {
        name: "Executive AC Room",
        type: "private_room",
        acType: "AC",
        capacity: 2,
        totalInventory: 6,
        basePrice: 2400,
        sellingPrice: 2400,
        description: "Premium Executive AC room with large windows, workspace, sofa seating, and top-tier amenities.",
        amenities: ["24x7 AC", "King Bed", "Attached Bath", "Free WiFi", "Smart TV", "Room Service"],
        images: [
          "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80&auto=format&fit=crop"
        ]
      }
    ]
  }
];

async function seed() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  const ashramsCol = db.collection("ashrams");
  const roomsCol = db.collection("rooms");

  const superAdmin = await db.collection("users").findOne({ role: "super_admin" });
  const ownerId = superAdmin ? superAdmin._id : new mongoose.Types.ObjectId("6a6351ec7692f0668d796b35");

  console.log("Using owner ID:", ownerId);

  for (const item of STAYS_SEED_DATA) {
    console.log(`\nProcessing Stay: ${item.name} (${item.slug})`);

    // Check if ashram exists by slug or name (handling hotel-sharda-palace / hotel-sharada-palace)
    let existing = await ashramsCol.findOne({
      $or: [
        { slug: item.slug },
        { name: new RegExp(`^${item.name}$`, "i") },
        ...(item.slug === "hotel-sharda-palace" ? [{ slug: "hotel-sharada-palace" }] : [])
      ]
    });

    let ashramId;
    const now = new Date();

    const ashramDoc = {
      name: item.name,
      slug: item.slug,
      citySlug: item.citySlug,
      tagline: item.tagline,
      ashramType: item.ashramType,
      languages: "Hindi, English",
      primaryLanguages: ["Hindi", "English"],
      establishedYear: "2020",
      foundedBy: "",
      description: item.description,
      history: "",
      contact: item.contact,
      trust: {
        trustName: "Na",
        trustRegNo: "",
        panNo: "",
        trustType: "Private Trust",
        registeredBy: ""
      },
      activities: [],
      dailySchedule: "",
      specialEvents: "",
      pricing: item.pricing,
      policies: {
        checkInTime: "12:00",
        checkOutTime: "11:00",
        minStay: 1,
        maxStay: 30,
        cancellationPolicy: "Free cancellation up to 24 hours before check-in."
      },
      food: {
        foodType: "Satvik Vegetarian",
        mealTimings: { breakfast: "08:00", lunch: "12:30", dinner: "20:00" },
        prasadDetails: "",
        specialDiet: ""
      },
      transport: {
        nearestRailway: "Mathura Junction",
        railwayDistance: "12 km",
        nearestAirport: "Agra Airport",
        airportDistance: "65 km",
        busStand: "Vrindavan Bus Stand",
        busDistance: "3 km",
        autoRickshaw: true,
        taxiAvailable: true,
        parkingAvailable: true
      },
      medical: {
        nearestHospital: "Ramakrishna Mission Sevashrama",
        hospitalDistance: "2 km",
        emergencyPhone: "108",
        firstAidAvailable: true,
        ambulanceAccess: true
      },
      nearbyAttractions: [
        { name: "Prem Mandir", distance: "1.2 km", type: "Temple" },
        { name: "Banke Bihari Temple", distance: "2.5 km", type: "Temple" },
        { name: "ISKCON Vrindavan", distance: "1.8 km", type: "Temple" }
      ],
      rules: [
        "Valid Government Photo ID required at check-in",
        "Alcohol and non-vegetarian food strictly prohibited",
        "Quiet hours from 10:00 PM to 06:00 AM"
      ],
      address: item.address,
      amenities: item.amenities,
      documents: {
        trustDeedUrl: "",
        fireSafetyCertificateUrl: "",
        landOwnershipUrl: "",
        uploadNotes: "Verified property visiting card records"
      },
      images: item.images,
      virtualTour360: [],
      videos: [],
      rating: { average: 4.8, count: 26 },
      isVerified: true,
      status: "approved",
      bookingPaused: false,
      bookingPausedAt: null,
      availabilityRequest: { pending: false, requestedAt: null, requestedBy: null },
      deletedAt: null,
      deletedBy: null,
      updatedAt: now
    };

    if (existing) {
      ashramId = existing._id;
      console.log(`Updating existing stay: ${existing.name} (ID: ${ashramId})`);
      await ashramsCol.updateOne(
        { _id: ashramId },
        {
          $set: {
            ...ashramDoc,
            ownerId: existing.ownerId || ownerId,
            ashramCode: existing.ashramCode || `ASH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
          }
        }
      );
    } else {
      ashramId = new mongoose.Types.ObjectId();
      console.log(`Inserting new stay: ${item.name} (ID: ${ashramId})`);
      await ashramsCol.insertOne({
        _id: ashramId,
        ownerId,
        ashramCode: `ASH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        ...ashramDoc,
        createdAt: now
      });
    }

    // Now recreate rooms for this stay with exact specified inventory
    console.log(`Cleaning previous rooms for ashramId: ${ashramId}`);
    await roomsCol.deleteMany({ ashramId });

    let stayTotalRooms = 0;
    for (const room of item.rooms) {
      const roomId = new mongoose.Types.ObjectId();
      stayTotalRooms += room.totalInventory;
      await roomsCol.insertOne({
        _id: roomId,
        ashramId,
        name: room.name,
        type: room.type,
        acType: room.acType,
        capacity: room.capacity,
        totalInventory: room.totalInventory,
        basePrice: room.basePrice,
        discountPercent: 0,
        discountAmount: 0,
        sellingPrice: room.sellingPrice,
        isDiscountActive: false,
        description: room.description,
        amenities: room.amenities,
        images: room.images,
        pricingRules: [],
        status: "active",
        deletedAt: null,
        createdAt: now,
        updatedAt: now
      });
      console.log(`  -> Added room "${room.name}": ${room.totalInventory} units @ ₹${room.basePrice}`);
    }
    console.log(`=> Stay "${item.name}" total room inventory: ${stayTotalRooms}`);
  }

  console.log("\nAll 5 stays successfully seeded and active!");
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
