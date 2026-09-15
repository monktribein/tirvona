/**
 * Stays Near Prem Mandir, Vrindavan - Static Property Dataset
 *
 * This file contains the 6 curated properties in Vrindavan near Prem Mandir.
 * You can easily replace/update any fields, property links (detailsUrl, bookingUrl),
 * photos, prices, or amenities here.
 */

export interface PremMandirProperty {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  location: string;
  area: string;
  distance: string; // e.g. "350 m from Prem Mandir"
  distanceKm: number; // numeric for sorting (in km)
  price: number; // starting night price in INR
  priceDisplay?: string; // fallback if text
  rating: number;
  reviewCount: number;
  image: string;
  galleryImages?: string[];
  amenities: string[];
  category: "ashram" | "dharamshala" | "homestay" | "hotel";
  tags: string[]; // e.g. ["Near Prem Mandir", "Budget Stay", "Family Stay", "Near ISKCON"]
  trusted: boolean; // Tirvona Trusted™ badge (only displayed if true)
  roomTypes?: { name: string; capacity: string; price: number }[];
  description: string;
  contact?: {
    phone?: string;
    email?: string;
  };
  detailsUrl: string; // e.g. "/Stays-near-prem-mandir-vrindavan/fogla-ashram-vrindavan" or "/ashrams/vrindavan/fogla-ashram"
  bookingUrl: string; // e.g. "/ashrams/vrindavan/fogla-ashram/book" or "/search?destination=Vrindavan"
}

