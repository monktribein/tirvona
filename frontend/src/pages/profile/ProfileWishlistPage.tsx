import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, MapPin, Star, ArrowLeft, Trash2, ExternalLink } from 'lucide-react';
import { EnterpriseButton } from '../../admin/shared';

export const ProfileWishlistPage: React.FC = () => {
  const wishlistItems = [
    {
      id: 'ashram-1',
      name: 'Swarg Ashram Divine Residency',
      city: 'Rishikesh, Uttarakhand',
      image: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=600&q=80',
      rating: 4.9,
      price: 1200,
    },
    {
      id: 'ashram-2',
      name: 'Parmarth Niketan Ashram',
      city: 'Rishikesh, Uttarakhand',
      image: 'https://images.unsplash.com/photo-1566438480900-0609be27a4be?auto=format&fit=crop&w=600&q=80',
      rating: 5.0,
      price: 800,
    },
    {
      id: 'ashram-3',
      name: 'Kashi Annapurna Heritage Bhavan',
      city: 'Varanasi, Uttar Pradesh',
      image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=600&q=80',
      rating: 4.8,
      price: 1500,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50/70 dark:bg-[#070F1B] pb-24 text-left">
      <section className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] text-white pt-10 pb-16 px-4 sm:px-6 lg:px-8 border-b border-white/10 relative overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-3 relative z-10">
          <Link to="/profile" className="inline-flex items-center gap-1.5 text-xs text-blue-200 hover:text-white font-bold mb-2">
            <ArrowLeft size={14} /> Back to Profile
          </Link>
          <h1 className="text-3xl font-black tracking-tight">
            Saved <span className="text-[#E58C28]">Wishlist Ashrams</span>
          </h1>
          <p className="text-xs text-blue-100/80 font-medium">Favorite spiritual stays saved for your future yatras.</p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {wishlistItems.map((item) => (
            <div key={item.id} className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] overflow-hidden shadow-lg space-y-3 p-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="relative h-44 w-full rounded-2xl overflow-hidden">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  <button className="absolute top-3 right-3 p-2 bg-white/90 dark:bg-[#0B192C]/90 text-rose-500 rounded-full shadow cursor-pointer">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div>
                  <h3 className="font-black text-base text-[#0B192C] dark:text-white leading-tight">{item.name}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1 font-medium"><MapPin size={12} className="text-[#E58C28]" /> {item.city}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center">
                <span className="text-base font-black text-[#0A4DA6]">₹{item.price} <span className="text-[10px] text-gray-400 font-normal">/night</span></span>
                <Link to="/search">
                  <EnterpriseButton variant="primary" size="sm">Book Now</EnterpriseButton>
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
