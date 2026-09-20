const fs = require('fs');
const path = require('path');

const uploadedNew = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'uploaded-4-new-stays.json'), 'utf-8')
);

// 1. Append to vrindavanStaysData.ts
const vrnPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'data', 'vrindavanStaysData.ts');
let vrnContent = fs.readFileSync(vrnPath, 'utf-8');

const newStaysVrn = [
  {
    _id: "stay-vrn-shri-hari-singh-dham",
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
    },
    address: {
      street: "Keshav Dham Chauraha, Burja Road",
      city: "Vrindavan",
      district: "Mathura",
      state: "Uttar Pradesh",
      pincode: "281121",
      coordinates: {
        type: "Point",
        coordinates: [77.6845, 27.5680],
      },
    },
    amenities: [
      "AC Rooms",
      "Free Wi-Fi",
      "Attached Bath",
      "24-hour Front Desk",
      "Hot & Cold Water",
      "Room Service",
      "Elevator",
      "Power Backup",
    ],
    images: uploadedNew['shri-hari-singh-dham'].stayImages,
    pricing: {
      lowestNightPrice: 1400,
      totalCapacity: 48,
    },
    rating: { average: 4.8, count: 28 },
    status: "approved",
    isVerified: true,
    bookingPaused: false,
    totalRooms: 20,
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
        images: uploadedNew['shri-hari-singh-dham'].roomImages['Standard AC Room'],
        status: "active",
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
        images: uploadedNew['shri-hari-singh-dham'].roomImages['Deluxe AC Room'],
        status: "active",
      },
    ],
    detailsUrl: "/ashrams/vrindavan/shri-hari-singh-dham",
    bookingUrl: "/ashrams/vrindavan/shri-hari-singh-dham/book",
  },
  {
    _id: "stay-vrn-kripa-hotel",
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
    },
    address: {
      street: "Plot No. 48, Rukmini Vihar, Sector - 2",
      city: "Vrindavan",
      district: "Mathura",
      state: "Uttar Pradesh",
      pincode: "281121",
      coordinates: {
        type: "Point",
        coordinates: [77.6710, 27.5620],
      },
    },
    amenities: [
      "Deluxe AC Rooms",
      "Banquet Hall",
      "Relaxing Area",
      "Free Wi-Fi",
      "24/7 Front Desk",
      "Hot & Cold Water",
      "Room Service",
      "Parking Space",
    ],
    images: uploadedNew['kripa-hotel'].stayImages,
    pricing: {
      lowestNightPrice: 1800,
      totalCapacity: 60,
    },
    rating: { average: 4.7, count: 22 },
    status: "approved",
    isVerified: true,
    bookingPaused: false,
    totalRooms: 25,
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
        images: uploadedNew['kripa-hotel'].roomImages['Deluxe AC Room'],
        status: "active",
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
        images: uploadedNew['kripa-hotel'].roomImages['Super Deluxe AC Room'],
        status: "active",
      },
    ],
    detailsUrl: "/ashrams/vrindavan/kripa-hotel",
    bookingUrl: "/ashrams/vrindavan/kripa-hotel/book",
  },
  {
    _id: "stay-vrn-the-vrind-orchid-hotel",
    name: "The Vrind Orchid Hotel",
    slug: "the-vrind-orchid-hotel",
    citySlug: "vrindavan",
    tagline: "Live The Luxury Life You Deserve - Burja Chauraha",
    ashramType: "hotel",
    category: "hotel",
    description: "The Vrind Orchid Hotel is a premier luxury boutique hotel located in front of Indian Oil Petrol Pump at Burja Chauraha, Chaitanya Vihar Phase-2, Vrindavan. Featuring elegant contemporary architecture, lavish executive rooms, 24x7 room service, and top-tier guest amenities, it guarantees an extraordinary luxury stay near Prem Mandir.",
    contact: {
      phone: "7302291717",
      email: "thevrindorchid@gmail.com",
    },
    address: {
      street: "S5/294, In Front of Indian Oil Petrol Pump, Burja Chauraha, Chaitanya Vihar Phase-2",
      city: "Vrindavan",
      district: "Mathura",
      state: "Uttar Pradesh",
      pincode: "281121",
      coordinates: {
        type: "Point",
        coordinates: [77.6835, 27.5670],
      },
    },
    amenities: [
      "Luxury Rooms",
      "Free High-Speed Wi-Fi",
      "AC Rooms",
      "Attached Modern Bath",
      "24x7 Security",
      "Fine Dining",
      "Parking Space",
      "Power Backup",
    ],
    images: uploadedNew['the-vrind-orchid-hotel'].stayImages,
    pricing: {
      lowestNightPrice: 2800,
      totalCapacity: 95,
    },
    rating: { average: 4.9, count: 41 },
    status: "approved",
    isVerified: true,
    bookingPaused: false,
    totalRooms: 40,
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
        images: uploadedNew['the-vrind-orchid-hotel'].roomImages['Luxury Executive AC Room'],
        status: "active",
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
        images: uploadedNew['the-vrind-orchid-hotel'].roomImages['Royal Premium Suite'],
        status: "active",
      },
    ],
    detailsUrl: "/ashrams/vrindavan/the-vrind-orchid-hotel",
    bookingUrl: "/ashrams/vrindavan/the-vrind-orchid-hotel/book",
  },
  {
    _id: "stay-vrn-comfort-inn-braj",
    name: "Comfort INN Braj",
    slug: "comfort-inn-braj",
    citySlug: "vrindavan",
    tagline: "Comfort INN by Choice Hotels - Near Prem Mandir & Multilevel Parking",
    ashramType: "hotel",
    category: "hotel",
    description: "Comfort INN Braj by Choice Hotels delivers world-class hospitality in Rukmani Vihar Sector 2, right behind the Multilevel Parking and minutes from Prem Mandir, Vrindavan. Boasting 55 premium keys, upscale king beds, multi-cuisine dining, high-speed Wi-Fi, and personalized concierge service, it is the premier hotel choice in Braj.",
    contact: {
      phone: "9084252226",
      email: "gm@comfortinnvrindavan.com",
    },
    address: {
      street: "Plot No. 235, Rukmani Vihar, Sec-2, Behind the Multilevel Parking, Near Prem Mandir",
      city: "Vrindavan",
      district: "Mathura",
      state: "Uttar Pradesh",
      pincode: "281121",
      coordinates: {
        type: "Point",
        coordinates: [77.6715, 27.5615],
      },
    },
    amenities: [
      "Superior AC Rooms",
      "Choice Hotels Service",
      "Free High-Speed Wi-Fi",
      "Multi-cuisine Dining",
      "Attached Luxury Bath",
      "Free Valet Parking",
      "24-Hour Front Desk",
      "Elevator",
    ],
    images: uploadedNew['comfort-inn-braj'].stayImages,
    pricing: {
      lowestNightPrice: 3200,
      totalCapacity: 130,
    },
    rating: { average: 4.9, count: 56 },
    status: "approved",
    isVerified: true,
    bookingPaused: false,
    totalRooms: 55,
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
        images: uploadedNew['comfort-inn-braj'].roomImages['Superior King AC Room'],
        status: "active",
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
        images: uploadedNew['comfort-inn-braj'].roomImages['Premium Suite with Living Area'],
        status: "active",
      },
    ],
    detailsUrl: "/ashrams/vrindavan/comfort-inn-braj",
    bookingUrl: "/ashrams/vrindavan/comfort-inn-braj/book",
  }
];

