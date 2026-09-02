/**
 * Destination data models and seed data.
 *
 * Static destination metadata lives here. Live inventory (ashrams, parking,
 * prasad) is fetched from existing APIs at runtime – this file only provides
 * the structural "shell" that the page needs to render before API data arrives.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface DestinationCoordinates {
  lat: number;
  lng: number;
}

export interface DestinationStats {
  ashrams: number;
  stays: number;
  parking: number;
  prasad: number;
  places: number;
}

export interface NearbyPlace {
  id: string;
  name: string;
  category: string;
  description: string;
  coordinates: DestinationCoordinates;
  image?: string;
  availableOnTirvona: boolean;
  slug?: string;
  /** Optional external link for informational items */
  externalUrl?: string;
}

export interface Destination {
  id: string;
  slug: string;
  name: string;
  state: string;
  country: string;
  description: string;
  heroImage: string;
  coordinates: DestinationCoordinates;
  /** Fallback stats – overridden by live API counts when available */
  stats: DestinationStats;
  /** Attractions / nearby places curated for the destination */
  nearbyPlaces: NearbyPlace[];
}

// ── Seed Data ────────────────────────────────────────────────────────────────

const destinations: Destination[] = [
  {
    id: "haridwar",
    slug: "haridwar",
    name: "Haridwar",
    state: "Uttarakhand",
    country: "India",
    description:
      "One of the seven holiest cities in Hinduism, Haridwar is the gateway to the Char Dham pilgrimage. Located where the Ganges descends from the Himalayas onto the Indo-Gangetic plains, the city draws millions seeking spiritual purification.",
    heroImage:
      "https://images.unsplash.com/photo-1728060428780-9f89ed391b71?w=1400&q=80&auto=format&fit=crop",
    coordinates: { lat: 29.9457, lng: 78.1642 },
    stats: { ashrams: 24, stays: 48, parking: 12, prasad: 18, places: 32 },
    nearbyPlaces: [
      {
        id: "har-ki-pauri",
        name: "Har Ki Pauri",
        category: "Sacred Ghat",
        description:
          "The most sacred ghat in Haridwar, believed to bear the footprint of Lord Vishnu. The evening Ganga Aarti here is a soul-stirring experience.",
        coordinates: { lat: 29.9554, lng: 78.1689 },
        image: "/images/destinations/haridwar/har_ki_pauri.jpg",
        availableOnTirvona: false,
      },
      {
        id: "mansa-devi-temple",
        name: "Mansa Devi Temple",
        category: "Temple",
        description:
          "A revered hilltop temple dedicated to Goddess Mansa Devi atop Bilwa Parvat, offering panoramic views of Haridwar.",
        coordinates: { lat: 29.9682, lng: 78.1627 },
        image: "/images/destinations/haridwar/mansa_devi.jpg",
        availableOnTirvona: false,
      },
      {
        id: "chandi-devi-temple",
        name: "Chandi Devi Temple",
        category: "Temple",
        description:
          "Perched atop Neel Parvat on the Shivalik Hills, this ancient temple is part of the sacred Panch Tirth pilgrimage.",
        coordinates: { lat: 29.9699, lng: 78.1815 },
        image: "/images/destinations/haridwar/chandi_devi.jpg",
        availableOnTirvona: false,
      },
    ],
  },
  {
    id: "vrindavan",
    slug: "vrindavan",
    name: "Vrindavan",
    state: "Uttar Pradesh",
    country: "India",
    description:
      "The sacred land of Lord Krishna's childhood Leelas. Vrindavan is dotted with thousands of temples and ashrams, each resonating with devotion, kirtan, and the eternal love of Radha-Krishna.",
    heroImage:
      "https://images.unsplash.com/photo-1627894483216-2138af692e32?w=1400&q=80",
    coordinates: { lat: 27.5839, lng: 77.6979 },
    stats: { ashrams: 30, stays: 55, parking: 8, prasad: 22, places: 40 },
    nearbyPlaces: [
      {
        id: "prem-mandir",
        name: "Prem Mandir",
        category: "Temple",
        description:
          "A stunning white Italian marble temple depicting the divine love of Radha-Krishna. Beautifully illuminated in the evenings.",
        coordinates: { lat: 27.5657, lng: 77.685 },
        image: "/images/destinations/vrindavan/prem_mandir.jpg",
        availableOnTirvona: false,
      },
      {
        id: "banke-bihari",
        name: "Banke Bihari Temple",
        category: "Temple",
        description:
          "One of the most revered temples in Vrindavan, famous for the mesmerizing darshan of Lord Krishna as Banke Bihari.",
        coordinates: { lat: 27.5799, lng: 77.6995 },
        image: "/images/destinations/vrindavan/banke_bihari.jpg",
        availableOnTirvona: false,
      },
      {
        id: "iskcon-vrindavan",
        name: "ISKCON Vrindavan (Krishna Balaram Mandir)",
        category: "Temple / Ashram",
        description:
          "The Sri Sri Krishna-Balaram Mandir, established by Srila Prabhupada. A world-renowned centre of Gaudiya Vaishnavism.",
        coordinates: { lat: 27.5693, lng: 77.6894 },
        image: "/images/destinations/vrindavan/iskcon_vrindavan.jpg",
        availableOnTirvona: false,
      },
      {
        id: "govind-dev-temple",
        name: "Govind Dev Temple",
        category: "Temple",
        description:
          "Built by Raja Man Singh I of Jaipur in 1590, this temple is a masterpiece of historic red sandstone architecture.",
        coordinates: { lat: 27.5873, lng: 77.6963 },
        image: "/images/destinations/vrindavan/govind_dev.jpg",
        availableOnTirvona: false,
      },
    ],
  },
  {
    id: "mathura",
    slug: "mathura",
    name: "Mathura",
    state: "Uttar Pradesh",
    country: "India",
    description:
      "The birthplace of Lord Krishna, Mathura is one of the seven sacred cities in Hinduism. Steeped in mythology and living tradition, the city vibrates with devotional energy year-round.",
    heroImage:
      "/images/destinations/mathura/krishna_janmabhoomi.jpg",
    coordinates: { lat: 27.4924, lng: 77.6737 },
    stats: { ashrams: 18, stays: 35, parking: 10, prasad: 15, places: 28 },
    nearbyPlaces: [
      {
        id: "krishna-janmabhoomi",
        name: "Shri Krishna Janmabhoomi",
        category: "Temple / Heritage",
        description:
          "The sacred birthplace of Lord Krishna, featuring the magnificent temple complex, Keshavdeva shrine, and holy prison cell.",
        coordinates: { lat: 27.5045, lng: 77.6687 },
        image: "/images/destinations/mathura/krishna_janmabhoomi.jpg",
        availableOnTirvona: false,
      },
      {
        id: "dwarkadhish-temple",
        name: "Dwarkadhish Temple",
        category: "Temple",
        description:
          "A grand temple built in 1814, dedicated to Lord Krishna as the King of Dwarka. Known for spectacular Holi and Janmashtami celebrations.",
        coordinates: { lat: 27.505, lng: 77.6718 },
        image: "/images/destinations/mathura/dwarkadhish_temple.jpg",
        availableOnTirvona: false,
      },
      {
        id: "vishram-ghat",
        name: "Vishram Ghat",
        category: "Sacred Ghat",
        description:
          "The most sacred ghat on the Yamuna in Mathura. Lord Krishna is believed to have rested here after slaying Kansa.",
        coordinates: { lat: 27.5053, lng: 77.6737 },
        image: "/images/destinations/mathura/vishram_ghat.jpg",
        availableOnTirvona: false,
      },
      {
        id: "kusum-sarovar",
        name: "Kusum Sarovar",
        category: "Heritage / Ghat",
        description:
          "A beautiful historical water reservoir between Goverdhan and Radha Kund, surrounded by majestic carved sandstone cenotaphs.",
        coordinates: { lat: 27.5065, lng: 77.4707 },
        image: "/images/destinations/mathura/kusum_sarovar.jpg",
        availableOnTirvona: false,
      },
      {
        id: "govt-museum-mathura",
        name: "Government Museum, Mathura",
        category: "Museum",
        description:
          "One of India's foremost museums housing an extensive collection of Mathura school of art sculptures dating back 2000 years.",
        coordinates: { lat: 27.4945, lng: 77.6742 },
        image: "/images/destinations/mathura/govt_museum_mathura.jpg",
        availableOnTirvona: false,
      },
    ],
  },
  {
    id: "rishikesh",
    slug: "rishikesh",
    name: "Rishikesh",
    state: "Uttarakhand",
    country: "India",
    description:
      "Known as the Yoga Capital of the World, Rishikesh sits in the foothills of the Himalayas along the sacred Ganges. It is a haven for spiritual seekers, adventurers, and those seeking inner peace.",
    heroImage:
      "https://images.unsplash.com/photo-1588096344356-9b0f80f3cab5?w=1400&q=80&auto=format&fit=crop",
    coordinates: { lat: 30.0869, lng: 78.2676 },
    stats: { ashrams: 20, stays: 40, parking: 6, prasad: 10, places: 25 },
    nearbyPlaces: [
      {
        id: "triveni-ghat",
        name: "Triveni Ghat",
        category: "Sacred Ghat",
        description:
          "The most sacred ghat in Rishikesh where three holy rivers — Ganga, Yamuna, and Saraswati — are believed to converge. Famed for evening Maha Aarti.",
        coordinates: { lat: 30.1042, lng: 78.2947 },
        image: "/images/destinations/rishikesh/triveni_ghat.jpg",
        availableOnTirvona: false,
      },
      {
        id: "lakshman-jhula",
        name: "Lakshman Jhula",
        category: "Landmark / Bridge",
        description:
          "An iconic suspension bridge over the Ganges, believed to mark the spot where Laxmana crossed the river on a jute rope.",
        coordinates: { lat: 30.1225, lng: 78.3209 },
        image: "/images/destinations/rishikesh/lakshman_jhula.jpg",
        availableOnTirvona: false,
      },
      {
        id: "ram-jhula",
        name: "Ram Jhula",
        category: "Landmark / Bridge",
        description:
          "A sacred suspension bridge connecting Sivananda Ashram to Swargashram, offering stunning views of the Ganges.",
        coordinates: { lat: 30.1101, lng: 78.3095 },
        image: "/images/destinations/rishikesh/ram_jhula.jpg",
        availableOnTirvona: false,
      },
      {
        id: "parmarth-niketan",
        name: "Parmarth Niketan",
        category: "Ashram",
        description:
          "One of the largest ashrams in Rishikesh, famous for its evening Ganga Aarti and iconic meditative Shiva statue on the river.",
        coordinates: { lat: 30.1195, lng: 78.3165 },
        image: "/images/destinations/rishikesh/parmarth_niketan.jpg",
        availableOnTirvona: false,
      },
    ],
  },
  {
    id: "barsana",
    slug: "barsana",
    name: "Barsana",
    state: "Uttar Pradesh",
    country: "India",
    description:
      "The sacred village of Radha Rani, beloved of Lord Krishna. Barsana is famed for the colourful Lathmar Holi festival and the hilltop Radha Rani Temple, a jewel of Braj devotion.",
    heroImage:
      "https://images.unsplash.com/photo-1627894483216-2138af692e32?w=1400&q=80",
    coordinates: { lat: 27.6467, lng: 77.3768 },
    stats: { ashrams: 8, stays: 15, parking: 4, prasad: 10, places: 12 },
    nearbyPlaces: [],
  },
  {
    id: "govardhan",
    slug: "govardhan",
    name: "Govardhan",
    state: "Uttar Pradesh",
    country: "India",
    description:
      "Home of the sacred Govardhan Hill, which Lord Krishna lifted on his little finger. Millions of devotees perform the Govardhan Parikrama, a 21-km circumambulation of the hill.",
    heroImage:
      "https://images.unsplash.com/photo-1632852745063-6a4d60390b89?w=1400&q=80",
    coordinates: { lat: 27.4978, lng: 77.4624 },
    stats: { ashrams: 10, stays: 20, parking: 6, prasad: 12, places: 15 },
    nearbyPlaces: [],
  },
];

// ── Lookup helpers ───────────────────────────────────────────────────────────

export const getAllDestinations = (): Destination[] => destinations;

export const getDestinationBySlug = (
  slug: string,
): Destination | undefined => {
  const normalised = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return destinations.find(
    (d) => d.slug === normalised || d.id === normalised,
  );
};

export const getDestinationSlugs = (): string[] =>
  destinations.map((d) => d.slug);

export const createDynamicDestination = (
  slug: string,
  cityName: string,
  stateName = "India",
  coords?: DestinationCoordinates,
  heroImage?: string,
  description?: string,
): Destination => ({
  id: slug,
  slug,
  name: cityName,
  state: stateName,
  country: "India",
  description:
    description ||
    `Explore sacred ashrams, stays, secure parking, authentic prasad, and holy temples across ${cityName}, ${stateName} on Tirvona.`,
  heroImage:
    heroImage ||
    "https://images.unsplash.com/photo-1728060428780-9f89ed391b71?w=1400&q=80&auto=format&fit=crop",
  coordinates: coords || { lat: 28.6139, lng: 77.209 },
  stats: { ashrams: 0, stays: 0, parking: 0, prasad: 0, places: 0 },
  nearbyPlaces: [],
});
