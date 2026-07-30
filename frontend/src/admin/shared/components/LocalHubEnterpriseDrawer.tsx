import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Info,
  Image as ImageIcon,
  DollarSign,
  Phone,
  Clock,
  ShieldCheck,
  Globe,
  Save,
  CheckCircle,
  MapPin,
  Compass,
} from 'lucide-react';
import ImageGalleryManager from './ImageGalleryManager';
import { useNotifications } from '../../../contexts/NotificationContext';

interface LocalHubEnterpriseDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: any | null;
  onSave: (data: any) => Promise<void> | void;
  categoryKey?: string;
}

export const LocalHubEnterpriseDrawer: React.FC<LocalHubEnterpriseDrawerProps> = ({
  isOpen,
  onClose,
  item,
  onSave,
  categoryKey = 'transport',
}) => {
  const { addNotification } = useNotifications();
  const [activeSection, setActiveSection] = useState<'basic' | 'images' | 'pricing' | 'contact' | 'availability' | 'verification' | 'seo'>('basic');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        _id: item._id || item.id,
        title: item.title || '',
        description: item.description || item.desc || '',
        category: item.category || categoryKey || 'transport',
        city: item.city || 'Varanasi',
        location: item.location || '',
        address: item.address || item.location || '',
        latitude: item.latitude || 25.3176,
        longitude: item.longitude || 82.9739,
        image: item.image || '',
        gallery: Array.isArray(item.gallery) ? item.gallery : (Array.isArray(item.images) ? item.images : []),
        price: item.price || 'Contact for Fare',
        discount: item.discount || 0,
        gst: item.gst || 5,
        phone: item.phone || '+91 98765 00000',
        email: item.email || '',
        website: item.website || '',
        openingHours: item.openingHours || '06:00 AM',
        closingHours: item.closingHours || '09:00 PM',
        weeklyOff: item.weeklyOff || 'None',
        badge: item.badge || 'VERIFIED OPERATOR',
        rating: item.rating || 4.9,
        isVerified: item.isVerified !== undefined ? item.isVerified : true,
        isFeatured: item.isFeatured !== undefined ? item.isFeatured : false,
        status: item.status || 'active',
        slug: item.slug || (item.title ? item.title.toLowerCase().replace(/\s+/g, '-') : ''),
        metaTitle: item.metaTitle || (item.title ? `${item.title} | Tirvona Services` : ''),
        metaDescription: item.metaDescription || (item.description ? item.description.substring(0, 160) : ''),
      });
    } else {
      setFormData({
        title: '',
        description: '',
        category: categoryKey || 'transport',
        city: 'Varanasi',
        location: '',
        address: '',
        latitude: 25.3176,
        longitude: 82.9739,
        image: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=600&q=80',
        gallery: [],
        price: '₹400 / transfer',
        discount: 0,
        gst: 5,
        phone: '+91 98765 00000',
        email: 'info@tirvona.com',
        website: 'https://tirvona.com',
        openingHours: '06:00 AM',
        closingHours: '09:00 PM',
        weeklyOff: 'None',
        badge: 'VERIFIED OPERATOR',
        rating: 4.9,
        isVerified: true,
        isFeatured: false,
        status: 'active',
        slug: '',
        metaTitle: '',
        metaDescription: '',
      });
    }
  }, [item, categoryKey, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        image: formData.image || (Array.isArray(formData.gallery) && formData.gallery[0]) || 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=600&q=80',
      };
      await onSave(payload);
      addNotification('Enterprise Manager Saved', `All 7 sections updated in MongoDB for ${payload.title || 'Service Item'}.`, 'success');
      onClose();
    } catch (err: any) {
      addNotification('Save Failed', err.message || 'Could not update record.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const sections = [
    { id: 'basic', label: '1. Basic Details', icon: Info },
    { id: 'images', label: '2. Image Management', icon: ImageIcon },
    { id: 'pricing', label: '3. Pricing', icon: DollarSign },
    { id: 'contact', label: '4. Contact', icon: Phone },
    { id: 'availability', label: '5. Availability', icon: Clock },
    { id: 'verification', label: '6. Verification', icon: ShieldCheck },
    { id: 'seo', label: '7. SEO', icon: Globe },
  ] as const;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex justify-end transition-opacity duration-300">
      <div className="bg-white dark:bg-[#0B192C] w-full max-w-4xl h-full flex flex-col shadow-2xl border-l border-gray-100 dark:border-slate-800 text-left animate-in slide-in-from-right duration-300">

        {/* Drawer Header */}
        <div className="p-6 bg-gray-50/80 dark:bg-slate-900/80 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#0A4DA6]/10 text-[#0A4DA6] rounded-2xl">
              <Compass size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#0A4DA6] text-white text-[10px] font-black uppercase">
                  {formData.category || 'Local Hub'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[10px] font-bold">
                  {formData.city || 'Location'}
                </span>
              </div>
              <h2 className="text-xl font-black text-[#0B192C] dark:text-white mt-1">
                {formData.title ? `Manage: ${formData.title}` : 'Create Local Service Listing'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-full font-bold text-xs cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="px-6 py-2.5 bg-[#0A4DA6] hover:bg-blue-900 text-white rounded-full font-black text-xs shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save size={15} />
              <span>{isSaving ? 'Saving to MongoDB...' : 'Save All Changes'}</span>
            </button>
          </div>
        </div>

        {/* Section Tabs Navigation Bar */}
        <div className="flex items-center gap-1 px-6 bg-white dark:bg-[#0B192C] border-b border-gray-100 dark:border-slate-800 overflow-x-auto scrollbar-none shrink-0">
          {sections.map((sec) => {
            const IconComp = sec.icon;
            const active = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`py-3.5 px-4 font-black text-xs border-b-2 transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                  active
                    ? 'border-[#0A4DA6] text-[#0A4DA6] dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <IconComp size={15} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Section Contents Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          
          {/* SECTION 1: BASIC DETAILS */}
          {activeSection === 'basic' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-2">
                <Info size={16} className="text-[#0A4DA6]" /> SECTION 1: Basic Service Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Service / Provider Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-[#0A4DA6]"
                  >
                    <option value="transport">Transport &amp; Cabs</option>
                    <option value="guides">Verified Guides</option>
                    <option value="food">Satvik Dining</option>
                    <option value="medical">Emergency &amp; Medical</option>
                    <option value="emergency">Emergency</option>
                    <option value="shops">Puja Shops &amp; Stores</option>
                    <option value="photography">Photography</option>
                    <option value="stays">Nearby Ashrams</option>
                    <option value="events">Aartis &amp; Events</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">City / Holy Destination *</label>
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold"
                  >
                    <option value="Varanasi">Varanasi (Kashi Dham)</option>
                    <option value="Haridwar">Haridwar</option>
                    <option value="Rishikesh">Rishikesh</option>
                    <option value="Ayodhya">Ayodhya</option>
                    <option value="Kedarnath">Kedarnath</option>
                    <option value="Ujjain">Ujjain</option>
                    <option value="Puri">Puri</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Location / Landmark *</label>
                  <input
                    type="text"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value, address: e.target.value })}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Latitude Coordinate</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Longitude Coordinate</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 dark:text-gray-300">Service Description *</label>
                <textarea
                  rows={4}
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* SECTION 2: IMAGE MANAGEMENT */}
          {activeSection === 'images' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-2">
                <ImageIcon size={16} className="text-[#0A4DA6]" /> SECTION 2: Enterprise Media &amp; Image Management
              </h3>

              <ImageGalleryManager
                coverImage={formData.image || ''}
                onCoverImageChange={(url) =>
                  setFormData((prev) => ({
                    ...prev,
                    image: url,
                  }))
                }
                gallery={formData.gallery || []}
                onGalleryChange={(urls) =>
                  setFormData((prev) => ({
                    ...prev,
                    gallery: urls,
                  }))
                }
                label="Local Service Photos, Cover Image &amp; Gallery Assets"
              />
            </div>
          )}

          {/* SECTION 3: PRICING */}
          {activeSection === 'pricing' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-2">
                <DollarSign size={16} className="text-[#0A4DA6]" /> SECTION 3: Service Pricing &amp; Tax Structure
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Base Fare / Display Price *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ₹400 / transfer"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-[#0A4DA6]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Pilgrim Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.discount}
                    onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Applicable GST (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="28"
                    value={formData.gst}
                    onChange={(e) => setFormData({ ...formData, gst: parseFloat(e.target.value) || 0 })}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: CONTACT */}
          {activeSection === 'contact' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-2">
                <Phone size={16} className="text-[#0A4DA6]" /> SECTION 4: Direct Contact &amp; Communication Channels
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Contact Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Official Email Address</label>
                  <input
                    type="email"
                    placeholder="support@serviceprovider.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Official Website URL</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: AVAILABILITY */}
          {activeSection === 'availability' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-2">
                <Clock size={16} className="text-[#0A4DA6]" /> SECTION 5: Operating Hours &amp; Schedule
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Opening Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 06:00 AM"
                    value={formData.openingHours}
                    onChange={(e) => setFormData({ ...formData, openingHours: e.target.value })}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Closing Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 09:00 PM"
                    value={formData.closingHours}
                    onChange={(e) => setFormData({ ...formData, closingHours: e.target.value })}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Weekly Off Day</label>
                  <select
                    value={formData.weeklyOff}
                    onChange={(e) => setFormData({ ...formData, weeklyOff: e.target.value })}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold"
                  >
                    <option value="None">Open All 7 Days (No Off)</option>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 6: VERIFICATION */}
          {activeSection === 'verification' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-2">
                <ShieldCheck size={16} className="text-[#0A4DA6]" /> SECTION 6: Verification, Badges &amp; Status Controls
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Verified Badge Text *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. VERIFIED OPERATOR / CERTIFIED SHASTRI"
                    value={formData.badge}
                    onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-[#0A4DA6]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Approval Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold"
                  >
                    <option value="active">Active &amp; Published</option>
                    <option value="draft">Draft / Suspended</option>
                    <option value="pending">Pending Approval</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl cursor-pointer">
                  <div>
                    <span className="font-extrabold text-xs block text-[#0B192C] dark:text-white">Is Ministry Verified</span>
                    <span className="text-[10px] text-gray-400 font-bold">Display verified tick badge on cards</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isVerified}
                    onChange={(e) => setFormData({ ...formData, isVerified: e.target.checked })}
                    className="w-5 h-5 accent-[#0A4DA6] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl cursor-pointer">
                  <div>
                    <span className="font-extrabold text-xs block text-[#0B192C] dark:text-white">Featured Listing</span>
                    <span className="text-[10px] text-gray-400 font-bold">Pin item to the top of search results</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isFeatured}
                    onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                    className="w-5 h-5 accent-[#0A4DA6] cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {/* SECTION 7: SEO */}
          {activeSection === 'seo' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-2">
                <Globe size={16} className="text-[#0A4DA6]" /> SECTION 7: Search Engine Optimization (SEO)
              </h3>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Custom URL Slug</label>
                  <input
                    type="text"
                    placeholder="e.g. haridwar-ac-innova-cab-hub"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-mono text-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Meta Title Tag</label>
                  <input
                    type="text"
                    placeholder="e.g. Book Haridwar to Rishikesh Cabs | Tirvona Services"
                    value={formData.metaTitle}
                    onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Meta Description Tag</label>
                  <textarea
                    rows={3}
                    placeholder="Brief 150-character summary for Google search snippet..."
                    value={formData.metaDescription}
                    onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl leading-relaxed"
                  />
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Drawer Footer */}
        <div className="p-4 bg-gray-50/80 dark:bg-slate-900/80 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center shrink-0">
          <p className="text-[11px] font-bold text-gray-400">
            Changes will update MongoDB Atlas immediately.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-full font-bold text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="px-6 py-2.5 bg-[#0A4DA6] hover:bg-blue-900 text-white rounded-full font-black text-xs shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save size={15} />
              <span>{isSaving ? 'Saving to MongoDB...' : 'Save All Changes'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LocalHubEnterpriseDrawer;