export const PREM_MANDIR_PROPERTIES: PremMandirProperty[] = [
  {
    id: "stay-1",
    slug: "hotel-krishna-anandam",
    name: "Hotel Krishna Anandam",
    tagline: "Comfortable spiritual stay opposite Sanskar City, Rukmani Vihar",
    location: "Plot Num E 17 Sec 2, Rukmani Vihar Opposite Sanskar City, Vrindavan",
    area: "Rukmani Vihar, Vrindavan",
    distance: "1.2 km from Prem Mandir",
    distanceKm: 1.2,
    price: 3500,
    rating: 4.8,
    reviewCount: 42,
    image: "https://res.cloudinary.com/fvd3kven/image/upload/v1789391166/tirvona/admin-gallery/wpkdaypqyyewysts2q5s.jpg",
    galleryImages: [
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789391166/tirvona/admin-gallery/wpkdaypqyyewysts2q5s.jpg",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789391002/tirvona/admin-gallery/r61juczcdeyhb171tu7u.jpg",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789381825/tirvona/admin-gallery/mc4wgq7kqfwvkb3umbnf.jpg",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1789103260/tirvona/ashrams/jr7x0hzdiztuuyecikmc.jpg",
    ],
    amenities: ["AC Deluxe & Family Rooms", "Free Wi-Fi", "Attached Bath", "Cooler", "Parking Space"],
    category: "hotel",
    tags: ["Near Prem Mandir", "Family Stay"],
    trusted: true,
    roomTypes: [
      { name: "Deluxe AC Room", capacity: "2 Guests", price: 3500 },
      { name: "Super Deluxe AC Room", capacity: "2 Guests", price: 4000 },
      { name: "Family Room (2 Attached Rooms)", capacity: "4 Guests", price: 8000 },
      { name: "AC Dormitory", capacity: "6 Guests", price: 6000 },
    ],
    description: "Located opposite Sanskar City in Rukmani Vihar, Hotel Krishna Anandam offers well-appointed Deluxe, Super Deluxe, and Family rooms with attached baths and modern amenities for yatris visiting Prem Mandir and holy Vrindavan.",
    contact: {
      phone: "9208550807",
      email: "gmkrishnaanandam@gamil.com",
    },
    detailsUrl: "/ashrams/vrindavan/hotel-krishna-anandam",
    bookingUrl: "/ashrams/vrindavan/hotel-krishna-anandam/book",
  },
  {
    id: "stay-2",
    slug: "sukhram-dham",
    name: "Sukhram Dham",
    tagline: "Peaceful devotee dharamshala in Anand Vatika near Prem Mandir",
    location: "41 Anand Vatika Behind RO Plant Side Gali, Vrindavan, Uttar Pradesh",
    area: "Anand Vatika, Vrindavan",
    distance: "750 m from Prem Mandir",
    distanceKm: 0.75,
    price: 700,
    rating: 4.7,
    reviewCount: 38,
    image: "https://res.cloudinary.com/fvd3kven/image/upload/v1788330294/tirvona/ashrams/gwqfrjrcusa7ttfhhlab.jpg",
    galleryImages: [
      "https://res.cloudinary.com/fvd3kven/image/upload/v1788330294/tirvona/ashrams/gwqfrjrcusa7ttfhhlab.jpg",
    ],
    amenities: ["AC Rooms", "Free Wi-Fi", "Attached Bath", "Satvik Bhojan", "Parking Available"],
    category: "dharamshala",
    tags: ["Near Prem Mandir", "Budget Stay", "Family Stay"],
    trusted: true,
    roomTypes: [
      { name: "AC Room (A)", capacity: "1-2 Guests", price: 1000 },
      { name: "AC Room (C)", capacity: "3 Guests", price: 700 },
    ],
    description: "Located at Anand Vatika, Sukhram Dham offers quiet, budget-friendly spiritual lodging with AC rooms, attached bathrooms, and warm hospitality for visiting pilgrims in Vrindavan.",
    contact: {
      phone: "9368295485",
      email: "GOLAMOHAN95@GMAIL.COM",
    },
    detailsUrl: "/ashrams/vrindavan/sukhram-dham",
    bookingUrl: "/ashrams/vrindavan/sukhram-dham/book",
  },
  {
    id: "stay-3",
    slug: "sukhram-dham-a",
    name: "Sukhram Dham (A)",
    tagline: "Family-friendly AC rooms near Radhey Kunj & 100 Futa Flyover",
    location: "Anand Vatika RO Plant Ke Barabar Wali Gali, Krishna Vatika, Vrindavan",
    area: "Krishna Vatika, Vrindavan",
    distance: "800 m from Prem Mandir",
    distanceKm: 0.8,
    price: 900,
    rating: 4.6,
    reviewCount: 29,
    image: "https://res.cloudinary.com/fvd3kven/image/upload/v1788343586/tirvona/ashrams/ti8sej171uv8xrosw2d0.jpg",
    galleryImages: [
      "https://res.cloudinary.com/fvd3kven/image/upload/v1788343586/tirvona/ashrams/ti8sej171uv8xrosw2d0.jpg",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1788343597/tirvona/ashrams/zkwco74qur2jukjaegs8.jpg",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1788343605/tirvona/ashrams/kn7zghvq6scy6yeiogjv.jpg",
    ],
    amenities: ["Spacious AC Rooms", "Free Wi-Fi", "Attached Bath", "Satvik Food", "Parking Available"],
    category: "dharamshala",
    tags: ["Near Prem Mandir", "Budget Stay", "Family Stay"],
    trusted: true,
    roomTypes: [
      { name: "AC Room (A)", capacity: "4 Guests", price: 1000 },
      { name: "AC Large Family Room", capacity: "8 Guests", price: 900 },
    ],
    description: "Sukhram Dham (A) provides large capacity AC rooms ideal for families and devotee groups travelling to Vrindavan with convenient access to Prem Mandir and local temples.",
    contact: {
      phone: "7060245736",
      email: "ankitvarshney736@gmail.com",
    },
    detailsUrl: "/ashrams/vrindavan/sukhram-dham-a",
    bookingUrl: "/ashrams/vrindavan/sukhram-dham-a/book",
  },
  {
    id: "stay-4",
    slug: "hotel-shakun-palace",
    name: "Hotel Shakun Palace",
    tagline: "Spacious AC rooms in Sector 2 Rukmani Vihar with power backup & CCTV",
    location: "House No 50 Sector 2 Rukmani Vihar, Vrindavan, Mathura",
    area: "Rukmani Vihar, Vrindavan",
    distance: "1.3 km from Prem Mandir",
    distanceKm: 1.3,
    price: 1650,
    rating: 4.6,
    reviewCount: 34,
    image: "https://res.cloudinary.com/fvd3kven/image/upload/v1788858857/tirvona/ashrams/nnv1uuolt7ushsl2hyw6.jpg",
    galleryImages: [
      "https://res.cloudinary.com/fvd3kven/image/upload/v1788858857/tirvona/ashrams/nnv1uuolt7ushsl2hyw6.jpg",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1788858829/tirvona/ashrams/ax44xay9yputwu0n8iqh.jpg",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1788858834/tirvona/ashrams/isqed3p4wd0ckmqubkik.jpg",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1788858843/tirvona/ashrams/f9p1ygikjxvimjqzqqfk.jpg",
    ],
    amenities: ["AC Rooms (3 Guests)", "Attached Bath", "Free Wi-Fi", "Power Backup", "CCTV Security", "Parking Available"],
    category: "homestay",
    tags: ["Near Prem Mandir", "Family Stay"],
    trusted: false,
    roomTypes: [
      { name: "Deluxe AC Room", capacity: "3 Guests", price: 1650 },
    ],
    description: "Situated in Rukmani Vihar Sector 2, Hotel Shakun Palace offers modern AC rooms with full power backup, high-speed Wi-Fi, and convenient vehicle access to Prem Mandir and Vrindavan ghats.",
    contact: {
      phone: "8439772930",
      email: "shakunpalacevbn@gmail.com",
    },
    detailsUrl: "/ashrams/vrindavan/hotel-shakun-palace",
    bookingUrl: "/ashrams/vrindavan/hotel-shakun-palace/book",
  },
  {
    id: "stay-5",
    slug: "hotel-dwarika-palace",
    name: "Hotel Dwarika Palace",
    tagline: "Serene stay in Gopal Enclave, Gopal Dham near Burja Road",
    location: "Gopal Enclave, Gopal Dham, Burja Road, Gopalgarh, Vrindavan",
    area: "Gopalgarh, Vrindavan",
    distance: "1.5 km from Prem Mandir",
    distanceKm: 1.5,
    price: 800,
    rating: 4.6,
    reviewCount: 22,
    image: "https://res.cloudinary.com/fvd3kven/image/upload/v1788416135/tirvona/ashrams/oqp6mwz2kaxzfrpial82.jpg",
    galleryImages: [
      "https://res.cloudinary.com/fvd3kven/image/upload/v1788416135/tirvona/ashrams/oqp6mwz2kaxzfrpial82.jpg",
      "https://res.cloudinary.com/fvd3kven/image/upload/v1788416150/tirvona/ashrams/w9c9l1pwptz00xuslyxq.jpg",
    ],
    amenities: ["AC Rooms", "Free Wi-Fi", "Attached Bath", "Safe Parking", "CCTV Security", "Veg Food"],
    category: "homestay",
    tags: ["Near Prem Mandir", "Budget Stay", "Family Stay"],
    trusted: true,
    roomTypes: [
      { name: "Deluxe AC Room", capacity: "2 Guests", price: 800 },
    ],
    description: "Located at Gopal Enclave in Gopal Dham, Hotel Dwarika Palace offers peaceful AC accommodations with attached bath, pure vegetarian dining, and safe vehicle parking near Vrindavan temples.",
    contact: {
      phone: "9690620565",
      email: "Hoteldwarikapalace01@gmail.com",
    },
    detailsUrl: "/ashrams/mathura/hotel-dwarika-palace",
    bookingUrl: "/ashrams/mathura/hotel-dwarika-palace/book",
  },
];

