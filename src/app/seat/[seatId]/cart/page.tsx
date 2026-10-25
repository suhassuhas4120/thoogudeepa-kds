'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Plus, Minus, Trash2, ArrowRight, UtensilsCrossed, Utensils } from 'lucide-react';
import { useCustomerTheme } from '@/lib/useCustomerTheme';
import { ThemeToggle } from '@/components/ThemeToggle';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  isVeg: boolean;
  isPairWith: boolean;
  imageUrl?: string;
}

export default function CustomerScreen3({ params }: { params: { seatId: string } }) {
  const router = useRouter();
  const seatId = parseInt(params.seatId, 10);
  const { theme, toggleTheme } = useCustomerTheme();
  const isOrange = theme === 'burnt-orange';

  const [customerName, setCustomerName] = useState('-');
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [pairWithItems, setPairWithItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [specialNotes, setSpecialNotes] = useState('');

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
          setItems(data.data.items || []);
          setPairWithItems((data.data.items || []).filter((it: MenuItem) => it.isPairWith));
        }
      });

    const savedCart = localStorage.getItem(`cart_seat_${seatId}`);
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {}
    }
  }, [seatId]);

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

  const removeItem = (itemId: string) => {
    setCart((prev) => {
      const newCart = { ...prev };
      delete newCart[itemId];
      localStorage.setItem(`cart_seat_${seatId}`, JSON.stringify(newCart));
      return newCart;
    });
  };

  const itemMap = new Map(items.map((it) => [it.id, it]));
  const cartEntries = Object.entries(cart).filter(([_, qty]) => qty > 0);

  const subtotal = cartEntries.reduce((sum, [id, qty]) => {
    const item = itemMap.get(id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const gst = subtotal * 0.05;
  const grandTotal = subtotal + gst;
  const totalItemsCount = cartEntries.reduce((sum, [_, q]) => sum + q, 0);

  const handlePlaceOrder = async () => {
    if (cartEntries.length === 0 || loading) return;
    setLoading(true);

    try {
      const orderItems = cartEntries.map(([id, qty]) => ({
        menuItemId: id,
        quantity: qty,
      }));

      const res = await fetch('/api/orders/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seatId,
          items: orderItems,
          notes: specialNotes,
          appliedPromoCode: localStorage.getItem(`applied_promo_seat_${seatId}`) || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        localStorage.removeItem(`cart_seat_${seatId}`);
        router.push(`/seat/${seatId}/tracking`);
      } else {
        alert(data.error || 'Failed to place order');
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      alert('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col pb-32 max-w-md mx-auto font-sans select-none relative transition-colors duration-300 ${
        isOrange ? 'bg-[#FFFCF7] text-[#5B5049]' : 'bg-gradient-to-b from-[#04120d] via-[#081e16] to-[#04110c] text-white'
      }`}
    >
      {/* Top Bar */}
      <header
        className={`sticky top-0 z-30 px-4 py-3 flex items-center justify-between shadow-md transition-colors duration-300 ${
          isOrange
            ? 'bg-[#8A4228] text-[#FFFCF7] border-b border-[#71351F]'
            : 'bg-[#061c14]/95 backdrop-blur-md border-b border-emerald-500/20 text-white'
        }`}
      >
        <div className="flex items-center gap-2">
          <Link
            href={`/seat/${seatId}/menu`}
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
              Order Review
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />

          {/* Call Waiter */}
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

      {/* Cart Items List */}
      <div className="p-4 space-y-3">
        {cartEntries.length === 0 ? (
          <div className="text-center py-16">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 border ${
                isOrange ? 'bg-[#F3DFCC] border-[#E8D5C3]' : 'bg-[#0b291f] border-emerald-500/30'
              }`}
            >
              <UtensilsCrossed className={`w-8 h-8 ${isOrange ? 'text-[#8A4228]' : 'text-amber-400/60'}`} />
            </div>
            <p className={`text-base font-black ${isOrange ? 'text-[#8A4228]' : 'text-white'}`}>Your cart is empty</p>
            <p className={`text-xs mt-1 ${isOrange ? 'text-[#5B5049]/70' : 'text-emerald-400/70'}`}>
              Select from our authentic Donne Biryanis & sides
            </p>
            <Link
              href={`/seat/${seatId}/menu`}
              className={`mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs shadow-md active:scale-95 ${
                isOrange
                  ? 'bg-[#8A4228] hover:bg-[#71351F] text-[#FFFCF7]'
                  : 'bg-amber-400 text-slate-950 shadow-amber-500/20'
              }`}
            >
              <span>Explore Menu</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          cartEntries.map(([id, qty]) => {
            const item = itemMap.get(id);
            if (!item) return null;
            return (
              <div
                key={id}
                className={`border rounded-2xl p-3 flex items-center justify-between shadow-sm transition ${
                  isOrange
                    ? 'bg-[#FFFCF7] border-[#E8D5C3]'
                    : 'bg-gradient-to-r from-[#0b291f] to-[#072017] border-emerald-500/25 text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className={`w-12 h-12 rounded-xl object-cover flex-shrink-0 ${
                        isOrange ? 'border border-[#E8D5C3]' : 'border border-emerald-500/20'
                      }`}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-sm border ${
                          item.isVeg
                            ? 'border-[#198754] bg-[#198754]/20'
                            : isOrange
                            ? 'border-[#D92D20] bg-[#D92D20]/20'
                            : 'border-rose-500 bg-rose-500/20'
                        }`}
                      />
                      <h4
                        className={`font-extrabold text-xs leading-tight ${
                          isOrange ? 'text-[#5B5049]' : 'text-white'
                        }`}
                      >
                        {item.name}
                      </h4>
                    </div>
                    <span
                      className={`text-xs font-black ${
                        isOrange ? 'text-[#D92D20]' : 'text-amber-400'
                      }`}
                    >
                      ₹{item.price.toFixed(0)} × {qty} ={' '}
                      <span className={isOrange ? 'text-[#8A4228] font-bold' : 'text-emerald-300 font-bold'}>
                        ₹{(item.price * qty).toFixed(0)}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={`flex items-center rounded-xl px-2 py-1 text-xs font-black border ${
                      isOrange
                        ? 'bg-[#F3DFCC] border-[#E8D5C3]'
                        : 'bg-[#061c14] border-emerald-500/30 text-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => updateCart(id, -1)}
                      className={`w-6 h-6 flex items-center justify-center active:scale-75 font-black ${
                        isOrange ? 'text-[#8A4228]' : 'text-emerald-300 hover:text-white'
                      }`}
                    >
                      <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                    <span className={`w-5 text-center font-black ${isOrange ? 'text-[#5B5049]' : 'text-amber-300'}`}>
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCart(id, 1)}
                      className={`w-6 h-6 flex items-center justify-center active:scale-75 font-black ${
                        isOrange ? 'text-[#8A4228]' : 'text-emerald-300 hover:text-white'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(id)}
                    className="p-2 rounded-xl text-[#D92D20] hover:bg-[#D92D20]/10 transition"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Recommended Pairings Section */}
      {pairWithItems.length > 0 && cartEntries.length > 0 && (
        <div className={`px-4 py-2 border-t ${isOrange ? 'border-[#E8D5C3]' : 'border-emerald-500/20'}`}>
          <div className="flex items-center gap-1.5 mb-2.5">
            <Utensils className={`w-4 h-4 ${isOrange ? 'text-[#8A4228]' : 'text-amber-400'}`} />
            <h3
              className={`text-xs font-black tracking-wider uppercase ${
                isOrange ? 'text-[#8A4228]' : 'text-amber-300'
              }`}
            >
              Recommended Pairings
            </h3>
          </div>

          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {pairWithItems.map((pw) => {
              const inCartQty = cart[pw.id] || 0;
              return (
                <div
                  key={pw.id}
                  className={`flex-shrink-0 w-36 rounded-2xl border p-2.5 flex flex-col justify-between shadow-sm transition ${
                    isOrange
                      ? 'bg-[#F3DFCC] border-[#E8D5C3]'
                      : 'bg-gradient-to-b from-[#0c2f23] to-[#072017] border-amber-400/25 text-white'
                  }`}
                >
                  <div>
                    {pw.imageUrl && (
                      <div
                        className={`w-full h-20 rounded-xl overflow-hidden mb-2 border ${
                          isOrange ? 'bg-[#FFFCF7] border-[#E8D5C3]' : 'bg-emerald-950/40 border-emerald-500/20'
                        }`}
                      >
                        <img
                          src={pw.imageUrl}
                          alt={pw.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <h5 className={`font-extrabold text-xs line-clamp-1 ${isOrange ? 'text-[#5B5049]' : 'text-white'}`}>
                      {pw.name}
                    </h5>
                    <span className={`text-xs font-black ${isOrange ? 'text-[#D92D20]' : 'text-amber-400'}`}>
                      ₹{pw.price.toFixed(0)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateCart(pw.id, 1)}
                    className={`mt-2.5 w-full py-1.5 rounded-xl font-black text-[11px] transition flex items-center justify-center gap-1 active:scale-95 shadow-sm ${
                      isOrange
                        ? 'bg-[#8A4228] hover:bg-[#71351F] text-[#FFFCF7]'
                        : 'bg-[#072318] hover:bg-amber-400 hover:text-slate-950 border border-emerald-500/30 text-emerald-200'
                    }`}
                  >
                    <Plus className="w-3 h-3 stroke-[3]" />
                    <span>{inCartQty > 0 ? `Add (${inCartQty})` : 'Add'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cooking Instructions */}
      {cartEntries.length > 0 && (
        <div className="px-4 py-2">
          <input
            type="text"
            value={specialNotes}
            onChange={(e) => setSpecialNotes(e.target.value)}
            placeholder="Special instructions? (e.g. less spicy, extra salna)"
            className={`w-full rounded-xl py-2.5 px-3.5 text-xs font-medium focus:outline-none transition ${
              isOrange
                ? 'bg-[#FFFCF7] border border-[#E8D5C3] text-[#5B5049] placeholder-[#5B5049]/50 focus:border-[#8A4228]'
                : 'bg-[#061c14] border border-emerald-500/25 text-white placeholder-emerald-700 focus:border-amber-400'
            }`}
          />
        </div>
      )}

      {/* Bill Summary */}
      {cartEntries.length > 0 && (
        <div
          className={`px-4 pt-3 pb-2 border-t space-y-1.5 text-xs ${
            isOrange ? 'border-[#E8D5C3] text-[#5B5049]' : 'border-emerald-500/20 text-emerald-300/80'
          }`}
        >
          <div className="flex justify-between">
            <span>Subtotal ({totalItemsCount} items)</span>
            <span className={`font-bold ${isOrange ? 'text-[#5B5049]' : 'text-white'}`}>₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>GST (5%)</span>
            <span className={`font-bold ${isOrange ? 'text-[#198754]' : 'text-emerald-400'}`}>₹{gst.toFixed(2)}</span>
          </div>
          <div
            className={`flex justify-between text-sm font-black pt-2 border-t ${
              isOrange ? 'border-[#E8D5C3] text-[#8A4228]' : 'border-emerald-500/20 text-amber-400'
            }`}
          >
            <span>Grand Total</span>
            <span className="text-base font-black">₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Bottom Sticky Button */}
      {cartEntries.length > 0 && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-40 p-4 max-w-md mx-auto border-t transition ${
            isOrange
              ? 'bg-[#FFFCF7]/95 backdrop-blur-md border-[#E8D5C3]'
              : 'bg-[#051a13]/95 backdrop-blur-md border-emerald-500/20'
          }`}
        >
          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={loading}
            className={`w-full py-4 rounded-2xl active:scale-95 font-black text-sm flex items-center justify-between px-5 shadow-2xl transition select-none ${
              isOrange
                ? 'bg-[#8A4228] hover:bg-[#71351F] text-[#FFFCF7] shadow-[#8A4228]/25'
                : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 border border-white/20 shadow-black/80'
            }`}
          >
            <span>{loading ? 'Sending to Kitchen...' : 'Confirm & Place Order'}</span>
            <div className="flex items-center gap-1.5 font-black text-base">
              <span>₹{grandTotal.toFixed(0)}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
