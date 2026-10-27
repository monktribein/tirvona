import type React from "react";
import { BedDouble, CircleParking, Flame, HandHeart, Landmark, ShoppingBag, Utensils } from "lucide-react";

/**
 * The seven core Tirvona services, in one place, so the homepage, the header and any future page
 * describe and link them the same way. Every `to` is an existing, working route; every highlight
 * describes something the service already does.
 */
export interface TirvonaService {
  id: "temples" | "stays" | "food" | "parking" | "pandit" | "marketplace" | "volunteer";
  /** Full name used on cards. */
  name: string;
  /** Short name for the header and chips. */
  navLabel: string;
  tagline: string;
  description: string;
  highlights: string[];
  cta: string;
  to: string;
  /** Other paths that belong to this service (for "active" states in navigation). */
  matches: string[];
  image: string;
  imageAlt: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  /** A single signature tint per service, used sparingly (icon badge). */
  tint: string;
}

export const TIRVONA_SERVICES: TirvonaService[] = [
  {
    id: "temples",
    name: "Temples & Destinations",
    navLabel: "Temples",
    tagline: "Where every yatra begins",
    description: "Explore sacred temples with their aarti timings and festivals, and the pilgrim towns around them.",
    highlights: ["Temple guides", "Sacred destinations"],
    cta: "Explore temples",
    to: "/temples",
    matches: ["/temples", "/destination"],
    image: "/images/home/service-temples.jpg",
    imageAlt: "Prem Mandir in Vrindavan, illuminated at night",
    icon: Landmark,
    tint: "#8C1D40",
  },
  {
    id: "stays",
    name: "Sacred Stays",
    navLabel: "Stays",
    tagline: "Rest close to the divine",
    description: "Verified ashrams, dharamshalas and homestays near the temples you came to see.",
    highlights: ["Ashrams & dharamshalas", "Day rest by the hour"],
    cta: "Find a stay",
    to: "/search",
    matches: ["/search", "/stays", "/ashrams", "/ashram/", "/stay/"],
    image: "/images/home/service-stays.jpg",
    imageAlt: "Marigold-lined courtyard of an ashram in Vrindavan",
    icon: BedDouble,
    tint: "#F28C28",
  },
  {
    id: "food",
    name: "Sattvik Food",
    navLabel: "Food",
    tagline: "Pure meals, wherever you stay",
    description: "Thalis, bowls and combos from trusted kitchens, for pickup or delivered to your stay.",
    highlights: ["Thalis & meal combos", "Delivery to your stay"],
    cta: "Order food",
    to: "/food",
    matches: ["/food", "/restaurants"],
    image: "/images/home/service-food.jpg",
    imageAlt: "A vegetarian thali with dal, rice and naan",
    icon: Utensils,
    tint: "#C8901E",
  },
  {
    id: "pandit",
    name: "Pandit & Puja",
    navLabel: "Pandit & Puja",
    tagline: "Rituals done right",
    description: "Book a verified pandit for a puja in person or live online, or a jyotish consultation.",
    highlights: ["Verified pandits", "In person or online"],
    cta: "Book a pandit",
    to: "/pandits",
    matches: ["/pandits", "/pandit", "/providers", "/provider/"],
    image: "/images/home/service-pandit.jpg",
    imageAlt: "A pandit performing a havan before a temple",
    icon: Flame,
    tint: "#B4441C",
  },
  {
    id: "parking",
    name: "Parking",
    navLabel: "Parking",
    tagline: "Arrive without the worry",
    description: "Reserve a parking slot near temples and stays before you set out.",
    highlights: ["Reserve ahead", "QR entry pass"],
    cta: "Reserve parking",
    to: "/parking",
    matches: ["/parking"],
    image: "/images/home/service-parking.jpg",
    imageAlt: "A well-lit car park beside a temple at dusk",
    icon: CircleParking,
    tint: "#0B192C",
  },
  {
    id: "marketplace",
    name: "Spiritual Marketplace",
    navLabel: "Marketplace",
    tagline: "Sacred essentials, delivered",
    description: "Puja samagri, books and sacred essentials from verified sellers.",
    highlights: ["Verified sellers", "Delivered home"],
    cta: "Shop now",
    to: "/marketplace",
    matches: ["/marketplace"],
    image: "/images/home/service-marketplace.jpg",
    imageAlt: "Brass diyas, incense, rudraksha and a Ganesha idol by the ghats",
    icon: ShoppingBag,
    tint: "#8B5E34",
  },
  {
    id: "volunteer",
    name: "Volunteer & Seva",
    navLabel: "Seva",
    tagline: "Give back where you pray",
    description: "Find seva and volunteer roles at ashrams and temples, some with stay and meals.",
    highlights: ["Seva at ashrams", "Stay & meals on some roles"],
    cta: "Find seva",
    to: "/volunteer",
    matches: ["/volunteer", "/careers"],
    image: "/images/home/service-volunteer.jpg",
    imageAlt: "An ashram on the ghats in Rishikesh",
    icon: HandHeart,
    tint: "#3F7D58",
  },
];

/** True when `pathname` belongs to the service. */
export const isServiceActive = (service: TirvonaService, pathname: string) =>
  service.matches.some((path) => (path.endsWith("/") ? pathname.startsWith(path) : pathname === path || pathname.startsWith(`${path}/`)));
