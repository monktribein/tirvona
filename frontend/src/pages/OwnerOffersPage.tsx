import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Tag, 
  Plus, 
  Sparkles, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  TrendingUp, 
  Percent, 
  Flame, 
  AlertCircle,
  Building,
  ArrowRight,
  Eye
} from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

export const OwnerOffersPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const [offers, setOffers] = useState<any[]>([]);
  const [ashrams, setAshrams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    ashramId: '',
    title: '',
    offerType: 'Kumbh Mela',
    discountPercentage: 20,
    isRateUpgrade: false,
    promoCode: 'KUMBH2026',
    bannerText: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('ab_token') || localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch owner ashrams
      const ashramRes = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ashrams/my-listings/all`,
        { headers }
      );
      if (ashramRes.data.success && ashramRes.data.data.length > 0) {
        setAshrams(ashramRes.data.data);
        setFormData(prev => ({ ...prev, ashramId: ashramRes.data.data[0]._id }));
      }

      // Fetch offers
      const offersRes = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/offers/my-offers`,
        { headers }
      );
      if (offersRes.data.success) {
        setOffers(offersRes.data.data);
      }
    } catch (err) {
      console.error('Fetch offers error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ashramId) {
      addNotification('Error', 'Please select an Ashram to apply this offer to.', 'error');
      return;
    }

    setSubmitLoading(true);
    try {
      const token = localStorage.getItem('ab_token') || localStorage.getItem('token');
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/offers`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        addNotification('Offer Banner Published!', 'Your offer banner is now live on the landing page.', 'success');
        setShowAddModal(false);
        fetchInitialData();
      }
    } catch (err) {
      console.error('Create offer error:', err);
      addNotification('Error', 'Failed to publish offer banner.', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('ab_token') || localStorage.getItem('token');
      const res = await axios.put(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/offers/${id}`,
        { isActive: !currentStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        addNotification('Status Updated', `Offer is now ${!currentStatus ? 'Active' : 'Disabled'}.`, 'success');
        fetchInitialData();
      }
    } catch (err) {
      console.error('Toggle offer error:', err);
    }
  };

  const handleDeleteOffer = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this offer banner?')) return;
    try {
      const token = localStorage.getItem('ab_token') || localStorage.getItem('token');
      const res = await axios.delete(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/offers/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        addNotification('Offer Deleted', 'Offer banner removed successfully.', 'info');
        fetchInitialData();
      }
    } catch (err) {
      console.error('Delete offer error:', err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] rounded-[28px] p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 backdrop-blur-md">
            <Flame size={14} className="animate-pulse" /> Festival & Peak Pricing Manager
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">Ashram Special Offers & Banners</h1>
          <p className="text-xs sm:text-sm text-gray-200 max-w-2xl font-medium">
            Create Kumbh Mela, Ardhkumbh, Weekend, and Festival deals with 20%-30% rate upgrades or discounts that display live on the home landing page.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#E58C28] hover:bg-[#d47d1f] text-white font-extrabold text-xs sm:text-sm px-6 py-3.5 rounded-full flex items-center justify-center gap-2 shadow-lg shadow-black/20 transition-all cursor-pointer shrink-0 active:scale-95"
        >
          <Plus size={16} />
          <span>Create New Offer</span>
        </button>
      </div>

      {/* Stats Quick Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Active Banners</div>
          <div className="text-2xl font-black text-[#0B192C] dark:text-white flex items-center gap-2">
            <span>{offers.filter(o => o.isActive).length}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Live</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Kumbh & Mela Deals</div>
          <div className="text-2xl font-black text-amber-500 flex items-center gap-2">
            <span>{offers.filter(o => o.offerType?.includes('Kumbh')).length}</span>
            <Flame size={18} className="text-amber-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Discounts & Upgrades</div>
          <div className="text-2xl font-black text-[#0A4DA6] dark:text-amber-400 flex items-center gap-2">
            <span>20% - 30%</span>
            <Percent size={18} />
          </div>
        </div>
      </div>

      {/* Offers List Grid */}
      {loading ? (
        <div className="h-48 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl animate-pulse" />
      ) : offers.length === 0 ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-sm">
          <Tag size={48} className="mx-auto text-gray-300 dark:text-gray-600" />
          <h3 className="text-lg font-black text-[#0B192C] dark:text-white">No Offers Created Yet</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            Promote your Ashram during Kumbh Mela, Ardhkumbh, or Weekends by creating special discount packages!
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-[#0A4DA6] text-white font-extrabold text-xs rounded-full shadow-md"
          >
            Create Offer Banner Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {offers.map((offer) => (
            <div
              key={offer._id}
              className={`bg-white dark:bg-[#0B192C] border rounded-[28px] p-6 shadow-sm flex flex-col justify-between space-y-5 transition-all ${
                offer.isActive ? 'border-amber-500/30 dark:border-amber-500/20' : 'border-gray-100 dark:border-slate-800 opacity-70'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                    offer.offerType === 'Kumbh Mela' || offer.offerType === 'Ardhkumbh Mela'
                      ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                      : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                  }`}>
                    <Flame size={12} />
                    {offer.offerType}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(offer._id, offer.isActive)}
                      className={`px-3 py-1 rounded-full text-xs font-extrabold cursor-pointer border transition-all ${
                        offer.isActive
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20'
                          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {offer.isActive ? '● Live' : '○ Disabled'}
                    </button>

                    <button
                      onClick={() => handleDeleteOffer(offer._id)}
                      className="p-1.5 rounded-full text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors cursor-pointer"
                      title="Delete Offer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white flex items-center gap-2">
                    {offer.title}
                  </h3>
                  <p className="text-xs text-gray-400 font-semibold mt-0.5">
                    {offer.ashramId?.name || 'Ashram Special'}
                  </p>
                </div>

                <div className="bg-gradient-to-r from-amber-500/10 to-blue-500/10 border border-amber-500/20 rounded-2xl p-3 text-xs font-semibold text-slate-700 dark:text-slate-200 leading-relaxed">
                  "{offer.bannerText}"
                </div>

                <div className="flex items-center gap-4 text-xs font-bold pt-1">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <Percent size={14} />
                    <span>{offer.discountPercentage}% {offer.isRateUpgrade ? 'Rate Upgrade / Surge' : 'Discount OFF'}</span>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[#0A4DA6] dark:text-amber-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 rounded-lg border border-blue-100 dark:border-blue-800">
                    <Tag size={12} />
                    <span>Code: {offer.promoCode}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-50 dark:border-slate-850 flex items-center justify-between text-[11px] font-bold text-gray-400">
                <div className="flex items-center gap-1">
                  <Calendar size={12} />
                  <span>Valid: {new Date(offer.startDate).toLocaleDateString()} - {new Date(offer.endDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════ CREATE OFFER MODAL ══════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-xl bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl z-10 space-y-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                  <Flame size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">Create Festival / Peak Offer</h3>
                  <p className="text-xs text-gray-400">Banner will publish live on the main landing page.</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer">
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateOffer} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Select Ashram</label>
                <select
                  required
                  value={formData.ashramId}
                  onChange={(e) => setFormData({ ...formData, ashramId: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                >
                  {ashrams.map((a) => (
                    <option key={a._id} value={a._id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Offer Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kumbh Mela 2026 Special Package"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Offer Type</label>
                  <select
                    value={formData.offerType}
                    onChange={(e) => setFormData({ ...formData, offerType: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                  >
                    <option value="Kumbh Mela">Kumbh Mela</option>
                    <option value="Ardhkumbh Mela">Ardhkumbh Mela</option>
                    <option value="Weekend Special">Weekend Special</option>
                    <option value="Festival Deal">Festival Deal</option>
                    <option value="Seasonal Offer">Seasonal Offer</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Percentage (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={formData.discountPercentage}
                    onChange={(e) => setFormData({ ...formData, discountPercentage: Number(e.target.value) })}
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Offer Mode</label>
                  <select
                    value={formData.isRateUpgrade ? 'upgrade' : 'discount'}
                    onChange={(e) => setFormData({ ...formData, isRateUpgrade: e.target.value === 'upgrade' })}
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                  >
                    <option value="discount">Discount OFF (-%)</option>
                    <option value="upgrade">Rate Upgrade / Surge (+%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Promo Code</label>
                  <input
                    type="text"
                    required
                    placeholder="KUMBH2026"
                    value={formData.promoCode}
                    onChange={(e) => setFormData({ ...formData, promoCode: e.target.value.toUpperCase() })}
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Landing Page Banner Text</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Sacred Kumbh Mela Special: Enjoy 20% OFF on quiet sadhana stay & morning aarti!"
                  value={formData.bannerText}
                  onChange={(e) => setFormData({ ...formData, bannerText: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold rounded-2xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex-1 py-3 bg-[#E58C28] hover:bg-[#d47d1f] text-white font-extrabold rounded-2xl text-xs shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  {submitLoading ? 'Publishing...' : 'Publish Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerOffersPage;
