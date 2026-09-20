/**
 * Static & Fallback Vrindavan Stays Dataset
 *
 * Contains the 5 stays from visiting cards:
 * 1. Hotel Sharda Palace (14 rooms)
 * 2. Girraj Stay Inn (20 rooms)
 * 3. Radha Palace (10 rooms)
 * 4. Shri Prakash Dham (15 rooms)
 * 5. Satya Nikunj Inn (20 rooms)
 * Total: 79 rooms
 */

export interface VrindavanRoom {
  _id?: string;
  name: string;
  type: string;
  acType: "AC" | "Non-AC";
  capacity: number;
  totalInventory: number;
  basePrice: number;
  sellingPrice: number;
  description: string;
  amenities: string[];
  images: string[];
  status: "active" | "under_maintenance";
}

export interface VrindavanStay {
  _id: string;
  name: string;
  slug: string;
  citySlug: string;
  tagline: string;
  ashramType: "hotel" | "dharamshala" | "homestay" | "ashram";
  category: "hotel" | "dharamshala" | "homestay" | "ashram";
  description: string;
  contact: {
    phone: string;
    altPhone?: string;
    email?: string;
  };
  address: {
    street: string;
    city: string;
    district: string;
    state: string;
    pincode: string;
    coordinates?: {
      type: "Point";
      coordinates: [number, number]; // [lng, lat]
    };
  };
  amenities: string[];
  images: string[];
  pricing: {
    lowestNightPrice: number;
    totalCapacity: number;
  };
  rating: {
    average: number;
    count: number;
  };
  status: "approved";
  isVerified: boolean;
  bookingPaused: boolean;
  totalRooms: number;
  rooms: VrindavanRoom[];
  detailsUrl: string;
  bookingUrl: string;
}

