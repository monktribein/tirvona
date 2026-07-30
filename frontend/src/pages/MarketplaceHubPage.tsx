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

    const handleMarketplaceSync = () => {
      fetchProducts();
    };

    window.addEventListener('marketplace_updated', handleMarketplaceSync);
    return () => {
      window.removeEventListener('marketplace_updated', handleMarketplaceSync);
    };
  }, [selectedCategory, sortBy]);

  const fetchServices = async () => { }; // dummy placeholder if referenced

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
      {/* Hero Banner Header Container matching Navbar Layout Width */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-3">
        <div className="relative text-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl overflow-hidden min-h-[260px] sm:min-h-[300px] flex flex-col items-center justify-center text-center border border-white/10">
          {/* Background Banner Image */}
          <img
            src="/banner/marketplace.png"
            alt="Spiritual Marketplace Banner"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Overlay gradient for text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/40" />

          {/* Top Right Sacred Cart Button */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="absolute top-4 sm:top-6 right-4 sm:right-6 z-20 px-4 sm:px-5 py-2.5 bg-[#E58C28] hover:bg-[#d67e1f] text-white font-extrabold rounded-full text-xs flex items-center gap-2 shadow-xl shadow-[#E58C28]/30 cursor-pointer transition-transform hover:scale-105"
          >
            <ShoppingCart size={16} />
            <span>Sacred Cart ({cart.reduce((a, b) => a + b.qty, 0)})</span>
          </button>

          {/* Banner Content (Centered matching global Tirvona typography & color scheme) */}
          <div className="max-w-3xl space-y-2.5 relative z-10 mx-auto text-center my-auto pt-2 pb-4">
            <p className="font-['Kalam'] text-base sm:text-xl font-bold text-[#E58C28] drop-shadow-md">
              Temple Sanctified Products
            </p>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white leading-tight drop-shadow-lg" style={{ fontFamily: "Satoshi, 'General Sans', Manrope, Inter, sans-serif", letterSpacing: '-0.03em' }}>
              Spiritual <span className="text-[#D4AF37]">Marketplace</span>
            </h1>

            <p className="text-xs sm:text-sm lg:text-base text-gray-100 max-w-2xl mx-auto font-medium leading-relaxed drop-shadow">
              Order authentic Temple Prasad, Lab-Certified Rudraksha, Vrindavan Tulsi Mala, Panchmukhi Brass Diyas, and Nitya Puja Samagri directly from sacred temple vendors.
            </p>

            {/* Search Bar Container inside Banner */}
            <form onSubmit={handleSearchSubmit} className="w-full max-w-2xl mx-auto mt-4 relative z-10 bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-md border border-white/20 dark:border-slate-800 rounded-full p-2 sm:p-2.5 shadow-2xl flex items-center gap-2">
              <div className="relative flex-1 flex items-center">
                <Search size={18} className="absolute left-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search Kashi Prasad, Rudraksha mala, Brass Diya, Bhagavad Gita..."
                  className="w-full pl-11 pr-4 py-2 bg-transparent text-xs sm:text-sm font-bold text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white text-xs font-black shadow-md transition-colors cursor-pointer shrink-0"
              >
                Search
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ── 2. Category Filter & Sort Toolbar ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat.id); setSearchParams({ category: cat.id }); }}
                  className={`px-4 py-2 rounded-full text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${isActive
                    ? 'bg-[#0A4DA6] text-white shadow-md shadow-[#0A4DA6]/25'
                    : 'bg-white dark:bg-[#0B192C] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-800 hover:bg-gray-100'
                    }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Sort & Reset Controls */}
          <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
            <EnterpriseSortDropdown value={sortBy} onChange={(val) => setSortBy(val)} />
            <EnterpriseResetButton onReset={handleResetFilters} />
          </div>
        </div>

        {/* ── 3. Live Marketplace Products Grid ── */}
        <div className="mt-8">
          {loading ? (
            <div className="py-20 text-center space-y-3 bg-white dark:bg-[#0B192C] rounded-[32px] border border-gray-100 dark:border-slate-800">
              <Sparkles className="animate-spin mx-auto text-[#0A4DA6]" size={32} />
              <p className="text-sm font-extrabold text-gray-600 dark:text-gray-300">
                Fetching sanctified marketplace products...
              </p>
            </div>
          ) : products.length === 0 ? (
            <div className="py-20 text-center space-y-4 bg-white dark:bg-[#0B192C] rounded-[32px] border border-gray-100 dark:border-slate-800 p-8">
              <ShoppingBag className="mx-auto text-gray-300 dark:text-gray-600" size={48} />
              <h3 className="text-lg font-black text-gray-800 dark:text-white">No Spiritual Products Found</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                No products match the selected filters. Try resetting filters or search terms.
              </p>
              <button
                onClick={handleResetFilters}
                className="px-6 py-2.5 bg-[#0A4DA6] text-white font-extrabold text-xs rounded-full shadow-md"
              >
                Reset Search & Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => {
                const coverImage =
                  product.images?.[0] ||
                  'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80';
                const effectivePrice = product.salePrice || product.price;
                const discountPercent =
                  product.salePrice && product.price > product.salePrice
                    ? Math.round(((product.price - product.salePrice) / product.price) * 100)
                    : 0;

                return (
                  <div
                    key={product._id}
                    className="bg-white dark:bg-[#0B192C] rounded-[24px] border border-gray-100 dark:border-slate-800/80 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between group"
                  >
                    <div>
                      {/* Image & Badges Container */}
                      <div className="relative aspect-[4/3] w-full bg-gray-100 dark:bg-slate-900 overflow-hidden">
                        <img
                          src={coverImage}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80';
                          }}
                        />

                        {/* Overlay Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                        {/* Top Left Discount Tag */}
                        {discountPercent > 0 && (
                          <span className="absolute top-3 left-3 px-2.5 py-1 bg-rose-600 text-white font-black text-[10px] rounded-full shadow-md uppercase tracking-wider">
                            {discountPercent}% OFF
                          </span>
                        )}

                        {/* Top Right Rating Pill */}
                        <span className="absolute top-3 right-3 px-2.5 py-1 bg-black/60 backdrop-blur-md text-amber-400 font-extrabold text-[11px] rounded-full flex items-center gap-1 shadow-md">
                          <Star size={12} className="fill-amber-400" />
                          <span>{product.rating || 4.9}</span>
                          <span className="text-gray-300 font-normal">({product.reviewCount || 34})</span>
                        </span>
                      </div>

                      {/* Content Card Body */}
                      <div className="p-5 space-y-3">
                        {/* Category & Temple Source */}
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-extrabold uppercase tracking-wide">
                            {product.category}
                          </span>
                          <span className="text-gray-400 font-bold flex items-center gap-1 truncate">
                            <ShieldCheck size={12} className="text-[#0A4DA6]" />
                            <span className="truncate">{product.templeSource || 'Temple Trust'}</span>
                          </span>
                        </div>

                        {/* Product Title */}
                        <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white line-clamp-2 leading-snug">
                          {product.name}
                        </h3>

                        {/* Authenticity Certificate line */}
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
                          <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                          <span className="truncate">{product.authenticityCertificate || 'Govt Certified'}</span>
                        </p>

                        {/* Price & Stock */}
                        <div className="flex items-baseline justify-between pt-1 border-t border-gray-100 dark:border-slate-800/60">
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-black text-[#0A4DA6] dark:text-blue-400">
                              ₹{effectivePrice}
                            </span>
                            {product.salePrice && product.price > product.salePrice && (
                              <span className="text-xs text-gray-400 line-through">₹{product.price}</span>
                            )}
                          </div>

                          <span
                            className={`text-[10px] font-extrabold ${
                              (product.stock ?? 50) > 0
                                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full'
                                : 'text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full'
                            }`}
                          >
                            {(product.stock ?? 50) > 0 ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Add to Cart Footer Button */}
                    <div className="p-4 pt-0">
                      <button
                        onClick={() => addToCart(product)}
                        disabled={(product.stock ?? 50) <= 0}
                        className="w-full py-2.5 px-4 bg-[#0A4DA6] hover:bg-blue-900 disabled:bg-gray-300 dark:disabled:bg-slate-800 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md shadow-[#0A4DA6]/20 transition-all cursor-pointer"
                      >
                        <ShoppingCart size={15} />
                        <span>Add to Sacred Cart</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
                  className={`p-2.5 border rounded-xl font-extrabold uppercase text-[10px] cursor-pointer transition-all ${paymentMethod === m ? 'border-[#0A4DA6] bg-blue-50 text-[#0A4DA6]' : 'border-gray-200 text-gray-500'
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
