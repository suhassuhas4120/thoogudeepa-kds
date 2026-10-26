'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Bell, Plus, Minus, ArrowRight, Check, Tag } from 'lucide-react';
import { useSocketRoom } from '@/lib/useSocket';
import { useCustomerTheme } from '@/lib/useCustomerTheme';
import { ThemeToggle } from '@/components/ThemeToggle';
import CustomerBottomNav from '@/components/CustomerBottomNav';

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  isVeg: boolean;
  isAvailable: boolean;
  imageUrl: string;
}

interface MenuCategory {
  id: string;
  name: string;
  slug: string;
}

interface PromoCard {
  id: string;
  title: string;
  subtitle: string;
  badgeText: string;
  promoCode?: { code: string };
  imageUrl?: string;
}

export default function CustomerScreen2({ params }: { params: { seatId: string } }) {
  const router = useRouter();
  const seatId = parseInt(params.seatId, 10);
  const socket = useSocketRoom(`room:seat:${seatId}`);
  const { theme, toggleTheme } = useCustomerTheme();
  const isOrange = theme === 'burnt-orange';

  const [customerName, setCustomerName] = useState('-');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [promoCards, setPromoCards] = useState<PromoCard[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/seats/${seatId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.seat) {
          setCustomerName(data.data.seat.currentGuestName || '-');
        }
      });

    fetch('/api/menu')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCategories(data.data.categories || []);
          setItems(data.data.items || []);
        }
      });

    fetch('/api/promos')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setPromoCards(data.data.promoCards || data.data.promotionalCards || []);
        }
      });

    const savedCart = localStorage.getItem(`cart_seat_${seatId}`);
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {}
    }
  }, [seatId]);

  useEffect(() => {
    if (!socket) return;
    const handle86 = (data: { menuItemId: string; isAvailable: boolean }) => {
      setItems((prev) =>
        prev.map((it) => (it.id === data.menuItemId ? { ...it, isAvailable: data.isAvailable } : it))
      );
    };
    socket.on('menu:86_toggled', handle86);
    return () => {
      socket.off('menu:86_toggled', handle86);
    };
  }, [socket]);

  const updateCart = (itemId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      const newCart = { ...prev };
      if (next === 0) {
        delete newCart[itemId];
      } else {
        newCart[itemId] = next;
      }
      localStorage.setItem(`cart_seat_${seatId}`, JSON.stringify(newCart));
      return newCart;
    });
  };

  const handleClaimPromo = (card: PromoCard) => {
    if (card.promoCode) {
      setAppliedPromo(card.promoCode.code);
      localStorage.setItem(`applied_promo_seat_${seatId}`, card.promoCode.code);
    }
    const biryani = items.find((i) => i.name.toLowerCase().includes('biryani'));
    const starter = items.find((i) => i.name.toLowerCase().includes('kabab') || i.name.toLowerCase().includes('fry'));

    if (biryani) updateCart(biryani.id, 1);
    if (starter) updateCart(starter.id, 1);
  };

  const totalQty = Object.values(cart).reduce((sum, q) => sum + q, 0);

  const filteredItems = items.filter((item) => {
    if (selectedCategory !== 'ALL' && item.categoryId !== selectedCategory) return false;
    if (vegOnly && !item.isVeg) return false;
    if (searchQuery.trim() && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div
      className={`min-h-screen flex flex-col pb-28 max-w-md mx-auto font-sans select-none relative transition-colors duration-300 ${
        isOrange ? 'bg-[#FFFCF7] text-[#5B5049]' : 'bg-gradient-to-b from-[#04120d] via-[#081e16] to-[#04110c] text-white'
      }`}
    >
      {/* Top Header Bar */}
      <header
        className={`sticky top-0 z-30 px-4 py-3 flex items-center justify-between shadow-md transition-colors duration-300 ${
          isOrange
            ? 'bg-[#8A4228] text-[#FFFCF7] border-b border-[#71351F]'
            : 'bg-[#061c14]/95 backdrop-blur-md border-b border-emerald-500/20 text-white'
        }`}
      >
        <div className="flex items-center gap-2">
          <Link
            href={`/seat/${seatId}`}
            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold transition ${
              isOrange
                ? 'bg-[#71351F] text-[#FFFCF7] hover:bg-[#5e2b19]'
                : 'bg-[#0b2d21] border border-emerald-500/30 text-amber-400 hover:bg-[#0f3d2d]'
            }`}
          >
            ‹
          </Link>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-black ${isOrange ? 'text-[#FFFCF7]' : 'text-amber-400'}`}>
                SEAT {String(seatId).padStart(2, '0')}
              </span>
              {customerName !== '-' && (
                <span className={`text-[11px] font-bold ${isOrange ? 'text-[#F3DFCC]' : 'text-emerald-300'}`}>
                  ({customerName})
                </span>
              )}
            </div>
            <p className={`text-[9px] font-bold tracking-wider uppercase ${isOrange ? 'text-[#F3DFCC]/80' : 'text-emerald-400/80'}`}>
              Thoogudeepa Mane
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />

          {/* Call Waiter Link */}
          <Link
            href={`/seat/${seatId}/help`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black transition active:scale-95 shadow-sm ${
              isOrange
                ? 'bg-[#F3DFCC] text-[#8A4228] hover:bg-[#ebd5c0]'
                : 'bg-amber-500/15 border border-amber-400/40 text-amber-400 hover:bg-amber-500/25'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Waiter</span>
          </Link>
        </div>
      </header>

      {/* Search & Veg Toggle Row */}
      <div className="px-4 pt-3.5 pb-2 flex items-center gap-2.5">
        <div className="relative flex-1">
          <Search
            className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
              isOrange ? 'text-[#5B5049]/60' : 'text-emerald-400/70'
            }`}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search biryani, starters, soup..."
            className={`w-full rounded-xl py-2 pl-9 pr-3 text-xs font-medium focus:outline-none transition ${
              isOrange
                ? 'bg-[#FFFCF7] border border-[#E8D5C3] text-[#5B5049] placeholder-[#5B5049]/50 focus:border-[#8A4228]'
                : 'bg-[#082218] border border-emerald-500/20 text-white placeholder-emerald-600/70 focus:border-amber-400'
            }`}
          />
        </div>

        {/* Veg Toggle Switch */}
        <button
          type="button"
          onClick={() => setVegOnly(!vegOnly)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition ${
            vegOnly
              ? isOrange
                ? 'bg-[#F3DFCC] border-[#198754] text-[#198754]'
                : 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
              : isOrange
              ? 'bg-[#FFFCF7] border-[#E8D5C3] text-[#5B5049]/70 hover:text-[#5B5049]'
              : 'bg-[#082218] border-emerald-500/20 text-emerald-400/80 hover:text-white'
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              vegOnly ? 'bg-[#198754]' : isOrange ? 'bg-[#5B5049]/30' : 'bg-emerald-700'
            }`}
          />
          <span>Veg</span>
        </button>
      </div>

      {/* Promotional Cards Carousel */}
      {promoCards.length > 0 && (
        <div className="pt-2 pb-3">
          <div className="flex gap-3 overflow-x-auto px-4 no-scrollbar">
            {promoCards.map((card) => (
              <div
                key={card.id}
                className={`flex-shrink-0 w-80 rounded-2xl border p-3.5 flex flex-col justify-between shadow-lg relative overflow-hidden transition ${
                  isOrange
                    ? 'bg-[#F3DFCC] border-[#E8D5C3] text-[#5B5049]'
                    : 'bg-gradient-to-r from-amber-950/70 via-[#0e3427] to-[#072017] border-amber-400/40 text-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  {card.imageUrl && (
                    <img
                      src={card.imageUrl}
                      alt={card.title}
                      className={`w-16 h-16 rounded-xl object-cover flex-shrink-0 shadow-md ${
                        isOrange ? 'border border-[#D08A52]/40' : 'border border-amber-400/30'
                      }`}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          isOrange
                            ? 'bg-[#8A4228]/10 text-[#8A4228] border-[#8A4228]/30'
                            : 'bg-amber-500/25 text-amber-300 border-amber-400/40'
                        }`}
                      >
                        {card.badgeText || 'SPECIAL OFFER'}
                      </span>
                      <Tag className={`w-3.5 h-3.5 ${isOrange ? 'text-[#8A4228]' : 'text-amber-400'} flex-shrink-0`} />
                    </div>
                    <h3 className={`font-extrabold text-xs leading-tight ${isOrange ? 'text-[#8A4228]' : 'text-white'}`}>
                      {card.title}
                    </h3>
                    <p className={`text-[11px] mt-0.5 line-clamp-2 leading-snug ${isOrange ? 'text-[#5B5049]' : 'text-emerald-200/90'}`}>
                      {card.subtitle}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleClaimPromo(card)}
                  className={`mt-3 w-full py-2 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 active:scale-95 shadow-md ${
                    isOrange
                      ? 'bg-[#8A4228] hover:bg-[#71351F] text-[#FFFCF7]'
                      : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-amber-500/20'
                  }`}
                >
                  {appliedPromo === card.badgeText ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Offer Claimed</span>
                    </>
                  ) : (
                    <>
                      <span>Claim Deal</span>
                      <ArrowRight className="w-3 h-3 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Pills */}
      <div
        className={`px-4 py-2 border-y flex gap-2 overflow-x-auto no-scrollbar transition ${
          isOrange
            ? 'bg-[#FFFCF7] border-[#E8D5C3]'
            : 'bg-[#051a13]/90 border-emerald-500/20'
        }`}
      >
        <button
          type="button"
          onClick={() => setSelectedCategory('ALL')}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-black transition ${
            selectedCategory === 'ALL'
              ? isOrange
                ? 'bg-[#8A4228] text-[#FFFCF7] shadow-sm'
                : 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
              : isOrange
              ? 'bg-[#F3DFCC] text-[#5B5049] hover:bg-[#ebd5c0]'
              : 'bg-[#08241a] text-emerald-300/80 hover:text-white border border-emerald-500/20'
          }`}
        >
          All Dishes
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-black transition ${
              selectedCategory === cat.id
                ? isOrange
                  ? 'bg-[#8A4228] text-[#FFFCF7] shadow-sm'
                  : 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                : isOrange
                ? 'bg-[#F3DFCC] text-[#5B5049] hover:bg-[#ebd5c0]'
                : 'bg-[#08241a] text-emerald-300/80 hover:text-white border border-emerald-500/20'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Item Grid (2-Column Food Cards) */}
      <div className="px-4 pt-3.5 grid grid-cols-2 gap-3">
        {filteredItems.map((item) => {
          const qty = cart[item.id] || 0;
          return (
            <div
              key={item.id}
              className={`rounded-2xl border p-3 flex flex-col justify-between transition shadow-sm ${
                isOrange
                  ? item.isAvailable
                    ? 'bg-[#FFFCF7] border-[#E8D5C3] hover:border-[#D08A52]'
                    : 'bg-[#FFFCF7] border-[#E8D5C3] opacity-60'
                  : item.isAvailable
                  ? 'bg-gradient-to-b from-[#0b291f] to-[#071f16] border-emerald-500/20 hover:border-amber-400/40'
                  : 'bg-[#051711] border-emerald-950 opacity-60'
              }`}
            >
              <div>
                {/* Dish Authentic Photography */}
                {item.imageUrl && (
                  <div
                    className={`relative w-full h-28 mb-2 rounded-xl overflow-hidden border ${
                      isOrange ? 'bg-[#F3DFCC] border-[#E8D5C3]' : 'bg-emerald-950/40 border-emerald-500/15'
                    }`}
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Veg / Non-Veg Indicator & Price */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`inline-block w-3 h-3 rounded-sm border ${
                      item.isVeg
                        ? 'border-[#198754] bg-[#198754]/20'
                        : isOrange
                        ? 'border-[#D92D20] bg-[#D92D20]/20'
                        : 'border-rose-500 bg-rose-500/20'
                    } flex items-center justify-center p-0.5`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        item.isVeg ? 'bg-[#198754]' : isOrange ? 'bg-[#D92D20]' : 'bg-rose-500'
                      }`}
                    />
                  </span>
                  <span
                    className={`text-sm font-black ${
                      isOrange ? 'text-[#D92D20]' : 'text-amber-400'
                    }`}
                  >
                    ₹{item.price.toFixed(0)}
                  </span>
                </div>

                <h4
                  className={`font-black text-xs leading-tight mb-1 ${
                    isOrange ? 'text-[#5B5049]' : 'text-white'
                  }`}
                >
                  {item.name}
                </h4>
                <p
                  className={`text-[10px] line-clamp-2 leading-snug mb-3 ${
                    isOrange ? 'text-[#5B5049]/70' : 'text-emerald-300/70'
                  }`}
                >
                  {item.description}
                </p>
              </div>

              {/* Action Button: [+ Add] or [- qty +] */}
              {!item.isAvailable ? (
                <div
                  className={`w-full py-1.5 text-center text-[10px] font-black rounded-xl border ${
                    isOrange
                      ? 'text-[#D92D20] bg-[#D92D20]/10 border-[#D92D20]/30'
                      : 'text-rose-400 bg-rose-950/40 border-rose-800/40'
                  }`}
                >
                  Sold Out
                </div>
              ) : qty === 0 ? (
                <button
                  type="button"
                  onClick={() => updateCart(item.id, 1)}
                  className={`w-full py-2 rounded-xl font-black text-xs transition flex items-center justify-center gap-1 active:scale-95 shadow-sm ${
                    isOrange
                      ? 'bg-[#8A4228] hover:bg-[#71351F] text-[#FFFCF7]'
                      : 'bg-[#0e3a2b] hover:bg-amber-400 hover:text-slate-950 text-emerald-200 border border-emerald-500/30'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              ) : (
                <div
                  className={`w-full flex items-center justify-between rounded-xl px-2 py-1 font-black text-xs shadow-sm ${
                    isOrange
                      ? 'bg-[#F3DFCC] border border-[#E8D5C3]'
                      : 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-md'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => updateCart(item.id, -1)}
                    className={`w-6 h-6 flex items-center justify-center active:scale-75 font-black ${
                      isOrange ? 'text-[#8A4228]' : 'text-slate-950'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5 stroke-[3]" />
                  </button>
                  <span className={`text-xs font-black ${isOrange ? 'text-[#5B5049]' : 'text-slate-950'}`}>
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateCart(item.id, 1)}
                    className={`w-6 h-6 flex items-center justify-center active:scale-75 font-black ${
                      isOrange ? 'text-[#8A4228]' : 'text-slate-950'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sticky Bottom Cart Bar (positioned above the bottom navigation) */}
      {totalQty > 0 && (
        <div className="fixed bottom-[68px] left-0 right-0 z-40 px-4 pb-1 max-w-md mx-auto">
          <Link
            href={`/seat/${seatId}/cart`}
            className={`w-full py-3 px-5 rounded-2xl font-black text-xs flex items-center justify-between shadow-2xl transition active:scale-98 ${
              isOrange
                ? 'bg-[#8A4228] hover:bg-[#71351F] text-[#FFFCF7] shadow-[#8A4228]/30'
                : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 border border-white/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-black ${
                  isOrange ? 'bg-[#FFFCF7] text-[#8A4228]' : 'bg-slate-950 text-amber-400'
                }`}
              >
                {totalQty}
              </span>
              <span>View Cart</span>
            </div>
            <div className="flex items-center gap-1.5 font-black">
              <span>Review Order</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </div>
          </Link>
        </div>
      )}

      {/* Customer Persistent Bottom Navigation Dock */}
      <CustomerBottomNav seatId={seatId} activeTab="menu" cartCountOverride={totalQty} />
    </div>
  );
}
