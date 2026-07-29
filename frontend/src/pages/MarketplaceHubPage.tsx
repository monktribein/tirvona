import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShoppingBag,
  Sparkles,
  ShieldCheck,
  Search,
  Tag,
  Star,
  Check,
  ShoppingCart,
  ArrowRight,
  Filter,
  CheckCircle,
  Truck,
  RotateCcw,
  Plus,
  Minus,
  Trash2,
} from 'lucide-react';
import { marketplaceService, type MarketplaceProductItem } from '../services/marketplace.service';
import { useNotifications } from '../contexts/NotificationContext';
import { useMemory } from '../contexts/UserMemoryContext';
import { EnterpriseModal, EnterpriseButton, EnterpriseStatusBadge, EnterpriseSortDropdown, EnterpriseResetButton } from '../admin/shared';

export const MarketplaceHubPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addNotification } = useNotifications();
  const { updateMemoryCategory } = useMemory();

  const categoryParam = searchParams.get('category') || 'all';

  const [products, setProducts] = useState<MarketplaceProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(categoryParam);
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'rating');

  // Cart State
  const [cart, setCart] = useState<Array<{ product: MarketplaceProductItem; qty: number }>>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Checkout Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('Varanasi');
  const [state, setState] = useState('Uttar Pradesh');
  const [pincode, setPincode] = useState('221001');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cod' | 'card'>('upi');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const categories = [
    { id: 'all', label: 'All Products' },
    { id: 'prasad', label: 'Temple Prasad' },
    { id: 'rudraksha', label: 'Rudraksha Mala' },
    { id: 'tulsi_mala', label: 'Tulsi Mala' },
    { id: 'puja_kits', label: 'Puja Samagri Kits' },
    { id: 'murti', label: 'Brass & Copper Murti' },
    { id: 'ayurveda', label: 'Ayurveda & Organic' },
    { id: 'books', label: 'Sacred Books' },
    { id: 'temple_clothes', label: 'Temple Clothes' },
  ];

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, sortBy]);

  const fetchServices = async () => {}; // dummy placeholder if referenced

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Sync URL Params
      const paramsObj: Record<string, string> = {};
      if (selectedCategory !== 'all') paramsObj.category = selectedCategory;
      if (searchTerm) paramsObj.search = searchTerm;
      if (sortBy) paramsObj.sort = sortBy;
      setSearchParams(paramsObj);

      // Save to memory
      updateMemoryCategory('filters', {
        marketplaceCategory: selectedCategory,
        marketplaceSearch: searchTerm,
        marketplaceSort: sortBy,
      });

      const res = await marketplaceService.getProducts({
        category: selectedCategory,
        search: searchTerm,
        sortBy,
      });

      if (res.data?.success) {
        setProducts(res.data.data);
      }
    } catch (err) {
      console.error('Fetch products error:', err);
      addNotification('Load Error', 'Failed to fetch marketplace products from MongoDB.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSearchTerm('');
    setSortBy('rating');
    setSearchParams({});
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  const addToCart = (product: MarketplaceProductItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product._id === product._id);
      if (existing) {
        return prev.map((item) =>
          item.product._id === product._id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { product, qty: 1 }];
    });
    addNotification('Added to Cart', `${product.name} added to your cart!`, 'info');
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product._id !== productId));
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product._id === productId) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as Array<{ product: MarketplaceProductItem; qty: number }>
    );
  };

  const cartTotal = cart.reduce((acc, curr) => {
    const p = curr.product.salePrice || curr.product.price;
    return acc + p * curr.qty;
  }, 0);

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setIsPlacingOrder(true);
    try {
      const itemsPayload = cart.map((c) => ({
        productId: c.product._id,
        productName: c.product.name,
        price: c.product.salePrice || c.product.price,
        quantity: c.qty,
        templeSource: c.product.templeSource,
      }));

      const res = await marketplaceService.createOrder({
        items: itemsPayload,
        customerName: customerName || 'Sacred Pilgrim',
        customerPhone: customerPhone || '9876543210',
        shippingAddress: { street: streetAddress || 'Temple Road', city, state, pincode },
        totalAmount: cartTotal,
        paymentMethod,
      });

      if (res.data?.success) {
        addNotification('Order Confirmed', `Order ${res.data.data.orderNumber} placed successfully!`, 'success');
        setCart([]);
        setIsCheckoutOpen(false);
        setIsCartOpen(false);
      }
    } catch (err) {
      console.error('Order checkout error:', err);
      addNotification('Order Error', 'Failed to place order. Please try again.', 'error');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/70 dark:bg-[#070F1B] pb-24 text-left">
      {/* ── 1. Hero Header Banner ── */}
      <section className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] text-white py-12 px-4 sm:px-6 lg:px-8 border-b border-white/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-[#E58C28]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto space-y-4 relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-[#E58C28]/20 text-[#E58C28] border border-[#E58C28]/35 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                <ShieldCheck size={12} /> Temple Sanctified Products
              </span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Spiritual <span className="text-[#E58C28]">Marketplace</span>
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/90 font-medium leading-relaxed">
              Order authentic Temple Prasad, Lab-Certified Rudraksha, Vrindavan Tulsi Mala, Panchmukhi Brass Diyas, and Nitya Puja Samagri directly from sacred temple vendors.
            </p>
          </div>

          {/* Cart Floating Button */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="px-5 py-3 bg-[#E58C28] hover:bg-[#d67e1f] text-white font-extrabold rounded-full text-xs flex items-center gap-2 shadow-xl shadow-[#E58C28]/20 cursor-pointer transition-transform hover:scale-105 shrink-0"
          >
            <ShoppingCart size={16} />
            <span>Sacred Cart ({cart.reduce((a, b) => a + b.qty, 0)})</span>
          </button>
        </div>
      </section>

      {/* ── 2. Search & Category Filter Bar ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20 space-y-6">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-4 sm:p-5 shadow-xl space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex gap-3">
            <div className="relative flex-grow">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search Kashi Prasad, Rudraksha mala, Brass Diya, Bhagavad Gita..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full text-xs font-bold focus:outline-none focus:border-[#0A4DA6]"
              />
            </div>
            <EnterpriseButton type="submit" variant="primary" className="px-6 py-2.5 text-xs shrink-0">
              Search
            </EnterpriseButton>
          </form>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none pt-1">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat.id); setSearchParams({ category: cat.id }); }}
                  className={`px-4 py-2 rounded-full text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#0A4DA6] text-white shadow-md shadow-[#0A4DA6]/25'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Sort & Reset Toolbar */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-slate-800">
            <span className="text-xs font-bold text-gray-400">Filter & Sort Products</span>
            <div className="flex items-center gap-3">
              <EnterpriseSortDropdown value={sortBy} onChange={(val) => setSortBy(val)} />
              <EnterpriseResetButton onReset={handleResetFilters} />
            </div>
          </div>
        </div>

        {/* ── 3. Products Grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-72 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] space-y-4">
            <ShoppingBag className="mx-auto text-gray-300" size={48} />
            <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">No spiritual products found</h3>
            <p className="text-xs text-gray-400">Try changing your search keywords or category filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            {products.map((p) => (
              <div
                key={p._id}
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] overflow-hidden shadow-lg shadow-gray-200/40 dark:shadow-none hover:shadow-2xl transition-all duration-300 flex flex-col justify-between"
              >
                {/* Image Banner */}
                <div className="relative h-48 w-full bg-slate-900 overflow-hidden">
                  <img
                    src={p.images?.[0] || 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80'}
                    alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Temple Source Tag */}
                  <span className="absolute top-3 left-3 px-3 py-1 bg-white/90 dark:bg-[#0B192C]/90 text-[#0A4DA6] dark:text-white rounded-full text-[10px] font-black shadow-sm">
                    🏛️ {p.templeSource}
                  </span>

                  {/* Rating Tag */}
                  <div className="absolute top-3 right-3 px-2.5 py-1 bg-amber-400 text-slate-950 rounded-full text-xs font-black flex items-center gap-1 shadow-sm">
                    <Star size={12} className="fill-slate-950" />
                    <span>{p.rating.toFixed(1)}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4 flex-grow flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-600">
                      <ShieldCheck size={12} />
                      <span>{p.authenticityCertificate}</span>
                    </div>
                    <h3 className="font-black text-base text-[#0B192C] dark:text-white leading-tight">
                      {p.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium line-clamp-2">
                      {p.description}
                    </p>
                  </div>

                  {/* Pricing & Cart Button */}
                  <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-gray-400 block font-bold uppercase">Price (Incl. GST)</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-black text-[#0A4DA6] dark:text-white">
                          ₹{p.salePrice || p.price}
                        </span>
                        {p.salePrice && (
                          <span className="text-xs text-gray-400 line-through">₹{p.price}</span>
                        )}
                      </div>
                    </div>

                    <EnterpriseButton
                      variant="primary"
                      size="sm"
                      onClick={() => addToCart(p)}
                      className="gap-1.5"
                    >
                      <ShoppingCart size={14} /> Add to Cart
                    </EnterpriseButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 4. Cart Modal ── */}
      <EnterpriseModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        title="Your Sacred Cart"
        subtitle="Review selected spiritual products before checkout"
      >
        {cart.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <ShoppingBag className="mx-auto text-gray-300" size={36} />
            <p className="text-xs font-bold text-gray-400">Your cart is empty.</p>
          </div>
        ) : (
          <div className="space-y-4 text-xs font-bold">
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {cart.map((item) => (
                <div key={item.product._id} className="p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                  <div className="space-y-0.5 max-w-[60%]">
                    <h4 className="font-extrabold text-[#0B192C] dark:text-white truncate">{item.product.name}</h4>
                    <span className="text-[10px] text-gray-400 block">₹{item.product.salePrice || item.product.price} each</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={() => updateCartQty(item.product._id, -1)} className="p-1 rounded bg-gray-200 text-gray-700">
                      <Minus size={12} />
                    </button>
                    <span className="font-black text-sm">{item.qty}</span>
                    <button onClick={() => updateCartQty(item.product._id, 1)} className="p-1 rounded bg-gray-200 text-gray-700">
                      <Plus size={12} />
                    </button>
                    <button onClick={() => removeFromCart(item.product._id)} className="p-1 rounded text-red-500 hover:bg-red-50 ml-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-2xl flex justify-between items-center">
              <span className="font-extrabold text-[#0B192C] dark:text-white">Total Amount</span>
              <span className="text-base font-black text-[#0A4DA6]">₹{cartTotal}</span>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <EnterpriseButton variant="outline" onClick={() => setIsCartOpen(false)}>
                Close
              </EnterpriseButton>
              <EnterpriseButton variant="primary" onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}>
                Proceed to Checkout
              </EnterpriseButton>
            </div>
          </div>
        )}
      </EnterpriseModal>

      {/* ── 5. Checkout Modal ── */}
      <EnterpriseModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        title="Sacred Order Checkout"
        subtitle="Provide shipping address and payment option"
      >
        <form onSubmit={handleOrderSubmit} className="space-y-4 text-xs font-bold">
          <div className="space-y-1">
            <label className="text-gray-700 dark:text-gray-300">Customer Full Name *</label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Ramesh Sharma"
              className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <label className="text-gray-700 dark:text-gray-300">Phone Number *</label>
            <input
              type="tel"
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <label className="text-gray-700 dark:text-gray-300">Delivery Street Address *</label>
            <input
              type="text"
              required
              value={streetAddress}
              onChange={(e) => setStreetAddress(e.target.value)}
              placeholder="House/Flat No., Temple Street, Colony..."
              className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-gray-700 dark:text-gray-300 block mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
              />
            </div>
            <div>
              <label className="text-gray-700 dark:text-gray-300 block mb-1">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
              />
            </div>
            <div>
              <label className="text-gray-700 dark:text-gray-300 block mb-1">Pincode</label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-gray-700 dark:text-gray-300">Payment Option</label>
            <div className="grid grid-cols-3 gap-2">
              {(['upi', 'cod', 'card'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`p-2.5 border rounded-xl font-extrabold uppercase text-[10px] cursor-pointer transition-all ${
                    paymentMethod === m ? 'border-[#0A4DA6] bg-blue-50 text-[#0A4DA6]' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  {m === 'upi' ? '⚡ UPI / GPay' : m === 'cod' ? '💵 Cash on Delivery' : '💳 Credit/Debit Card'}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-2">
            <EnterpriseButton variant="outline" onClick={() => setIsCheckoutOpen(false)}>
              Cancel
            </EnterpriseButton>
            <EnterpriseButton type="submit" variant="primary" loading={isPlacingOrder}>
              Pay & Confirm Order ₹{cartTotal}
            </EnterpriseButton>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  );
};

export default MarketplaceHubPage;
