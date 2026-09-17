export interface SeoLandingH2Section {
  id: string;
  title: string;
  subtitle: string;
  filterKey?:
    | "all"
    | "hotel"
    | "budget"
    | "under_1000"
    | "family"
    | "parking"
    | "popular_temples"
    | "near_prem_mandir";
}

export interface SeoLandingConfig {
  id:
    | "vrindavan"
    | "banke-bihari"
    | "prem-mandir"
    | "iskcon"
    | "budget"
    | "family";
  route: string;
  canonicalUrl: string;
  title: string;
  metaDescription: string;
  h1: string;
  heroCopy: string;
  listingCopy: string;
  targetTemple?: {
    name: string;
    coords: { lat: number; lng: number };
    address: string;
    darshanTimings: string;
    image: string;
  };
  h2Sections: SeoLandingH2Section[];
  whyBookCopy: string;
  internalLinks: Array<{
    title: string;
    to: string;
    tag: string;
    description: string;
    image: string;
  }>;
  faqs: Array<{ q: string; a: string }>;
}

export const TEMPLE_COORDS = {
  PREM_MANDIR: { lat: 27.5657, lng: 77.685 },
  BANKE_BIHARI: { lat: 27.5815, lng: 77.7015 },
  ISKCON: { lat: 27.5714, lng: 77.6747 },
};