// Append to VRINDAVAN_DUMMY_STAYS before the closing ];
const insertIdx = vrnContent.lastIndexOf('];');
if (insertIdx !== -1) {
  let toAppend = '';
  for (const s of newStaysVrn) {
    if (!vrnContent.includes(`slug: "${s.slug}"`)) {
      toAppend += ',\n  ' + JSON.stringify(s, null, 2).replace(/\n/g, '\n  ');
    }
  }
  vrnContent = vrnContent.substring(0, insertIdx) + toAppend + '\n];\n';
  fs.writeFileSync(vrnPath, vrnContent, 'utf-8');
  console.log('Appended new stays to vrindavanStaysData.ts!');
}

// 2. Append to premMandirStaysData.ts
const premPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'data', 'premMandirStaysData.ts');
let premContent = fs.readFileSync(premPath, 'utf-8');

const newStaysPrem = [
  {
    id: "stay-shri-hari-singh-dham",
    slug: "shri-hari-singh-dham",
    name: "Shri Hari Singh Dham",
    tagline: "Aastha, Seva & Samarpan near Keshav Dham Chauraha, Burja Road",
    location: "Keshav Dham Chauraha, Burja Road, Vrindavan, Mathura",
    area: "Keshav Dham / Burja Road",
    distance: "1.0 km from Prem Mandir",
    distanceKm: 1.0,
    price: 1400,
    rating: 4.8,
    reviewCount: 28,
    image: uploadedNew['shri-hari-singh-dham'].stayImages[0],
    galleryImages: uploadedNew['shri-hari-singh-dham'].stayImages,
    amenities: ["AC Rooms", "Free Wi-Fi", "Attached Bath", "Hot Water", "Room Service", "Elevator"],
    category: "dharamshala",
    tags: ["Near Prem Mandir", "Devotee Stay", "20 Rooms"],
    trusted: true,
    description: "Shri Hari Singh Dham offers serene and clean pilgrimage accommodation near Keshav Dham Chauraha on Burja Road, Vrindavan. With comfortable air-conditioned rooms, 24-hour service, and close proximity to Prem Mandir and Banke Bihari Temple, it provides a peaceful spiritual retreat for devotees and families.",
    contact: {
      phone: "7231906969",
      email: "shriharisinghdham@gmail.com"
    },
    detailsUrl: "/ashrams/vrindavan/shri-hari-singh-dham",
    bookingUrl: "/ashrams/vrindavan/shri-hari-singh-dham/book"
  },
  {
    id: "stay-kripa-hotel",
    slug: "kripa-hotel",
    name: "Kripa Hotel",
    tagline: "Deluxe Rooms, Banquet Hall & Relaxing Area in Rukmini Vihar",
    location: "Plot No. 48, Rukmini Vihar, Sector - 2, Vrindavan",
    area: "Rukmini Vihar Sector 2",
    distance: "650 m from Prem Mandir",
    distanceKm: 0.65,
    price: 1800,
    rating: 4.7,
    reviewCount: 22,
    image: uploadedNew['kripa-hotel'].stayImages[0],
    galleryImages: uploadedNew['kripa-hotel'].stayImages,
    amenities: ["Deluxe AC Rooms", "Banquet Hall", "Relaxing Area", "Free Wi-Fi", "Parking Space"],
    category: "hotel",
    tags: ["Near Prem Mandir", "Family Stay", "25 Rooms"],
    trusted: true,
    description: "Kripa Hotel offers modern amenities, deluxe air-conditioned rooms, an expansive banquet hall, and relaxing lounge spaces in Rukmini Vihar Sector 2, Vrindavan. Conveniently located near Prem Mandir, it caters to families, pilgrimage groups, and special events with dedicated hospitality.",
    contact: {
      phone: "9990109043",
      email: "kripahotelvrindavan@gmail.com"
    },
    detailsUrl: "/ashrams/vrindavan/kripa-hotel",
    bookingUrl: "/ashrams/vrindavan/kripa-hotel/book"
  },
  {
    id: "stay-the-vrind-orchid-hotel",
    slug: "the-vrind-orchid-hotel",
    name: "The Vrind Orchid Hotel",
    tagline: "Live The Luxury Life You Deserve - Burja Chauraha",
    location: "S5/294, In Front of Indian Oil Petrol Pump, Burja Chauraha, Chaitanya Vihar Phase-2, Vrindavan",
    area: "Burja Chauraha, Chaitanya Vihar",
    distance: "900 m from Prem Mandir",
    distanceKm: 0.9,
    price: 2800,
    rating: 4.9,
    reviewCount: 41,
    image: uploadedNew['the-vrind-orchid-hotel'].stayImages[0],
    galleryImages: uploadedNew['the-vrind-orchid-hotel'].stayImages,
    amenities: ["Luxury Rooms", "Free High-Speed Wi-Fi", "AC Rooms", "Attached Luxury Bath", "Fine Dining"],
    category: "hotel",
    tags: ["Near Prem Mandir", "Luxury Stay", "40 Rooms"],
    trusted: true,
    description: "The Vrind Orchid Hotel is a premier luxury boutique hotel located in front of Indian Oil Petrol Pump at Burja Chauraha, Chaitanya Vihar Phase-2, Vrindavan. Featuring elegant contemporary architecture, lavish executive rooms, 24x7 room service, and top-tier guest amenities, it guarantees an extraordinary luxury stay near Prem Mandir.",
    contact: {
      phone: "7302291717",
      email: "thevrindorchid@gmail.com"
    },
    detailsUrl: "/ashrams/vrindavan/the-vrind-orchid-hotel",
    bookingUrl: "/ashrams/vrindavan/the-vrind-orchid-hotel/book"
  },
  {
    id: "stay-comfort-inn-braj",
    slug: "comfort-inn-braj",
    name: "Comfort INN Braj",
    tagline: "Comfort INN by Choice Hotels - Near Prem Mandir & Multilevel Parking",
    location: "Plot No. 235, Rukmani Vihar, Sec-2, Behind Multilevel Parking, Near Prem Mandir, Vrindavan",
    area: "Rukmani Vihar Sector 2",
    distance: "500 m from Prem Mandir",
    distanceKm: 0.5,
    price: 3200,
    rating: 4.9,
    reviewCount: 56,
    image: uploadedNew['comfort-inn-braj'].stayImages[0],
    galleryImages: uploadedNew['comfort-inn-braj'].stayImages,
    amenities: ["Superior AC Rooms", "Choice Hotels Service", "Free High-Speed Wi-Fi", "Multi-cuisine Dining", "Free Valet Parking"],
    category: "hotel",
    tags: ["Near Prem Mandir", "Choice Hotels", "55 Rooms"],
    trusted: true,
    description: "Comfort INN Braj by Choice Hotels delivers world-class hospitality in Rukmani Vihar Sector 2, right behind the Multilevel Parking and minutes from Prem Mandir, Vrindavan. Boasting 55 premium keys, upscale king beds, multi-cuisine dining, high-speed Wi-Fi, and personalized concierge service, it is the premier hotel choice in Braj.",
    contact: {
      phone: "9084252226",
      email: "gm@comfortinnvrindavan.com"
    },
    detailsUrl: "/ashrams/vrindavan/comfort-inn-braj",
    bookingUrl: "/ashrams/vrindavan/comfort-inn-braj/book"
  }
];

const premInsertIdx = premContent.lastIndexOf('];');
if (premInsertIdx !== -1) {
  let toAppendPrem = '';
  for (const s of newStaysPrem) {
    if (!premContent.includes(`slug: "${s.slug}"`)) {
      toAppendPrem += ',\n  ' + JSON.stringify(s, null, 2).replace(/\n/g, '\n  ');
    }
  }
  premContent = premContent.substring(0, premInsertIdx) + toAppendPrem + '\n];\n';
  fs.writeFileSync(premPath, premContent, 'utf-8');
  console.log('Appended new stays to premMandirStaysData.ts!');
}
