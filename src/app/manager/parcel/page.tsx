'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Plus, Minus, CheckCircle2, Printer } from 'lucide-react';
import { playSuccessChime } from '@/lib/audio-synth';
import confetti from 'canvas-confetti';
import ManagerTopNav from '@/components/ManagerTopNav';

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
    if (totalQty === 0 || loading || grandTotal <= 0) return;
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
    <div className="min-h-screen bg-[#FBF9F6] text-stone-900 flex flex-col font-sans select-none p-3">
      <div className="border border-[#8A4228] rounded-2xl bg-[#FBF9F6] min-h-[calc(100vh-1.5rem)] flex flex-col overflow-hidden">
        {/* Unified Executive Navigation Bar */}
        <ManagerTopNav activeTab="parcel" />

        {/* Main Grid: Left Dish Picker + Right Billing & Settlement */}
        <div className="flex-1 p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
          {/* Left Side (7 Cols): Menu Dishes */}
          <div className="lg:col-span-7 bg-white border border-stone-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex justify-between items-center pb-3 border-b border-stone-200 mb-4">
                <h2 className="text-xs font-black text-stone-900 uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#8A4228]" />
                  SELECT ITEMS FOR PARCEL
                </h2>
                <span className="text-xs text-[#8A4228] font-bold">
                  {items.length} items available
                </span>
              </div>

              <div className="space-y-2.5 max-h-[72vh] overflow-y-auto pr-1">
                {items.map((item) => {
                  const qty = cart[item.id] || 0;
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-bold text-xs text-stone-900">{item.name}</h4>
                        <span className="text-xs font-semibold text-[#8A4228]">
                          ₹{item.price.toFixed(0)}
                        </span>
                      </div>

                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => updateCart(item.id, 1)}
                          className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-[#8A4228] hover:text-white border border-stone-300 text-stone-700 font-bold text-xs transition active:scale-95 flex items-center gap-1 shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      ) : (
                        <div className="flex items-center bg-[#8A4228] text-white rounded-lg px-2 py-1 font-bold text-xs shadow-xs">
                          <button
                            type="button"
                            onClick={() => updateCart(item.id, -1)}
                            className="w-6 h-6 flex items-center justify-center active:scale-80 hover:bg-[#71351F] rounded"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center">{qty}</span>
                          <button
                            type="button"
                            onClick={() => updateCart(item.id, 1)}
                            className="w-6 h-6 flex items-center justify-center active:scale-80 hover:bg-[#71351F] rounded"
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
          <div className="lg:col-span-5 bg-white border border-stone-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
            <div>
              <div className="pb-3 border-b border-stone-200 mb-3">
                <h3 className="font-black text-xs text-stone-900 uppercase tracking-wider">
                  🧾 PARCEL ORDER & BILLING
                </h3>
              </div>

              {/* Customer Inputs */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-[10px] font-bold text-stone-500 block mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ramesh Kumar"
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#8A4228]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-stone-500 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="9845012345"
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#8A4228]"
                  />
                </div>
              </div>

              {/* Items Summary */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 mb-3 max-h-[22vh] overflow-y-auto space-y-1">
                {Object.keys(cart).length === 0 ? (
                  <p className="text-xs text-stone-400 text-center py-2">No items selected</p>
                ) : (
                  Object.entries(cart).map(([id, qty]) => {
                    const it = itemMap.get(id);
                    if (!it) return null;
                    return (
                      <div key={id} className="flex justify-between text-xs">
                        <span className="font-medium text-stone-800">
                          {qty}x {it.name}
                        </span>
                        <span className="font-bold text-[#8A4228]">₹{(it.price * qty).toFixed(0)}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Price Breakdown */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-1.5 text-xs mb-3">
                <div className="flex justify-between text-stone-500">
                  <span>Items Subtotal:</span>
                  <span className="text-stone-900 font-semibold">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Parcel Containers:</span>
                  <span className="text-stone-900 font-semibold">₹{packagingCharges.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>GST (5%):</span>
                  <span className="text-stone-900 font-semibold">₹{gst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-[#8A4228] pt-2 border-t border-stone-200">
                  <span>GRAND TOTAL DUE:</span>
                  <span className="text-base text-stone-900">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="space-y-2 mb-3">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
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
                          ? 'bg-[#8A4228] text-white border-[#8A4228] shadow-xs font-bold'
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      {m === 'CASH' ? '💵 Cash' : m === 'UPI' ? '📱 UPI' : '💳 Card'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash Calculator if Cash is selected */}
              {paymentMode === 'CASH' && (
                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500 font-medium">Tendered:</span>
                    <input
                      type="number"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      placeholder="₹500"
                      className="w-20 bg-white border border-stone-200 rounded-lg px-2 py-1 text-stone-900 font-bold focus:outline-none focus:border-[#8A4228]"
                    />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-stone-400 block">Change Return:</span>
                    <span className="font-black text-emerald-600">₹{changeToReturn.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleCompleteParcel}
                disabled={totalQty === 0 || loading || grandTotal <= 0}
                className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-xs select-none active:scale-98 ${
                  totalQty > 0 && grandTotal > 0
                    ? 'bg-[#8A4228] hover:bg-[#71351F] text-white'
                    : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
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
    </div>
  );
}