export const VRINDAVAN_DUMMY_STAYS: VrindavanStay[] = [
  {
    _id: "stay-vrn-sharda-palace",
    name: "Hotel Sharda Palace",
    slug: "hotel-sharda-palace",
    citySlug: "vrindavan",
    tagline: "Comfortable hospitality near Sabji Mandi, Akrur Road",
    ashramType: "hotel",
    category: "hotel",
    description:
      "Hotel Sharda Palace offers warm hospitality, comfortable air-conditioned rooms, and dedicated service in Vrindavan. Conveniently located near Sabji Mandi on Akrur Road, it provides easy access to Prem Mandir and Banke Bihari Temple for pilgrims and families.",
    contact: {
      phone: "7505863439",
      altPhone: "9528624322",
      email: "sharda@gmail.com",
    },
    address: {
      street: "Near Sabji Mandi, Akrur Road",
      city: "Vrindavan",
      district: "Mathura",
      state: "Uttar Pradesh",
      pincode: "281121",
      coordinates: {
        type: "Point",
        coordinates: [77.689, 27.5685],
      },
    },
    amenities: [
      "AC Rooms",
      "Free Wi-Fi",
      "Attached Bath",
      "Hot & Cold Water",
      "Room Service",
      "Parking Space",
      "Power Backup",
    ],
    images: [
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889573/tirvona/ashrams/jz47rfv4nhsdtzf4id2n.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889575/tirvona/ashrams/tlcwijtffpcxkf0ua1gz.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889578/tirvona/ashrams/pmd4k2nxwcv1luw1ig1a.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889581/tirvona/ashrams/fsuuriy23h4v9j6wd293.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889584/tirvona/ashrams/npxmnnnwgbpnbshw2i36.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889587/tirvona/ashrams/mzhot3fa9okaz7h5icgu.jpg"
      ],
    pricing: {
      lowestNightPrice: 2200,
      totalCapacity: 28,
    },
    rating: { average: 4.8, count: 32 },
    status: "approved",
    isVerified: true,
    bookingPaused: false,
    totalRooms: 14,
    rooms: [
      {
        name: "Deluxe AC Room",
        type: "private_room",
        acType: "AC",
        capacity: 2,
        totalInventory: 10,
        basePrice: 2200,
        sellingPrice: 2200,
        description:
          "Well-appointed Deluxe AC room with double bed, attached private bathroom, free Wi-Fi, and 24/7 hot/cold water.",
        amenities: ["AC", "Attached Bath", "Free Wi-Fi", "Geyser", "Room Service"],
        images: [
                    "https://res.cloudinary.com/fvd3kven/image/upload/v1789889595/tirvona/ashrams/h1gxukhzy2imessti8za.jpg",
                    "https://res.cloudinary.com/fvd3kven/image/upload/v1789889598/tirvona/ashrams/ii2ykejokm7205puqhdo.jpg"
          ],
        status: "active",
      },
      {
        name: "Super Deluxe AC Room",
        type: "private_room",
        acType: "AC",
        capacity: 2,
        totalInventory: 4,
        basePrice: 2800,
        sellingPrice: 2800,
        description:
          "Spacious Super Deluxe AC room with king bed, modern interiors, premium linens, and comfortable seating.",
        amenities: ["AC", "King Bed", "Attached Bath", "Free Wi-Fi", "LED TV"],
        images: [
          "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80&auto=format&fit=crop",
        ],
        status: "active",
      },
    ],
    detailsUrl: "/ashrams/vrindavan/hotel-sharda-palace",
    bookingUrl: "/ashrams/vrindavan/hotel-sharda-palace/book",
  },
  {
    _id: "stay-vrn-girraj-stay-inn",
    name: "Girraj Stay Inn",
    slug: "girraj-stay-inn",
    citySlug: "vrindavan",
    tagline: "Luxury Rooms in Kailash Nagar Road with 24x7 Security & Wi-Fi",
    ashramType: "hotel",
    category: "hotel",
    description:
      "Girraj Stay Inn provides modern luxury rooms on Kailash Nagar Road, Vrindavan. Featuring contemporary design, 24x7 security, high-speed Wi-Fi, air-conditioned rooms, and dedicated parking, it ensures a serene, comfortable retreat just minutes from Prem Mandir.",
    contact: {
      phone: "7300528912",
      email: "girrajstayinn@gmail.com",
    },
    address: {
      street: "Kailash Nagar Road, Pushpa Garden",
      city: "Vrindavan",
      district: "Mathura",
      state: "Uttar Pradesh",
      pincode: "281121",
      coordinates: {
        type: "Point",
        coordinates: [77.682, 27.575],
      },
    },
    amenities: [
      "Luxury Rooms",
      "Free WiFi",
      "A/C Rooms",
      "24x7 Security",
      "Attached Bath",
      "Private Parking",
      "Room Service",
    ],
    images: [
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889600/tirvona/ashrams/oopbqruoxaxme8grir4e.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889601/tirvona/ashrams/qhm9o3yxvwqrpsvztf6y.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889602/tirvona/ashrams/alhbqr0zscsnelssaeou.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889603/tirvona/ashrams/fyzpcby1s7hq81mzfkec.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889603/tirvona/ashrams/cs6prrqwjalfjos1k09y.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889604/tirvona/ashrams/uvyabbqqweyzibzjz7md.jpg"
      ],
    pricing: {
      lowestNightPrice: 1999,
      totalCapacity: 40,
    },
    rating: { average: 4.9, count: 48 },
    status: "approved",
    isVerified: true,
    bookingPaused: false,
    totalRooms: 20,
    rooms: [
      {
        name: "Luxury AC Room",
        type: "private_room",
        acType: "AC",
        capacity: 2,
        totalInventory: 12,
        basePrice: 2500,
        sellingPrice: 2500,
        description:
          "Premium Luxury room featuring top-tier furnishings, ambient LED lighting, ultra-comfortable mattress, and clean attached bath.",
        amenities: ["AC", "Free WiFi", "Attached Bath", "24x7 Security", "Balcony"],
        images: [
                    "https://res.cloudinary.com/fvd3kven/image/upload/v1789889607/tirvona/ashrams/hryyr2urusorxyvchs0n.jpg",
                    "https://res.cloudinary.com/fvd3kven/image/upload/v1789889607/tirvona/ashrams/niryqkj94gjcmirtyx2h.jpg"
          ],
        status: "active",
      },
      {
        name: "Deluxe AC Room",
        type: "private_room",
        acType: "AC",
        capacity: 2,
        totalInventory: 8,
        basePrice: 1999,
        sellingPrice: 1999,
        description:
          "Comfortable Deluxe AC room with double bed, wardrobe, flat screen TV, high-speed Wi-Fi, and modern bathroom.",
        amenities: ["AC", "Free WiFi", "Attached Bath", "24x7 Security", "TV"],
        images: [
          "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1200&q=80&auto=format&fit=crop",
        ],
        status: "active",
      },
    ],
    detailsUrl: "/ashrams/vrindavan/girraj-stay-inn",
    bookingUrl: "/ashrams/vrindavan/girraj-stay-inn/book",
  },
  {
    _id: "stay-vrn-radha-palace",
    name: "Radha Palace",
    slug: "radha-palace",
    citySlug: "vrindavan",
    tagline: "Luxury Rooms, Pure Veg Fine Dining & Event Booking in Chaitanya Vihar",
    ashramType: "hotel",
    category: "hotel",
    description:
      "Radha Palace in Chaitanya Vihar offers luxury accommodation, pure vegetarian fine dining, and serene event hosting in the holy city of Vrindavan. Located on Burjha Road near the petrol pump, it blends devotional charm with regal hospitality.",
    contact: {
      phone: "8920330316",
      altPhone: "8368652756",
      email: "radhapalacevrindavan@01.com",
    },
    address: {
      street:
        "Plot No. 109, Sector 5, Phase 2, Chaitanya Vihar, Burjha Road Near Petrol Pump",
      city: "Vrindavan",
      district: "Mathura",
      state: "Uttar Pradesh",
      pincode: "281121",
      coordinates: {
        type: "Point",
        coordinates: [77.68, 27.563],
      },
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
    ],
    images: [
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889608/tirvona/ashrams/dzpgevvldlzcifdprnxj.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889609/tirvona/ashrams/k1oehjvpsgrmywm0fiaf.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889611/tirvona/ashrams/liw2ru5f9bbpd0fnnaa4.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889613/tirvona/ashrams/tdkudzdkhkakjzsonmwl.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889614/tirvona/ashrams/n97kebqvstpqutjescrz.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889615/tirvona/ashrams/wugf2z0hiag6gbdt3yke.jpg"
      ],
    pricing: {
      lowestNightPrice: 2200,
      totalCapacity: 24,
    },
    rating: { average: 4.9, count: 54 },
    status: "approved",
    isVerified: true,
    bookingPaused: false,
    totalRooms: 10,
    rooms: [
      {
        name: "Luxury AC Room",
        type: "private_room",
        acType: "AC",
        capacity: 2,
        totalInventory: 6,
        basePrice: 2200,
        sellingPrice: 2200,
        description:
          "Regal air-conditioned room with ornate decor, attached deluxe bathroom, pure veg room dining service, and scenic views.",
        amenities: ["AC", "Attached Bath", "Free Wi-Fi", "Pure Veg Dining"],
        images: [
                    "https://res.cloudinary.com/fvd3kven/image/upload/v1789889618/tirvona/ashrams/a7zy4jtvxdyodxo9n1dg.jpg",
                    "https://res.cloudinary.com/fvd3kven/image/upload/v1789889618/tirvona/ashrams/ngrpbbnumcwgl7frxgtk.jpg"
          ],
        status: "active",
      },
      {
        name: "Royal Family Suite",
        type: "family_room",
        acType: "AC",
        capacity: 4,
        totalInventory: 4,
        basePrice: 3500,
        sellingPrice: 3500,
        description:
          "Spacious palace-style family suite for 4 guests with connected living space, luxury bedding, and complete comfort.",
        amenities: ["AC", "Family Suite", "Attached Bath", "Free Wi-Fi", "Fine Dining"],
        images: [
          "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1200&q=80&auto=format&fit=crop",
        ],
        status: "active",
      },
    ],
    detailsUrl: "/ashrams/vrindavan/radha-palace",
    bookingUrl: "/ashrams/vrindavan/radha-palace/book",
  },
  {
    _id: "stay-vrn-shri-prakash-dham",
    name: "Shri Prakash Dham",
    slug: "shri-prakash-dham",
    citySlug: "vrindavan",
    tagline: "Single & Double Bed AC and Non-AC Accommodation in Chaitanya Vihar",
    ashramType: "dharamshala",
    category: "dharamshala",
    description:
      "Shri Prakash Dham offers clean, peaceful, devotee-friendly lodging directly opposite the petrol pump in Chaitanya Vihar Phase-2. Providing both Single and Double Bed AC and Non-AC rooms with attached baths, it is the ideal budget stay for yatris visiting Vrindavan.",
    contact: {
      phone: "7851831618",
      altPhone: "9416962214",
      email: "shriprakashdham@gmail.com",
    },
    address: {
      street: "Chaitanya Vihar Phase-2, Front of Petrol Pump",
      city: "Vrindavan",
      district: "Mathura",
      state: "Uttar Pradesh",
      pincode: "281121",
      coordinates: {
        type: "Point",
        coordinates: [77.6795, 27.5635],
      },
    },
    amenities: [
      "AC & Non-AC Rooms",
      "Single & Double Bed",
      "Attached Bath",
      "Pure Veg Environment",
      "Hot Water Facility",
      "Free Wi-Fi",
      "24/7 Power Backup",
    ],
    images: [
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889620/tirvona/ashrams/ft17azaduoraxpos14vm.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889621/tirvona/ashrams/yu20ivz4hyybfdm3ywog.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889622/tirvona/ashrams/qknon2na9xyzaacumpys.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889623/tirvona/ashrams/w2zqbydywxm5k0zung2j.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889625/tirvona/ashrams/frz0un2wh0djgevtqqux.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889626/tirvona/ashrams/vljdzaymelvh5xokwiut.jpg"
      ],
    pricing: {
      lowestNightPrice: 999,
      totalCapacity: 30,
    },
    rating: { average: 4.7, count: 41 },
    status: "approved",
    isVerified: true,
    bookingPaused: false,
    totalRooms: 15,
    rooms: [
      {
        name: "Double Bed AC Room",
        type: "private_room",
        acType: "AC",
        capacity: 2,
        totalInventory: 9,
        basePrice: 1500,
        sellingPrice: 1500,
        description:
          "Spacious Double Bed AC room with clean linens, attached private bathroom, hot water facility, and quiet pilgrim ambiance.",
        amenities: ["AC", "Double Bed", "Attached Bath", "Free Wi-Fi", "Geyser"],
        images: [
                    "https://res.cloudinary.com/fvd3kven/image/upload/v1789889628/tirvona/ashrams/pblgmoelgqnaylnhajne.jpg",
                    "https://res.cloudinary.com/fvd3kven/image/upload/v1789889629/tirvona/ashrams/klj1vqfdf6yfuqnatzbi.jpg"
          ],
        status: "active",
      },
      {
        name: "Single Bed / Non-AC Room",
        type: "private_room",
        acType: "Non-AC",
        capacity: 1,
        totalInventory: 6,
        basePrice: 999,
        sellingPrice: 999,
        description:
          "Budget-friendly single/twin Non-AC room with attached washroom, ceiling fan, and peaceful atmosphere for solo pilgrims.",
        amenities: ["Single Bed", "Attached Bath", "Ceiling Fan", "Hot Water"],
        images: [
          "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&q=80&auto=format&fit=crop",
        ],
        status: "active",
      },
    ],
    detailsUrl: "/ashrams/vrindavan/shri-prakash-dham",
    bookingUrl: "/ashrams/vrindavan/shri-prakash-dham/book",
  },
  {
    _id: "stay-vrn-satya-nikunj-inn",
    name: "Satya Nikunj Inn",
    slug: "satya-nikunj-inn",
    citySlug: "vrindavan",
    tagline: "24x7 AC Rooms Available in Sector 5 Phase 2, Chaitanya Vihar",
    ashramType: "hotel",
    category: "hotel",
    description:
      "Satya Nikunj Inn (॥ श्री कुंज बिहारी श्री हरिदास ॥) offers 24x7 air-conditioned rooms at Plot 132, Sector 5 Phase 2, Chaitanya Vihar, Vrindavan. Featuring modern multi-story amenities, 24-hour reception, free Wi-Fi, and secure parking close to Prem Mandir.",
    contact: {
      phone: "9762485131",
      altPhone: "9416962214",
      email: "satyanikunjinn@gmail.com",
    },
    address: {
      street: "132, Sector 5 Phase 2, Chaitanya Vihar",
      city: "Vrindavan",
      district: "Mathura",
      state: "Uttar Pradesh",
      pincode: "281121",
      coordinates: {
        type: "Point",
        coordinates: [77.6805, 27.5628],
      },
    },
    amenities: [
      "24X7 AC Rooms",
      "Free WiFi",
      "Attached Bath",
      "24x7 Security",
      "Hot & Cold Water",
      "Parking Available",
      "Power Backup",
    ],
    images: [
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889630/tirvona/ashrams/kwouzdryi2r5rv7538i0.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889631/tirvona/ashrams/fmhdgwcmlkaoqnhqvqq9.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889632/tirvona/ashrams/e4sun0jhswpej3lm1edc.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889634/tirvona/ashrams/ew4r6mwdidd4lllihaur.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889635/tirvona/ashrams/pt7ymr3iuqzsnwwnme4e.jpg",
            "https://res.cloudinary.com/fvd3kven/image/upload/v1789889637/tirvona/ashrams/ecva133sohzyq1t1dhnn.jpg"
      ],
    pricing: {
      lowestNightPrice: 1800,
      totalCapacity: 40,
    },
    rating: { average: 4.8, count: 37 },
    status: "approved",
    isVerified: true,
    bookingPaused: false,
    totalRooms: 20,
    rooms: [
      {
        name: "24x7 AC Deluxe Room",
        type: "private_room",
        acType: "AC",
        capacity: 2,
        totalInventory: 14,
        basePrice: 1800,
        sellingPrice: 1800,
        description:
          "24x7 Air-Conditioned Deluxe room with double bed, attached modern bath, high-speed Wi-Fi, and 24-hour service.",
        amenities: ["24x7 AC", "Double Bed", "Attached Bath", "Free WiFi", "Geyser"],
        images: [
                    "https://res.cloudinary.com/fvd3kven/image/upload/v1789889639/tirvona/ashrams/g6qyawfpwaz24avf5afb.jpg",
                    "https://res.cloudinary.com/fvd3kven/image/upload/v1789889640/tirvona/ashrams/nhx97ud8xrvrprr94jru.jpg"
          ],
        status: "active",
      },
      {
        name: "Executive AC Room",
        type: "private_room",
        acType: "AC",
        capacity: 2,
        totalInventory: 6,
        basePrice: 2400,
        sellingPrice: 2400,
        description:
          "Premium Executive AC room with large windows, workspace, sofa seating, and top-tier amenities.",
        amenities: ["24x7 AC", "King Bed", "Attached Bath", "Free WiFi", "Smart TV"],
        images: [
          "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80&auto=format&fit=crop",
        ],
        status: "active",
      },
    ],
    detailsUrl: "/ashrams/vrindavan/satya-nikunj-inn",
    bookingUrl: "/ashrams/vrindavan/satya-nikunj-inn/book",
  },
  {
    "_id": "stay-vrn-shri-hari-singh-dham",
    "name": "Shri Hari Singh Dham",
    "slug": "shri-hari-singh-dham",
    "citySlug": "vrindavan",
    "tagline": "Aastha, Seva & Samarpan near Keshav Dham Chauraha, Burja Road",
    "ashramType": "dharamshala",
    "category": "dharamshala",
    "description": "Shri Hari Singh Dham offers serene and clean pilgrimage accommodation near Keshav Dham Chauraha on Burja Road, Vrindavan. With comfortable air-conditioned rooms, 24-hour service, and close proximity to Prem Mandir and Banke Bihari Temple, it provides a peaceful spiritual retreat for devotees and families.",
    "contact": {
      "phone": "7231906969",
      "altPhone": "9667106922",
      "email": "shriharisinghdham@gmail.com"
    },
    "address": {
      "street": "Keshav Dham Chauraha, Burja Road",
      "city": "Vrindavan",
      "district": "Mathura",
      "state": "Uttar Pradesh",
      "pincode": "281121",
      "coordinates": {
        "type": "Point",
        "coordinates": [
          77.6845,
          27.568
        ]
      }
    },
    "amenities": [
      "AC Rooms",
      "Free Wi-Fi",
      "Attached Bath",
      "24-hour Front Desk",
      "Hot & Cold Water",
      "Room Service",
      "Elevator",
      "Power Backup"
    ],
    "images": [
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789891125/tirvona/ashrams/hmuwtm4j3xxu1dxn0jqc.webp",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789891127/tirvona/ashrams/dvtx7i3hroz2npnem3ln.jpg",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789891129/tirvona/ashrams/n1wwpddfbaflca5b1b5y.jpg",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789891132/tirvona/ashrams/qw3ljimjvhpnqnnyctdm.jpg",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789891134/tirvona/ashrams/uytblwuvw4tcwgd8xjif.jpg"
    ],
    "pricing": {
      "lowestNightPrice": 1400,
      "totalCapacity": 48
    },
    "rating": {
      "average": 4.8,
      "count": 28
    },
    "status": "approved",
    "isVerified": true,
    "bookingPaused": false,
    "totalRooms": 20,
    "rooms": [
      {
        "name": "Standard AC Room",
        "type": "private_room",
        "acType": "AC",
        "capacity": 2,
        "totalInventory": 12,
        "basePrice": 1400,
        "sellingPrice": 1400,
        "description": "Comfortable air-conditioned standard room with double bed, attached bathroom, free Wi-Fi, and hot/cold water.",
        "amenities": [
          "AC",
          "Attached Bath",
          "Free Wi-Fi",
          "Geyser",
          "Room Service"
        ],
        "images": [
          "https://res.cloudinary.com/fvd3kven/image/upload/v1789891136/tirvona/ashrams/me6hacnfipb5elgml5ra.webp",
          "https://res.cloudinary.com/fvd3kven/image/upload/v1789891137/tirvona/ashrams/maiib57ybgxrkpefw1u1.webp"
        ],
        "status": "active"
      },
      {
        "name": "Deluxe AC Room",
        "type": "private_room",
        "acType": "AC",
        "capacity": 3,
        "totalInventory": 8,
        "basePrice": 1800,
        "sellingPrice": 1800,
        "description": "Spacious Deluxe AC room with king bed, modern LED TV, attached private bath, and premium linens for families.",
        "amenities": [
          "AC",
          "King Bed",
          "Attached Bath",
          "Free Wi-Fi",
          "LED TV",
          "Geyser"
        ],
        "images": [
          "https://res.cloudinary.com/fvd3kven/image/upload/v1789891139/tirvona/ashrams/g85cs1ar9zvwnf6xuips.webp",
          "https://res.cloudinary.com/fvd3kven/image/upload/v1789891141/tirvona/ashrams/cnr4ky4zuwdiwi1o79dx.webp"
        ],
        "status": "active"
      }
    ],
    "detailsUrl": "/ashrams/vrindavan/shri-hari-singh-dham",
    "bookingUrl": "/ashrams/vrindavan/shri-hari-singh-dham/book"
  },
  {
    "_id": "stay-vrn-kripa-hotel",
    "name": "Kripa Hotel",
    "slug": "kripa-hotel",
    "citySlug": "vrindavan",
    "tagline": "Deluxe Rooms, Banquet Hall & Relaxing Area in Rukmini Vihar",
    "ashramType": "hotel",
    "category": "hotel",
    "description": "Kripa Hotel offers modern amenities, deluxe air-conditioned rooms, an expansive banquet hall, and relaxing lounge spaces in Rukmini Vihar Sector 2, Vrindavan. Conveniently located near Prem Mandir, it caters to families, pilgrimage groups, and special events with dedicated hospitality.",
    "contact": {
      "phone": "9990109043",
      "altPhone": "9990109012",
      "email": "kripahotelvrindavan@gmail.com"
    },
    "address": {
      "street": "Plot No. 48, Rukmini Vihar, Sector - 2",
      "city": "Vrindavan",
      "district": "Mathura",
      "state": "Uttar Pradesh",
      "pincode": "281121",
      "coordinates": {
        "type": "Point",
        "coordinates": [
          77.671,
          27.562
        ]
      }
    },
    "amenities": [
      "Deluxe AC Rooms",
      "Banquet Hall",
      "Relaxing Area",
      "Free Wi-Fi",
      "24/7 Front Desk",
      "Hot & Cold Water",
      "Room Service",
      "Parking Space"
    ],
    "images": [
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789889600/tirvona/ashrams/oopbqruoxaxme8grir4e.jpg",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789891145/tirvona/ashrams/esqqc2c2ino4b2cmflfo.jpg",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789891146/tirvona/ashrams/q1wgirhd4lniy4xedpkx.jpg",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789891147/tirvona/ashrams/amq5kjvfmy4ohxgkeaqz.jpg"
    ],
    "pricing": {
      "lowestNightPrice": 1800,
      "totalCapacity": 60
    },
    "rating": {
      "average": 4.7,
      "count": 22
    },
    "status": "approved",
    "isVerified": true,
    "bookingPaused": false,
    "totalRooms": 25,
    "rooms": [
      {
        "name": "Deluxe AC Room",
        "type": "private_room",
        "acType": "AC",
        "capacity": 2,
        "totalInventory": 15,
        "basePrice": 1800,
        "sellingPrice": 1800,
        "description": "Deluxe air-conditioned room with double bed, attached bath, free Wi-Fi, and 24/7 hot water.",
        "amenities": [
          "AC",
          "Attached Bath",
          "Free Wi-Fi",
          "Geyser",
          "Room Service"
        ],
        "images": [
          "https://res.cloudinary.com/fvd3kven/image/upload/v1789891147/tirvona/ashrams/z1eh2yklymwqgvhvlrmc.jpg",
          "https://res.cloudinary.com/fvd3kven/image/upload/v1789891148/tirvona/ashrams/zhnbbn3qdmpe2rylus1p.jpg"
        ],
        "status": "active"
      },
      {
        "name": "Super Deluxe AC Room",
        "type": "private_room",
        "acType": "AC",
        "capacity": 3,
        "totalInventory": 10,
        "basePrice": 2400,
        "sellingPrice": 2400,
        "description": "Super Deluxe room with king bed, LED TV, relaxing seating corner, and premium hospitality.",
        "amenities": [
          "AC",
          "King Bed",
          "Attached Bath",
          "Free Wi-Fi",
          "LED TV",
          "Room Service"
        ],
        "images": [
          "https://res.cloudinary.com/fvd3kven/image/upload/v1789891149/tirvona/ashrams/minqvcggdnxr5yjrs4wj.jpg",
          "https://res.cloudinary.com/fvd3kven/image/upload/v1789891150/tirvona/ashrams/exoe8iuffoh1cb7xovv8.jpg"
        ],
        "status": "active"
      }
    ],
    "detailsUrl": "/ashrams/vrindavan/kripa-hotel",
    "bookingUrl": "/ashrams/vrindavan/kripa-hotel/book"
  },
  {
    "_id": "stay-vrn-the-vrind-orchid-hotel",
    "name": "The Vrind Orchid Hotel",
    "slug": "the-vrind-orchid-hotel",
    "citySlug": "vrindavan",
    "tagline": "Live The Luxury Life You Deserve - Burja Chauraha",
    "ashramType": "hotel",
    "category": "hotel",
    "description": "The Vrind Orchid Hotel is a premier luxury boutique hotel located in front of Indian Oil Petrol Pump at Burja Chauraha, Chaitanya Vihar Phase-2, Vrindavan. Featuring elegant contemporary architecture, lavish executive rooms, 24x7 room service, and top-tier guest amenities, it guarantees an extraordinary luxury stay near Prem Mandir.",
    "contact": {
      "phone": "7302291717",
      "email": "thevrindorchid@gmail.com"
    },
    "address": {
      "street": "S5/294, In Front of Indian Oil Petrol Pump, Burja Chauraha, Chaitanya Vihar Phase-2",
      "city": "Vrindavan",
      "district": "Mathura",
      "state": "Uttar Pradesh",
      "pincode": "281121",
      "coordinates": {
        "type": "Point",
        "coordinates": [
          77.6835,
          27.567
        ]
      }
    },
    "amenities": [
      "Luxury Rooms",
      "Free High-Speed Wi-Fi",
      "AC Rooms",
      "Attached Modern Bath",
      "24x7 Security",
      "Fine Dining",
      "Parking Space",
      "Power Backup"
    ],
    "images": [
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789891153/tirvona/ashrams/rgu1mltod10kzddymeew.png",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789891156/tirvona/ashrams/on7i3xxdvsxtvojjpguy.png",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789891159/tirvona/ashrams/afavnqrnfhucnkak4mc8.png",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789891160/tirvona/ashrams/bmdoyx7b4ifikfin72y0.png",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789891162/tirvona/ashrams/ux8vmkru0u8cy3kmfwxw.png",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789891165/tirvona/ashrams/ye511cqqv5c376bgnhuh.png"
    ],
    "pricing": {
      "lowestNightPrice": 2800,
      "totalCapacity": 95
    },
    "rating": {
      "average": 4.9,
      "count": 41
    },
    "status": "approved",
    "isVerified": true,
    "bookingPaused": false,
    "totalRooms": 40,
    "rooms": [
      {
        "name": "Luxury Executive AC Room",
        "type": "private_room",
        "acType": "AC",
        "capacity": 2,
        "totalInventory": 25,
        "basePrice": 2800,
        "sellingPrice": 2800,
        "description": "Opulent executive air-conditioned room with king bed, modern bathroom, smart TV, high-speed Wi-Fi, and 24-hour room service.",
        "amenities": [
          "AC",
          "King Bed",
          "Attached Bath",
          "Free Wi-Fi",
          "Smart TV",
          "Geyser"
        ],
        "images": [
          "https://res.cloudinary.com/fvd3kven/image/upload/v1789891166/tirvona/ashrams/ezseexa4vaoa0bppdb52.png",
          "https://res.cloudinary.com/fvd3kven/image/upload/v1789891167/tirvona/ashrams/w1gl0wqdvzlj1xsh8hnj.png"
        ],
        "status": "active"
      },
      {
        "name": "Royal Premium Suite",
        "type": "suite",
        "acType": "AC",
        "capacity": 4,
        "totalInventory": 15,
        "basePrice": 3800,
        "sellingPrice": 3800,
        "description": "Spacious Royal Premium Suite with king bedroom, separate sitting lounge, balcony view, and luxury guest amenities.",
        "amenities": [
          "AC",
          "King Bed",
          "Attached Luxury Bath",
          "Free Wi-Fi",
          "Balcony",
          "Smart TV",
          "Sofa"
        ],
        "images": [
          "https://res.cloudinary.com/fvd3kven/image/upload/v1789891168/tirvona/ashrams/apx5u7atzlpjhcsl1wbt.png",
          "https://res.cloudinary.com/fvd3kven/image/upload/v1789891169/tirvona/ashrams/bl2zqtu8navkipsvgg2q.png"
        ],
        "status": "active"
      }
    ],
    "detailsUrl": "/ashrams/vrindavan/the-vrind-orchid-hotel",
    "bookingUrl": "/ashrams/vrindavan/the-vrind-orchid-hotel/book"
  },
  {
    "_id": "stay-vrn-comfort-inn-braj",
    "name": "Comfort INN Braj",
    "slug": "comfort-inn-braj",
    "citySlug": "vrindavan",
    "tagline": "Comfort INN by Choice Hotels - Near Prem Mandir & Multilevel Parking",
    "ashramType": "hotel",
    "category": "hotel",
    "description": "Comfort INN Braj by Choice Hotels delivers world-class hospitality in Rukmani Vihar Sector 2, right behind the Multilevel Parking and minutes from Prem Mandir, Vrindavan. Boasting 55 premium keys, upscale king beds, multi-cuisine dining, high-speed Wi-Fi, and personalized concierge service, it is the premier hotel choice in Braj.",
    "contact": {
      "phone": "9084252226",
      "email": "gm@comfortinnvrindavan.com"
    },
    "address": {
      "street": "Plot No. 235, Rukmani Vihar, Sec-2, Behind the Multilevel Parking, Near Prem Mandir",
      "city": "Vrindavan",
      "district": "Mathura",
      "state": "Uttar Pradesh",
      "pincode": "281121",
      "coordinates": {
        "type": "Point",
        "coordinates": [
          77.6715,
          27.5615
        ]
      }
    },
    "amenities": [
      "Superior AC Rooms",
      "Choice Hotels Service",
      "Free High-Speed Wi-Fi",
      "Multi-cuisine Dining",
      "Attached Luxury Bath",
      "Free Valet Parking",
      "24-Hour Front Desk",
      "Elevator"
    ],
    "images": [
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789891171/tirvona/ashrams/ero0eo8gfcbbzxlhgj1c.jpg",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789891173/tirvona/ashrams/ol2q6z8i8ooupjaezmt5.jpg",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789891174/tirvona/ashrams/wprkuojsxzjoc8lp2yll.jpg",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789891175/tirvona/ashrams/pv2g2foaqj1en44zjnzc.jpg",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789891177/tirvona/ashrams/gtaeaonlwudko0lr6unx.jpg",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789891179/tirvona/ashrams/rtaqxkgg3cmkijp8k8rn.jpg"
    ],
    "pricing": {
      "lowestNightPrice": 3200,
      "totalCapacity": 130
    },
    "rating": {
      "average": 4.9,
      "count": 56
    },
    "status": "approved",
    "isVerified": true,
    "bookingPaused": false,
    "totalRooms": 55,
    "rooms": [
      {
        "name": "Superior King AC Room",
        "type": "private_room",
        "acType": "AC",
        "capacity": 2,
        "totalInventory": 35,
        "basePrice": 3200,
        "sellingPrice": 3200,
        "description": "Superior King room by Choice Hotels featuring plush king bed, premium linen, ergonomic workspace, luxury ensuite bath, and 24/7 room service.",
        "amenities": [
          "AC",
          "King Bed",
          "Attached Luxury Bath",
          "Free Wi-Fi",
          "Smart TV",
          "Work Desk"
        ],
        "images": [
          "https://res.cloudinary.com/fvd3kven/image/upload/v1789891180/tirvona/ashrams/v2gtabsudenbpfrjiwm9.jpg",
          "https://res.cloudinary.com/fvd3kven/image/upload/v1789891181/tirvona/ashrams/ou1u4cilnvj9j809qgrr.jpg"
        ],
        "status": "active"
      },
      {
        "name": "Premium Suite with Living Area",
        "type": "suite",
        "acType": "AC",
        "capacity": 4,
        "totalInventory": 20,
        "basePrice": 4500,
        "sellingPrice": 4500,
        "description": "Expansive premium suite featuring master bedroom, plush living lounge, panoramic city view, tea/coffee maker, and personalized hospitality.",
        "amenities": [
          "AC",
          "King Bed",
          "Living Area",
          "Attached Bath",
          "Free Wi-Fi",
          "Mini Bar",
          "Room Service"
        ],
        "images": [
          "https://res.cloudinary.com/fvd3kven/image/upload/v1789891181/tirvona/ashrams/hnmz6peepjxexh1iziqr.jpg",
          "https://res.cloudinary.com/fvd3kven/image/upload/v1789891182/tirvona/ashrams/mri5vmcv8bn3vwuoi46y.jpg"
        ],
        "status": "active"
      }
    ],
    "detailsUrl": "/ashrams/vrindavan/comfort-inn-braj",
    "bookingUrl": "/ashrams/vrindavan/comfort-inn-braj/book"
  }
];