export const SEO_LANDING_CONFIGS: Record<string, SeoLandingConfig> = {
  vrindavan: {
    id: "vrindavan",
    route: "/ashrams/vrindavan",
    canonicalUrl: "https://www.tirvona.com/ashrams/vrindavan",
    title: "Hotels & Stays in Vrindavan | Tirvona",
    metaDescription:
      "Find hotels and stays in Vrindavan. Compare locations, prices, amenities and available rooms on Tirvona.",
    h1: "Stays in Vrindavan",
    heroCopy:
      "Planning a visit to Vrindavan? Explore available stays and compare location, starting price and amenities before booking with Tirvona.",
    listingCopy:
      "Browse available stays in Vrindavan and choose an option based on your preferred location, budget and stay requirements.",
    whyBookCopy:
      "Compare available stays by location, price and amenities, then choose the property that fits your travel requirements.",
    h2Sections: [
      {
        id: "stays-in-vrindavan",
        title: "Stays in Vrindavan",
        subtitle:
          "Find available hotels, guest houses and stays in Vrindavan with location, price and essential amenities.",
        filterKey: "all",
      },
      {
        id: "hotels-in-vrindavan",
        title: "Hotels in Vrindavan",
        subtitle:
          "Explore stays across Vrindavan and compare starting prices, location, distance and available amenities before booking.",
        filterKey: "hotel",
      },
      {
        id: "budget-stays-in-vrindavan",
        title: "Budget Stays in Vrindavan",
        subtitle:
          "Find budget-friendly stays in Vrindavan with options for short pilgrim visits, couples and families.",
        filterKey: "budget",
      },
      {
        id: "family-stays-in-vrindavan",
        title: "Family Stays in Vrindavan",
        subtitle:
          "Explore family-friendly stays in Vrindavan with suitable rooms and essential amenities for your visit.",
        filterKey: "family",
      },
      {
        id: "stays-near-popular-temples",
        title: "Stays Near Popular Temples",
        subtitle:
          "Explore available stays near Banke Bihari Temple, Prem Mandir and ISKCON Vrindavan based on location and travel requirements.",
        filterKey: "popular_temples",
      },
      {
        id: "why-book-with-tirvona",
        title: "Why Book Your Stay with Tirvona?",
        subtitle:
          "Compare available stays by location, price and amenities, then choose the property that fits your travel requirements.",
      },
    ],
    internalLinks: [
      {
        title: "Stays Near Banke Bihari Temple",
        to: "/stays-near-banke-bihari-vrindavan",
        tag: "High Pilgrim Demand",
        description:
          "Hotels and guest houses within easy walking or e-rickshaw distance of Banke Bihari Temple.",
        image:
          "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600&q=80",
      },
      {
        title: "Stays Near Prem Mandir",
        to: "/Stays-near-prem-mandir-vrindavan",
        tag: "Evening Illumination",
        description:
          "Verified hotels, ashrams and dharamshalas near Prem Mandir on Raman Reti Road.",
        image: "/images/destinations/vrindavan/prem_mandir_night_hero.jpg",
      },
      {
        title: "Stays Near ISKCON Vrindavan",
        to: "/stays-near-iskcon-vrindavan",
        tag: "Spiritual Atmosphere",
        description:
          "Peaceful devotee guesthouses and hotels near Krishna Balaram Mandir.",
        image:
          "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80",
      },
      {
        title: "Budget Stays in Vrindavan",
        to: "/budget-stays-in-vrindavan",
        tag: "Under ₹1000",
        description:
          "Affordable rooms, clean dharamshalas, and economical pilgrim lodgings.",
        image:
          "https://images.unsplash.com/photo-1627894483216-2138af692e32?w=600&q=80",
      },
      {
        title: "Family Stays in Vrindavan",
        to: "/family-stays-in-vrindavan",
        tag: "Spacious & Comfortable",
        description:
          "Family hotels with interconnected rooms, elevator access, and attached baths.",
        image:
          "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=600&q=80",
      },
    ],
    faqs: [
      {
        q: "What types of stays are available in Vrindavan?",
        a: "Vrindavan offers verified hotels, pilgrim dharamshalas, spiritual ashrams, and private guest houses. Tirvona lists verified options with transparent pricing and real availability.",
      },
      {
        q: "How early should I book stays in Vrindavan?",
        a: "For festivals like Janmashtami, Radhashtami, Holi, and Kartik month, it is recommended to book 2 to 4 weeks in advance due to high pilgrim footfall.",
      },
      {
        q: "Are parking facilities available at Vrindavan hotels?",
        a: "Yes, many hotels and ashrams located on Raman Reti and Chhatikara roads provide on-site private car parking. You can filter stays with parking directly on Tirvona.",
      },
      {
        q: "Can I find stays under ₹1000 in Vrindavan?",
        a: "Yes, budget dharamshalas and economical guest houses offer clean rooms starting from ₹200 to ₹900 per night with essential amenities like attached baths and hot water.",
      },
    ],
  },

  "banke-bihari": {
    id: "banke-bihari",
    route: "/stays-near-banke-bihari-vrindavan",
    canonicalUrl: "https://www.tirvona.com/stays-near-banke-bihari-vrindavan",
    title: "Hotels Near Banke Bihari Temple Vrindavan | Tirvona",
    metaDescription:
      "Find hotels and stays near Banke Bihari Temple, Vrindavan. Compare prices, location, amenities and available rooms on Tirvona.",
    h1: "Stays Near Banke Bihari Temple, Vrindavan",
    heroCopy:
      "Planning a visit to Banke Bihari Temple, Vrindavan? Explore available stays near the temple and compare location, starting price and amenities before booking with Tirvona.",
    listingCopy:
      "Browse available stays near Banke Bihari Temple and choose an option based on your preferred location, budget and stay requirements.",
    whyBookCopy:
      "Compare available stays by location, price and amenities, then choose the property that fits your travel requirements.",
    targetTemple: {
      name: "Banke Bihari Temple Vrindavan",
      coords: TEMPLE_COORDS.BANKE_BIHARI,
      address: "Goda Vihar, Vrindavan, Mathura, UP – 281121",
      darshanTimings:
        "Morning: 7:45 AM – 12:00 PM | Evening: 5:30 PM – 9:30 PM",
      image:
        "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600&q=80",
    },
    h2Sections: [
      {
        id: "stays-near-banke-bihari-temple",
        title: "Stays Near Banke Bihari Temple",
        subtitle:
          "Find available hotels, guest houses and stays near Banke Bihari Temple with location, price and essential amenities.",
        filterKey: "all",
      },
      {
        id: "hotels-near-banke-bihari-temple",
        title: "Hotels Near Banke Bihari Temple, Vrindavan",
        subtitle:
          "Explore stays near Banke Bihari Temple and compare starting prices, distance and available amenities before booking.",
        filterKey: "hotel",
      },
      {
        id: "budget-stays-near-banke-bihari",
        title: "Budget Stays Near Banke Bihari Temple",
        subtitle:
          "Find budget-friendly stays near Banke Bihari Temple with options for short pilgrim and family visits.",
        filterKey: "budget",
      },
      {
        id: "family-stays-near-banke-bihari",
        title: "Family Stays Near Banke Bihari Temple",
        subtitle:
          "Explore family-friendly stays near Banke Bihari Temple with suitable rooms and essential amenities for your visit to Vrindavan.",
        filterKey: "family",
      },
      {
        id: "stays-with-parking-near-banke-bihari",
        title: "Stays with Parking Near Banke Bihari Temple",
        subtitle:
          "Explore available stays with parking options near Banke Bihari Temple, based on your location and stay requirements.",
        filterKey: "parking",
      },
      {
        id: "why-book-with-tirvona",
        title: "Why Book Your Stay with Tirvona?",
        subtitle:
          "Compare available stays by location, price and amenities, then choose the property that fits your travel requirements.",
      },
    ],
    internalLinks: [
      {
        title: "All Stays in Vrindavan",
        to: "/ashrams/vrindavan",
        tag: "City Overview",
        description:
          "Explore the complete verified collection of hotels, ashrams, and guesthouses across Vrindavan.",
        image:
          "https://images.unsplash.com/photo-1627894483216-2138af692e32?w=600&q=80",
      },
      {
        title: "Stays Near Prem Mandir",
        to: "/Stays-near-prem-mandir-vrindavan",
        tag: "Prem Mandir Proximity",
        description:
          "Stays located close to Prem Mandir with easy access to evening fountain shows.",
        image: "/images/destinations/vrindavan/prem_mandir_night_hero.jpg",
      },
      {
        title: "Stays Near ISKCON Vrindavan",
        to: "/stays-near-iskcon-vrindavan",
        tag: "Devotee Accommodations",
        description:
          "Accommodations near Krishna Balaram Temple and Raman Reti.",
        image:
          "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80",
      },
      {
        title: "Budget Stays in Vrindavan",
        to: "/budget-stays-in-vrindavan",
        tag: "Economical Options",
        description:
          "Compare budget hotels and dharamshalas under ₹1000 per night.",
        image:
          "https://images.unsplash.com/photo-1609766857041-ed402ea8069a?w=600&q=80",
      },
    ],
    faqs: [
      {
        q: "How close can I stay to Banke Bihari Temple?",
        a: "Several ashrams and guest houses are located within 500 meters to 1.5 km of Banke Bihari Temple. Because inner temple lanes are pedestrianized, e-rickshaws operate from nearby drop points.",
      },
      {
        q: "Is vehicle parking available near Banke Bihari Temple?",
        a: "Inside the narrow heritage lanes around Banke Bihari Temple, vehicle access is restricted. Stays on the outer approach roads provide designated on-site car parking.",
      },
      {
        q: "What are the darshan timings for Banke Bihari Temple?",
        a: "Morning darshan runs from approximately 7:45 AM to 12:00 PM, and evening darshan from 5:30 PM to 9:30 PM (summer and winter schedules adjust slightly).",
      },
      {
        q: "Are family rooms available near Banke Bihari Temple?",
        a: "Yes, verified family stays offer spacious 3-bed and 4-bed options with attached bathrooms, air-conditioning, and elevator access.",
      },
    ],
  },

  "prem-mandir": {
    id: "prem-mandir",
    route: "/Stays-near-prem-mandir-vrindavan",
    canonicalUrl: "https://www.tirvona.com/Stays-near-prem-mandir-vrindavan",
    title: "Hotels Near Prem Mandir Vrindavan | Tirvona",
    metaDescription:
      "Find hotels and stays near Prem Mandir, Vrindavan. Compare locations, prices, amenities and available stays on Tirvona.",
    h1: "Stays Near Prem Mandir, Vrindavan",
    heroCopy:
      "Planning a visit to Prem Mandir, Vrindavan? Explore available stays near the temple and compare location, starting price and amenities before booking with Tirvona.",
    listingCopy:
      "Browse available stays near Prem Mandir and choose an option based on your preferred location, budget and stay requirements.",
    whyBookCopy:
      "Compare available stays by location, price and amenities, then choose the property that fits your travel requirements.",
    targetTemple: {
      name: "Prem Mandir Vrindavan",
      coords: TEMPLE_COORDS.PREM_MANDIR,
      address: "Raman Reti, Chhatikara Road, Vrindavan, Mathura, UP – 281121",
      darshanTimings:
        "Morning: 5:30 AM – 12:00 PM | Evening: 4:30 PM – 8:30 PM (Fountain Show: ~7:00 PM)",
      image: "/images/destinations/vrindavan/prem_mandir_night_hero.jpg",
    },
    h2Sections: [
      {
        id: "stays-near-prem-mandir",
        title: "Stays Near Prem Mandir",
        subtitle:
          "Find available hotels, guest houses and stays near Prem Mandir, Vrindavan with location, price and essential amenities.",
        filterKey: "all",
      },
      {
        id: "hotels-near-prem-mandir",
        title: "Hotels Near Prem Mandir, Vrindavan",
        subtitle:
          "Explore stays located near Prem Mandir and compare starting prices, distance and available amenities before booking.",
        filterKey: "hotel",
      },
      {
        id: "budget-stays-near-prem-mandir",
        title: "Budget Stays Near Prem Mandir",
        subtitle:
          "Find budget-friendly stays near Prem Mandir with options suitable for short pilgrim and family visits.",
        filterKey: "budget",
      },
      {
        id: "family-stays-near-prem-mandir",
        title: "Family Stays Near Prem Mandir",
        subtitle:
          "Explore family-friendly stays near Prem Mandir with suitable rooms and essential amenities for your visit to Vrindavan.",
        filterKey: "family",
      },
      {
        id: "why-book-with-tirvona",
        title: "Why Book Your Stay with Tirvona?",
        subtitle:
          "Compare available stays by location, price and amenities, then choose the property that fits your travel requirements.",
      },
    ],
    internalLinks: [
      {
        title: "All Stays in Vrindavan",
        to: "/ashrams/vrindavan",
        tag: "Complete Selection",
        description:
          "View all verified hotels, dharamshalas, and guest houses in Vrindavan.",
        image:
          "https://images.unsplash.com/photo-1627894483216-2138af692e32?w=600&q=80",
      },
      {
        title: "Stays Near Banke Bihari Temple",
        to: "/stays-near-banke-bihari-vrindavan",
        tag: "Historical Heritage",
        description:
          "Convenient accommodation options near the sacred Banke Bihari shrine.",
        image:
          "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600&q=80",
      },
      {
        title: "Stays Near ISKCON Vrindavan",
        to: "/stays-near-iskcon-vrindavan",
        tag: "Krishna Balaram",
        description:
          "Peaceful devotional guesthouses and stays near ISKCON Vrindavan.",
        image:
          "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80",
      },
      {
        title: "Family Stays in Vrindavan",
        to: "/family-stays-in-vrindavan",
        tag: "Family Comfort",
        description:
          "Family suites and multi-bed rooms designed for pilgrim families.",
        image:
          "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=600&q=80",
      },
    ],
    faqs: [
      {
        q: "Where can I stay near Prem Mandir Vrindavan?",
        a: "You can stay at verified hotels, guest houses, and dharamshalas near Prem Mandir in Vrindavan including Prem Mandir Dharamshala, Hotel Krishna Anandam, Sukhram Dham, and Hotel Shakun Palace.",
      },
      {
        q: "Are budget stays available near Prem Mandir?",
        a: "Yes, budget stays including pilgrim dharamshalas and clean guest houses are available near Prem Mandir with tariffs starting from ₹200 to ₹1500 per night.",
      },
      {
        q: "What are the timings of Prem Mandir Vrindavan?",
        a: "Prem Mandir opens for morning darshan from 5:30 AM to 12:00 PM and evening darshan from 4:30 PM to 8:30 PM. The musical fountain show runs from ~7:00 PM to 7:30 PM daily.",
      },
      {
        q: "Is parking available at stays near Prem Mandir?",
        a: "Yes, major ashrams and stays on Raman Reti and Chhatikara Road provide dedicated car parking on-site. You can filter by 'Parking Available' on Tirvona.",
      },
    ],
  },

  iskcon: {
    id: "iskcon",
    route: "/stays-near-iskcon-vrindavan",
    canonicalUrl: "https://www.tirvona.com/stays-near-iskcon-vrindavan",
    title: "Hotels Near ISKCON Vrindavan Temple | Tirvona",
    metaDescription:
      "Find hotels and stays near ISKCON Vrindavan Temple. Compare prices, location, amenities and available rooms on Tirvona.",
    h1: "Stays Near ISKCON Vrindavan",
    heroCopy:
      "Planning a visit to ISKCON Vrindavan? Explore available stays near the temple and compare location, starting price and amenities before booking with Tirvona.",
    listingCopy:
      "Browse available stays near ISKCON Vrindavan and choose an option based on your preferred location, budget and stay requirements.",
    whyBookCopy:
      "Compare available stays by location, price and amenities, then choose the property that fits your travel requirements.",
    targetTemple: {
      name: "ISKCON Krishna Balaram Temple",
      coords: TEMPLE_COORDS.ISKCON,
      address: "Bhaktivedanta Swami Marg, Raman Reti, Vrindavan, UP – 281121",
      darshanTimings:
        "Mangala Aarti: 4:30 AM | Darshan: 5:00 AM – 12:45 PM & 4:30 PM – 8:30 PM",
      image:
        "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80",
    },
    h2Sections: [
      {
        id: "stays-near-iskcon-vrindavan",
        title: "Stays Near ISKCON Vrindavan",
        subtitle:
          "Find available hotels, guest houses and stays near ISKCON Vrindavan with location, price and essential amenities.",
        filterKey: "all",
      },
      {
        id: "hotels-near-iskcon-temple",
        title: "Hotels Near ISKCON Temple, Vrindavan",
        subtitle:
          "Explore stays near ISKCON Temple and compare starting prices, distance and available amenities before booking.",
        filterKey: "hotel",
      },
      {
        id: "budget-stays-near-iskcon",
        title: "Budget Stays Near ISKCON Vrindavan",
        subtitle:
          "Find budget-friendly stays near ISKCON Vrindavan with options suitable for short pilgrim and family visits.",
        filterKey: "budget",
      },
      {
        id: "family-stays-near-iskcon",
        title: "Family Stays Near ISKCON Vrindavan",
        subtitle:
          "Explore family-friendly stays near ISKCON Vrindavan with suitable rooms and essential amenities for your visit.",
        filterKey: "family",
      },
      {
        id: "why-book-with-tirvona",
        title: "Why Book Your Stay with Tirvona?",
        subtitle:
          "Compare available stays by location, price and amenities, then choose the property that fits your travel requirements.",
      },
    ],
    internalLinks: [
      {
        title: "All Stays in Vrindavan",
        to: "/ashrams/vrindavan",
        tag: "All Accommodations",
        description:
          "Browse all verified hotels, ashrams, and guesthouses in Vrindavan.",
        image:
          "https://images.unsplash.com/photo-1627894483216-2138af692e32?w=600&q=80",
      },
      {
        title: "Stays Near Prem Mandir",
        to: "/Stays-near-prem-mandir-vrindavan",
        tag: "Close to Raman Reti",
        description:
          "Verified hotels and dharamshalas situated close to Prem Mandir.",
        image: "/images/destinations/vrindavan/prem_mandir_night_hero.jpg",
      },
      {
        title: "Stays Near Banke Bihari",
        to: "/stays-near-banke-bihari-vrindavan",
        tag: "Central Vrindavan",
        description:
          "Accommodations close to the vibrant Banke Bihari market and temple.",
        image:
          "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600&q=80",
      },
      {
        title: "Budget Stays in Vrindavan",
        to: "/budget-stays-in-vrindavan",
        tag: "Under ₹1000",
        description:
          "Explore affordable rooms and pilgrim stays near ISKCON and Raman Reti.",
        image:
          "https://images.unsplash.com/photo-1609766857041-ed402ea8069a?w=600&q=80",
      },
    ],
    faqs: [
      {
        q: "What guesthouses are near ISKCON Vrindavan?",
        a: "Popular accommodations near ISKCON include MVT Guesthouse, ISKCON Vrindavan Guesthouse, and private hotels along Bhaktivedanta Swami Marg.",
      },
      {
        q: "Can I attend Mangala Aarti easily if I stay near ISKCON?",
        a: "Yes! Staying along Raman Reti or Bhaktivedanta Swami Marg allows you to reach the temple within 5 to 10 minutes walking for 4:30 AM Mangala Aarti.",
      },
      {
        q: "Are pure vegetarian prasad meals available near ISKCON?",
        a: "Yes, ISKCON Govinda's Restaurant and multiple satvik vegetarian restaurants are located directly adjacent to the temple premises.",
      },
    ],
  },

  budget: {
    id: "budget",
    route: "/budget-stays-in-vrindavan",
    canonicalUrl: "https://www.tirvona.com/budget-stays-in-vrindavan",
    title: "Budget Hotels & Stays in Vrindavan | Tirvona",
    metaDescription:
      "Find budget hotels and stays in Vrindavan. Compare affordable options by price, location, amenities and availability on Tirvona.",
    h1: "Budget Stays in Vrindavan",
    heroCopy:
      "Looking for an affordable stay in Vrindavan? Explore available budget hotels and rooms, then compare price, location and amenities on Tirvona.",
    listingCopy:
      "Browse available budget stays in Vrindavan and choose an option based on your preferred price, location and stay requirements.",
    whyBookCopy:
      "Compare available stays by price, location and amenities, then choose the property that fits your travel requirements.",
    h2Sections: [
      {
        id: "budget-stays-in-vrindavan",
        title: "Budget Stays in Vrindavan",
        subtitle:
          "Find affordable hotels, guest houses and stays in Vrindavan with location, price and essential amenities.",
        filterKey: "budget",
      },
      {
        id: "budget-hotels-in-vrindavan",
        title: "Budget Hotels in Vrindavan",
        subtitle:
          "Explore budget hotels in Vrindavan and compare starting prices, location and available amenities before booking.",
        filterKey: "hotel",
      },
      {
        id: "cheap-rooms-in-vrindavan",
        title: "Cheap Rooms in Vrindavan",
        subtitle:
          "Browse available rooms in Vrindavan across different price ranges and choose an option that fits your budget.",
        filterKey: "budget",
      },
      {
        id: "rooms-under-1000-in-vrindavan",
        title: "Rooms Under ₹1000 in Vrindavan",
        subtitle:
          "Explore available stays that fit a lower budget and compare prices, location and essential amenities.",
        filterKey: "under_1000",
      },
      {
        id: "budget-stays-near-popular-temples",
        title: "Budget Stays Near Popular Temples",
        subtitle:
          "Find budget-friendly stays near Banke Bihari Temple, Prem Mandir and ISKCON Vrindavan based on location and availability.",
        filterKey: "popular_temples",
      },
      {
        id: "why-book-with-tirvona",
        title: "Why Book Your Stay with Tirvona?",
        subtitle:
          "Compare available stays by price, location and amenities, then choose the property that fits your travel requirements.",
      },
    ],
    internalLinks: [
      {
        title: "All Stays in Vrindavan",
        to: "/ashrams/vrindavan",
        tag: "Complete Directory",
        description:
          "View full inventory across hotels, guest houses, and ashrams in Vrindavan.",
        image:
          "https://images.unsplash.com/photo-1627894483216-2138af692e32?w=600&q=80",
      },
      {
        title: "Stays Near Banke Bihari",
        to: "/stays-near-banke-bihari-vrindavan",
        tag: "Heritage Darshan",
        description:
          "Budget and pilgrim stays located close to Banke Bihari Temple.",
        image:
          "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600&q=80",
      },
      {
        title: "Stays Near Prem Mandir",
        to: "/Stays-near-prem-mandir-vrindavan",
        tag: "Evening Lights",
        description:
          "Affordable accommodation near Prem Mandir on Raman Reti Road.",
        image: "/images/destinations/vrindavan/prem_mandir_night_hero.jpg",
      },
      {
        title: "Family Stays in Vrindavan",
        to: "/family-stays-in-vrindavan",
        tag: "Family Group Rooms",
        description:
          "Spacious family rooms and multi-bed stays with essential amenities.",
        image:
          "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=600&q=80",
      },
    ],
    faqs: [
      {
        q: "What is the starting price for stays in Vrindavan on Tirvona?",
        a: "Starting prices for verified budget stays on Tirvona begin from as low as ₹200 to ₹450 per night for pilgrim rooms and dharamshalas.",
      },
      {
        q: "Are rooms under ₹1000 in Vrindavan clean and verified?",
        a: "Yes, all budget properties on Tirvona undergo official verification to ensure clean bedding, functioning attached bathrooms, and secure locking.",
      },
      {
        q: "Do budget hotels in Vrindavan have air conditioning?",
        a: "Many budget stays offer both AC and Non-AC room categories. You can filter for AC rooms directly within our stay listing.",
      },
    ],
  },

  family: {
    id: "family",
    route: "/family-stays-in-vrindavan",
    canonicalUrl: "https://www.tirvona.com/family-stays-in-vrindavan",
    title: "Family Hotels & Stays in Vrindavan | Tirvona",
    metaDescription:
      "Find family-friendly hotels and stays in Vrindavan. Compare rooms, prices, locations, amenities and availability on Tirvona.",
    h1: "Family Stays in Vrindavan",
    heroCopy:
      "Planning a family visit to Vrindavan? Explore family-friendly stays and compare room options, location, starting price and amenities before booking with Tirvona.",
    listingCopy:
      "Browse available family stays in Vrindavan and choose an option based on your preferred location, budget, room requirements and amenities.",
    whyBookCopy:
      "Compare available family stays by location, price and amenities, then choose the property that fits your travel requirements.",
    h2Sections: [
      {
        id: "family-stays-in-vrindavan",
        title: "Family Stays in Vrindavan",
        subtitle:
          "Find family-friendly hotels, guest houses and stays in Vrindavan with suitable rooms, location and essential amenities.",
        filterKey: "family",
      },
      {
        id: "family-hotels-in-vrindavan",
        title: "Family Hotels in Vrindavan",
        subtitle:
          "Explore family hotels in Vrindavan and compare starting prices, room options, location and available amenities.",
        filterKey: "hotel",
      },
      {
        id: "budget-family-stays-in-vrindavan",
        title: "Budget Family Stays in Vrindavan",
        subtitle:
          "Find budget-friendly family stays in Vrindavan with options suitable for short pilgrim and family visits.",
        filterKey: "budget",
      },
      {
        id: "family-stays-near-prem-mandir",
        title: "Family Stays Near Prem Mandir",
        subtitle:
          "Explore family-friendly stays near Prem Mandir and compare location, starting price and essential amenities.",
        filterKey: "near_prem_mandir",
      },
      {
        id: "family-stays-near-popular-temples",
        title: "Family Stays Near Popular Temples",
        subtitle:
          "Find family-friendly stays near Banke Bihari Temple, Prem Mandir and ISKCON Vrindavan based on location and availability.",
        filterKey: "popular_temples",
      },
      {
        id: "why-book-with-tirvona",
        title: "Why Book Your Stay with Tirvona?",
        subtitle:
          "Compare available family stays by location, price and amenities, then choose the property that fits your travel requirements.",
      },
    ],
    internalLinks: [
      {
        title: "All Stays in Vrindavan",
        to: "/ashrams/vrindavan",
        tag: "Browse All",
        description:
          "Explore all hotels, spiritual ashrams, and guesthouses in Vrindavan.",
        image:
          "https://images.unsplash.com/photo-1627894483216-2138af692e32?w=600&q=80",
      },
      {
        title: "Stays Near Prem Mandir",
        to: "/Stays-near-prem-mandir-vrindavan",
        tag: "Walk to Prem Mandir",
        description:
          "Family stays located close to Prem Mandir with easy parking and dining.",
        image: "/images/destinations/vrindavan/prem_mandir_night_hero.jpg",
      },
      {
        title: "Stays Near Banke Bihari",
        to: "/stays-near-banke-bihari-vrindavan",
        tag: "Devotional Heart",
        description:
          "Family guesthouses and hotels with convenient access to Banke Bihari.",
        image:
          "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600&q=80",
      },
      {
        title: "Budget Stays in Vrindavan",
        to: "/budget-stays-in-vrindavan",
        tag: "Affordable Stays",
        description:
          "Affordable family accommodations and economical rooms under ₹1000.",
        image:
          "https://images.unsplash.com/photo-1609766857041-ed402ea8069a?w=600&q=80",
      },
    ],
    faqs: [
      {
        q: "What family amenities do stays in Vrindavan provide?",
        a: "Family stays on Tirvona feature 3-bed or 4-bed family rooms, attached bathrooms with 24/7 hot water geysers, air-conditioning, elevator access for elders, and secure car parking.",
      },
      {
        q: "Are family stays suitable for senior citizens and kids?",
        a: "Yes, properties with elevator/lift access, ground floor rooms, and wheelchair assistance are clearly marked on Tirvona to support traveling with elderly parents and children.",
      },
      {
        q: "Can we find pure vegetarian dining for families?",
        a: "Yes, the majority of listed properties serve or are situated directly next to 100% Satvik pure vegetarian Gujarati, Marwari, and Braj dining halls.",
      },
    ],
  },
};
