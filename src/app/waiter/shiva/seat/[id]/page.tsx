'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ArrowLeft, Plus, Minus, CreditCard, Droplet, ArrowRight, QrCode } from 'lucide-react';
import { useSocketRoom } from '@/lib/useSocket';
import { playSuccessChime } from '@/lib/audio-synth';

interface OrderItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  status: 'placed' | 'preparing' | 'ready' | 'served' | 'cancelled';
}

interface ServiceReq {
  id: string;
  requestType: string;
  status: 'PENDING' | 'RESOLVED';
  requestedAt: string;
}

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  isAvailable: boolean;
}

interface MenuCategory {
  id: string;
  name: string;
}

export default function WaiterShivaUnifiedWorkspace({ params }: { params: { id: string } }) {
  const router = useRouter();
  const seatId = parseInt(params.id, 10);
  const socket = useSocketRoom('room:waiter:zoneB');

  const [activeTab, setActiveTab] = useState<'ADD_ITEMS' | 'PAYMENT'>('ADD_ITEMS');
  const [seatData, setSeatData] = useState<{ currentGuestName?: string } | null>(null);
  const [session, setSession] = useState<{
    id: string;
    subtotal?: number;
    gstAmount?: number;
    grandTotal: number;
    discountAmount?: number;
    appliedPromoCode?: string | null;
    paymentPreferred?: string;
    paymentLockState?: string;
    orderTickets: { ticketNumber: string; items: OrderItem[] }[];
    serviceRequests: ServiceReq[];
  } | null>(null);

  // Right Side Menu & Cart State
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loadingOrder, setLoadingOrder] = useState(false);

  // Right Side Settlement State
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [loadingVacate, setLoadingVacate] = useState(false);

  const fetchSeatDetails = () => {
    fetch(`/api/seats/${seatId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSeatData(data.data.seat);
          setSession(data.data.activeSession);
        }
      });
  };

  const fetchMenu = () => {
    fetch('/api/menu')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCategories(data.data.categories);
          setMenuItems(data.data.items.filter((i: MenuItem) => i.isAvailable));
        }
      });
  };

  useEffect(() => {
    fetchSeatDetails();
    fetchMenu();
  }, [seatId]);

  // Real-time synchronization
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchSeatDetails();

    socket.on('order:item_status_changed', handleUpdate);
    socket.on('service:requested', handleUpdate);
    socket.on('service:resolved', handleUpdate);
    socket.on('payment:lock_changed', handleUpdate);
    socket.on('seat:updated', handleUpdate);

    return () => {
      socket.off('order:item_status_changed', handleUpdate);
      socket.off('service:requested', handleUpdate);
      socket.off('service:resolved', handleUpdate);
      socket.off('payment:lock_changed', handleUpdate);
      socket.off('seat:updated', handleUpdate);
    };
  }, [socket]);

  // Mark dish as Served
  const handleMarkServed = async (orderItemId: string) => {
    try {
      await fetch(`/api/orders/${orderItemId}/item-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'served' }),
      });
      fetchSeatDetails();
    } catch (e) {
      console.error(e);
    }
  };

  // Mark Service Request as Resolved
  const handleResolveService = async (requestId: string) => {
    try {
      await fetch(`/api/service-request/${requestId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolvedBy: 'Shiva' }),
      });
      fetchSeatDetails();
    } catch (e) {
      console.error(e);
    }
  };

  // Add Items Qty
  const updateQuantity = (itemId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      const newMap = { ...prev };
      if (next === 0) delete newMap[itemId];
      else newMap[itemId] = next;
      return newMap;
    });
  };

  const totalSelectedQty = Object.values(quantities).reduce((a, b) => a + b, 0);

  // Submit fast menu order
  const handlePunchOrder = async () => {
    if (totalSelectedQty === 0 || loadingOrder) return;
    setLoadingOrder(true);
    try {
      const res = await fetch('/api/orders/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seatId,
          items: Object.entries(quantities).map(([menuItemId, quantity]) => ({
            menuItemId,
            quantity,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setQuantities({});
        fetchSeatDetails();
      } else {
        alert(data.error || 'Failed to place order');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOrder(false);
    }
  };

  // Settle Bill & Vacate Seat
  const handleVacateSeat = async () => {
    if (!paymentConfirmed || loadingVacate) return;
    setLoadingVacate(true);
    try {
      const res = await fetch('/api/billing/settle-vacate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seatId,
          paymentMode: session?.paymentPreferred || 'UPI',
          settledBy: 'Shiva',
        }),
      });
      const data = await res.json();
      if (data.success) {
        playSuccessChime();
        router.push('/waiter/shiva/floor');
      } else {
        alert(data.error || 'Failed to vacate seat');
        setLoadingVacate(false);
      }
    } catch (e) {
      console.error(e);
      setLoadingVacate(false);
    }
  };

  const allItems: OrderItem[] = [];
  session?.orderTickets?.forEach((t) => {
    t.items.forEach((it) => allItems.push(it));
  });

  const pendingRequests = session?.serviceRequests?.filter((r) => r.status === 'PENDING') || [];
  const latestTicketNumber = session?.orderTickets?.[0]?.ticketNumber || '105';
  const grandTotal = session?.grandTotal || 0;
  const isPayViaWaiter =
    session?.paymentLockState === 'LOCKED_WAITER' ||
    session?.paymentPreferred === 'WAITER_COLLECT' ||
    session?.paymentPreferred === 'CASH';

  const filteredMenuItems = menuItems.filter((i) =>
    selectedCategory === 'ALL' ? true : i.categoryId === selectedCategory
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col p-6 select-none font-sans">
      {/* Top Tablet Header */}
      <header className="flex items-center justify-between pb-4 border-b border-slate-800">
        <Link
          href="/waiter/shiva/floor"
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Floor</span>
        </Link>
        <div className="text-center">
          <span className="text-xs font-bold text-cyan-400">Shiva (Zone B: S9 - S16)</span>
        </div>
        <span className="text-sm font-black text-amber-400">
          Seat {seatId} {seatData?.currentGuestName && seatData.currentGuestName !== '-' ? `(${seatData.currentGuestName})` : ''}
        </span>
      </header>

      {/* Split Workspace */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5 flex-1">
        {/* ======================================================== */}
        {/* LEFT SIDE (FIXED): SEAT ORDER & SERVICE DETAILS */}
        {/* ======================================================== */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
              <div>
                <h2 className="text-sm font-black text-white uppercase tracking-wider">
                  📋 SEAT {seatId} DETAILS
                </h2>
                <span className="text-xs text-slate-400">
                  Order #{latestTicketNumber} • {allItems.length} items
                </span>
              </div>
              <span className="text-base font-black text-amber-400">
                Total: ₹{grandTotal.toFixed(2)}
              </span>
            </div>

            {/* Service Request Box */}
            <div className="mb-4">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">
                🛎️ SERVICE REQUEST :
              </span>
              {pendingRequests.length === 0 ? (
                <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl text-center text-xs text-slate-500">
                  No pending assistance
                </div>
              ) : (
                pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-amber-950/40 border border-amber-500/50 shadow-md animate-pulse"
                  >
                    <div className="flex items-center gap-2">
                      <Droplet className="w-4 h-4 text-cyan-400" />
                      <span className="font-bold text-xs text-white">
                        {req.requestType} (
                        {new Date(req.requestedAt).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                        )
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResolveService(req.id)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition active:scale-95"
                    >
                      Resolved ∨
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Ordered Dishes List */}
            <div>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">
                🍽️ ORDERED DISHES :
              </span>
              <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
                {allItems.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No dishes placed yet.</p>
                ) : (
                  allItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60"
                    >
                      <span className="font-bold text-xs text-white">
                        {item.quantity}x {item.itemName}
                      </span>

                      {/* Ready Tap-to-Serve button */}
                      {item.status === 'ready' ? (
                        <button
                          type="button"
                          onClick={() => handleMarkServed(item.id)}
                          className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] transition shadow-md shadow-emerald-500/20 active:scale-95 flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Ready ➔ Tap Served</span>
                        </button>
                      ) : (
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md capitalize ${
                            item.status === 'served'
                              ? 'bg-slate-700 text-slate-300'
                              : item.status === 'preparing'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {item.status}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Trigger Tabs at Bottom of Left Panel */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('ADD_ITEMS')}
              className={`py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition ${
                activeTab === 'ADD_ITEMS'
                  ? 'bg-cyan-500 text-slate-950 ring-2 ring-cyan-400'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Items</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PAYMENT')}
              className={`py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition ${
                isPayViaWaiter
                  ? 'bg-blue-600 hover:bg-blue-500 text-white ring-2 ring-blue-400 shadow-lg shadow-blue-500/40 animate-pulse'
                  : activeTab === 'PAYMENT'
                  ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Payment</span>
              {isPayViaWaiter && (
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              )}
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT SIDE (DYNAMIC): SINGLE-COLUMN MENU OR SETTLEMENT   */}
        {/* ======================================================== */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xl">
          {activeTab === 'ADD_ITEMS' ? (
            /* STATE A: SINGLE-COLUMN MENU */
            <>
              <div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-3">
                  <h3 className="font-black text-sm text-cyan-400 uppercase tracking-wider">
                    ➕ ADD ITEMS TO SEAT {seatId}
                  </h3>
                  <span className="text-xs font-bold text-slate-400">Single Column</span>
                </div>

                {/* Category Pills */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2.5 mb-2 border-b border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('ALL')}
                    className={`flex-shrink-0 px-3 py-1 rounded-xl text-xs font-bold transition ${
                      selectedCategory === 'ALL'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex-shrink-0 px-3 py-1 rounded-xl text-xs font-bold transition ${
                        selectedCategory === cat.id
                          ? 'bg-cyan-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* SINGLE-COLUMN VERTICAL DISH LIST */}
                <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-1">
                  {filteredMenuItems.map((item) => {
                    const qty = quantities[item.id] || 0;
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between"
                      >
                        <div>
                          <h5 className="font-bold text-xs text-white">{item.name}</h5>
                          <span className="text-[11px] font-semibold text-amber-400">
                            ₹{item.price.toFixed(0)}
                          </span>
                        </div>

                        {qty === 0 ? (
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, 1)}
                            className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-cyan-500 hover:text-slate-950 text-white font-bold text-xs transition flex items-center gap-1 active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Add</span>
                          </button>
                        ) : (
                          <div className="flex items-center bg-cyan-500 text-slate-950 rounded-xl px-2 py-1 font-black text-xs shadow-md">
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
              <div className="pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handlePunchOrder}
                  disabled={totalSelectedQty === 0 || loadingOrder}
                  className={`w-full py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition shadow-xl select-none active:scale-98 ${
                    totalSelectedQty > 0
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span>{loadingOrder ? 'Punching...' : `Place order (${totalSelectedQty}) ➔`}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            /* STATE B: SETTLE BILL & QR PANEL */
            <>
              <div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-4">
                  <h3 className="font-black text-sm text-amber-400 uppercase tracking-wider">
                    🧾 SETTLE BILL & VACATE
                  </h3>
                  <span className="text-xs text-slate-400">Ticket #{latestTicketNumber}</span>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 mb-4 space-y-1.5">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Bill Amount:</span>
                    <span className="font-mono text-white">
                      ₹{((session?.subtotal || 0) + (session?.gstAmount || 0) || grandTotal).toFixed(2)}
                    </span>
                  </div>

                  {session?.appliedPromoCode && (session.discountAmount || 0) > 0 && (
                    <div className="flex justify-between items-center text-xs text-emerald-400 font-bold bg-emerald-950/50 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                      <span>Promo Applied ({session.appliedPromoCode}):</span>
                      <span className="font-mono">-₹{session.discountAmount?.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="pt-1.5 border-t border-slate-700 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-300">Final Amount Due:</span>
                    <span className="text-2xl font-black text-amber-400 font-mono">
                      ₹{grandTotal.toFixed(2)}
                    </span>
                  </div>

                  <span className="text-xs font-bold text-stone-300 block pt-1">
                    Payment Preferred:{' '}
                    {session?.paymentPreferred === 'CASH' ? '💵 Cash at Seat' : '📱 UPI on Device'}
                  </span>
                </div>

                {/* QR Display */}
                <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 flex flex-col items-center">
                  <div className="w-40 h-40 bg-white rounded-2xl p-3 flex flex-col items-center justify-center shadow-lg">
                    <div className="w-full h-full border-4 border-slate-900 p-2 flex flex-col items-center justify-between">
                      <div className="w-full flex justify-between">
                        <div className="w-8 h-8 bg-slate-900" />
                        <div className="w-8 h-8 bg-slate-900" />
                      </div>
                      <span className="font-black text-[11px] text-slate-900">QR CODE</span>
                      <div className="w-full flex justify-between">
                        <div className="w-8 h-8 bg-slate-900" />
                        <div className="w-5 h-5 border-2 border-slate-900" />
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-300 mt-2 font-mono">
                    Amount : ₹{grandTotal.toFixed(2)}
                  </span>
                </div>

                {/* Confirmation Check */}
                <button
                  type="button"
                  onClick={() => setPaymentConfirmed(!paymentConfirmed)}
                  className="mt-4 w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-bold hover:bg-slate-800 transition"
                >
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                      paymentConfirmed ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-slate-600'
                    }`}
                  >
                    {paymentConfirmed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span className={paymentConfirmed ? 'text-emerald-400' : 'text-slate-300'}>
                    confirm payment
                  </span>
                </button>
              </div>

              {/* Vacate Seat Button */}
              <div className="pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleVacateSeat}
                  disabled={!paymentConfirmed || loadingVacate}
                  className={`w-full py-4 rounded-2xl font-black text-sm transition shadow-xl select-none active:scale-98 ${
                    paymentConfirmed
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                      : 'bg-slate-800 text-slate-500 border border-slate-800 cursor-not-allowed'
                  }`}
                >
                  {loadingVacate ? 'Vacating...' : 'Vacate Seat'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
