'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Minus, ArrowRight, ArrowLeft } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
}

export default function WaiterSuhasAddOrderScreen({ params }: { params: { id: string } }) {
  const router = useRouter();
  const seatId = parseInt(params.id, 10);

  const [items, setItems] = useState<MenuItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
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

  const updateQuantity = (itemId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      const newMap = { ...prev };
      if (next === 0) {
        delete newMap[itemId];
      } else {
        newMap[itemId] = next;
      }
      return newMap;
    });
  };

  const totalSelectedQty = Object.values(quantities).reduce((a, b) => a + b, 0);

  const handlePlaceOrder = async () => {
    if (totalSelectedQty === 0 || loading) return;
    setLoading(true);

    try {
      const orderPayload = {
        seatId,
        items: Object.entries(quantities).map(([menuItemId, quantity]) => ({
          menuItemId,
          quantity,
        })),
      };

      const res = await fetch('/api/orders/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      const data = await res.json();
      if (data.success) {
        router.push(`/waiter/suhas/seat/${seatId}`);
      } else {
        alert(data.error || 'Failed to punch order');
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F6] text-stone-900 flex flex-col justify-between p-4 max-w-md mx-auto select-none font-sans">
      {/* Top Header */}
      <div>
        <header className="flex items-center justify-between pb-3 border-b border-stone-200">
          <Link
            href={`/waiter/suhas/seat/${seatId}`}
            className="flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Link>
          <span className="text-sm font-black text-[#8A4228]">Seat {seatId}</span>
        </header>

        <h3 className="text-xs font-black text-stone-900 uppercase tracking-wider my-3">
          Select dishes to add
        </h3>

        {/* Item List */}
        <div className="space-y-2.5 max-h-[74vh] overflow-y-auto pr-1">
          {items.map((item) => {
            const qty = quantities[item.id] || 0;
            return (
              <div
                key={item.id}
                className="bg-white border border-stone-200 rounded-2xl p-3.5 flex items-center justify-between shadow-xs"
              >
                <div>
                  <h4 className="font-bold text-xs text-stone-900">{item.name}</h4>
                  <span className="text-[11px] font-semibold text-[#8A4228]">₹{item.price.toFixed(0)}</span>
                </div>

                {/* Counter or [+ Add] */}
                {qty === 0 ? (
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, 1)}
                    className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#8A4228] hover:text-white text-stone-700 font-bold text-xs border border-stone-300 shadow-xs transition active:scale-95 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add</span>
                  </button>
                ) : (
                  <div className="flex items-center bg-[#8A4228] text-white rounded-xl px-2 py-1 font-bold text-xs shadow-xs">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-6 h-6 flex items-center justify-center active:scale-80"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-5 text-center">{qty}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, 1)}
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

      {/* Bottom Place Order Button */}
      <div className="pt-4">
        <button
          type="button"
          onClick={handlePlaceOrder}
          disabled={totalSelectedQty === 0 || loading}
          className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition shadow-xl select-none active:scale-98 ${
            totalSelectedQty > 0
              ? 'bg-[#8A4228] hover:bg-[#71351F] text-white shadow-xs font-bold'
              : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
          }`}
        >
          <span>{loading ? 'Punching...' : `Place order (${totalSelectedQty}) ➔`}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
