'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Plus, Minus, ArrowLeft, CheckCircle2, Printer, ShieldCheck } from 'lucide-react';
import { playSuccessChime } from '@/lib/audio-synth';
import confetti from 'canvas-confetti';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
}

export default function ManagerParcelDeskScreen() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [packagingCharges, setPackagingCharges] = useState(20);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [completedOrder, setCompletedOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/menu')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setItems(data.data.items.filter((i: MenuItem) => i.isAvailable));
        }
      });
  }, []);

  const updateCart = (itemId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      const newCart = { ...prev };
      if (next === 0) delete newCart[itemId];
      else newCart[itemId] = next;
      return newCart;
    });
  };

  const itemMap = new Map(items.map((i) => [i.id, i]));
  let subtotal = 0;
  let totalQty = 0;

  Object.entries(cart).forEach(([id, qty]) => {
    const it = itemMap.get(id);
    if (it) {
      subtotal += it.price * qty;
      totalQty += qty;
    }
  });

  const taxable = subtotal + packagingCharges;
  const gst = Math.round(taxable * 0.05 * 100) / 100;
  const grandTotal = Math.round((taxable + gst) * 100) / 100;

  const tenderedAmount = parseFloat(cashTendered) || 0;
  const changeToReturn = Math.max(0, tenderedAmount - grandTotal);

  const handleCompleteParcel = async () => {
    if (totalQty === 0 || loading) return;
    setLoading(true);

    try {
      const payload = {
        customerName: customerName.trim() || 'Takeaway Guest',
        customerPhone: customerPhone.trim() || '-',
        items: Object.entries(cart).map(([menuItemId, quantity]) => ({
          menuItemId,
          quantity,
        })),
        packagingCharges,
        paymentMode,
      };

      const res = await fetch('/api/parcel/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        playSuccessChime();
        setCompletedOrder(data.data);
        try {
          confetti({ particleCount: 60, spread: 50 });
        } catch (e) {}
        setCart({});
        setCustomerName('');
        setCustomerPhone('');
        setCashTendered('');
      } else {
        alert(data.error || 'Failed to place parcel order');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none">
      {/* Top Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/manager/floor"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Floor</span>
          </Link>
          <div className="h-4 w-px bg-slate-700" />
          <h1 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4" />
            PARCEL & TAKEAWAY BILLING DESK
          </h1>
        </div>

        <div className="text-xs text-slate-400 font-semibold">
          KDS Integrated • Direct Kitchen Dispatch
        </div>
      </header>

      {/* Main Grid: Left Dish Picker + Right Billing & Settlement */}
      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        {/* Left Side (7 Cols): Menu Dishes */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
              <h2 className="text-xs font-black text-slate-300 uppercase tracking-wider">
                🛒 SELECT ITEMS FOR PARCEL
              </h2>
              <span className="text-xs text-amber-400 font-bold">
                {items.length} items available
              </span>
            </div>

            <div className="space-y-2.5 max-h-[72vh] overflow-y-auto pr-1">
              {items.map((item) => {
                const qty = cart[item.id] || 0;
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-bold text-xs text-white">{item.name}</h4>
                      <span className="text-xs font-semibold text-amber-400">
                        ₹{item.price.toFixed(0)}
                      </span>
                    </div>

                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => updateCart(item.id, 1)}
                        className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-amber-500 hover:text-slate-950 text-white font-bold text-xs transition active:scale-95 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    ) : (
                      <div className="flex items-center bg-amber-500 text-slate-950 rounded-xl px-2 py-1 font-black text-xs shadow-md">
                        <button
                          type="button"
                          onClick={() => updateCart(item.id, -1)}
                          className="w-6 h-6 flex items-center justify-center active:scale-80"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-5 text-center">{qty}</span>
                        <button
                          type="button"
                          onClick={() => updateCart(item.id, 1)}
                          className="w-6 h-6 flex items-center justify-center active:scale-80"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side (5 Cols): Order Summary & Payment */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="pb-3 border-b border-slate-800 mb-3">
              <h3 className="font-black text-sm text-white uppercase tracking-wider">
                🧾 PARCEL ORDER & BILLING
              </h3>
            </div>

            {/* Customer Inputs */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ramesh Kumar"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Phone Number</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="9845012345"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Items Summary */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3 mb-3 max-h-[22vh] overflow-y-auto space-y-1">
              {Object.keys(cart).length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-2">No items selected</p>
              ) : (
                Object.entries(cart).map(([id, qty]) => {
                  const it = itemMap.get(id);
                  if (!it) return null;
                  return (
                    <div key={id} className="flex justify-between text-xs">
                      <span className="font-medium text-slate-300">
                        {qty}x {it.name}
                      </span>
                      <span className="font-bold text-amber-400">₹{(it.price * qty).toFixed(0)}</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Price Breakdown */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 space-y-1 text-xs mb-3">
              <div className="flex justify-between text-slate-400">
                <span>Items Subtotal:</span>
                <span className="text-white font-medium">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Parcel Containers:</span>
                <span className="text-white font-medium">₹{packagingCharges.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>GST (5%):</span>
                <span className="text-white font-medium">₹{gst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-amber-400 pt-1 border-t border-slate-700">
                <span>GRAND TOTAL DUE:</span>
                <span className="text-base text-white">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-2 mb-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Payment Method
              </span>
              <div className="grid grid-cols-3 gap-2">
                {['CASH', 'UPI', 'CARD'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMode(m as any)}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      paymentMode === m
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {m === 'CASH' ? '💵 Cash' : m === 'UPI' ? '📱 UPI' : '💳 Card'}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash Calculator if Cash is selected */}
            {paymentMode === 'CASH' && (
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-xs flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Tendered:</span>
                  <input
                    type="number"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    placeholder="₹500"
                    className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-bold"
                  />
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Change Return:</span>
                  <span className="font-black text-emerald-400">₹{changeToReturn.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleCompleteParcel}
              disabled={totalQty === 0 || loading}
              className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition shadow-xl select-none active:scale-98 ${
                totalQty > 0
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-500 border border-slate-800 cursor-not-allowed'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>
                {loading
                  ? 'Processing...'
                  : `COMPLETE PAYMENT & DISPATCH KOT (₹${grandTotal.toFixed(0)})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
