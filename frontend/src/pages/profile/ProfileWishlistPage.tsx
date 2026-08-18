import React from "react";
import { Link } from "react-router-dom";
import {
  MapPin,
  Trash2,
} from "lucide-react";
import { EnterpriseButton } from "../../admin/shared";
import { formatCurrency } from "../../utils/format";

export const ProfileWishlistPage: React.FC = () => {
  const wishlistItems = [
    {
      id: "ashram-1",
      name: "Swarg Ashram Divine Residency",
      city: "Rishikesh, Uttarakhand",
      image:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E",
      rating: 4.9,
      price: 1200,
    },
    {
      id: "ashram-2",
      name: "Parmarth Niketan Ashram",
      city: "Rishikesh, Uttarakhand",
      image:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E",
      rating: 5.0,
      price: 800,
    },
    {
      id: "ashram-3",
      name: "Kashi Annapurna Heritage Bhavan",
      city: "Varanasi, Uttar Pradesh",
      image:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E",
      rating: 4.8,
      price: 1500,
    },
  ];

  return (
    <div className="min-h-screen pb-24 text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {wishlistItems.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] overflow-hidden shadow-lg space-y-3 p-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="relative h-44 w-full rounded-2xl overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                  <button className="absolute top-3 right-3 p-2 bg-white/90 dark:bg-[#0B192C]/90 text-rose-500 rounded-full shadow cursor-pointer">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div>
                  <h3 className="font-black text-base text-[#0B192C] dark:text-white leading-tight">
                    {item.name}
                  </h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1 font-medium">
                    <MapPin size={12} className="text-[#E58C28]" /> {item.city}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center">
                <span className="text-base font-black text-[#0A4DA6]">
                  {formatCurrency(item.price)}{" "}
                  <span className="text-[10px] text-gray-400 font-normal">
                    /night
                  </span>
                </span>
                <Link to="/search">
                  <EnterpriseButton variant="primary" size="sm">
                    Book Now
                  </EnterpriseButton>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfileWishlistPage;
