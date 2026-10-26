'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChefHat, Check, Volume2, Package, X, AlertTriangle, ArrowRight } from 'lucide-react';
import { useSocketRoom } from '@/lib/useSocket';
import { playKitchenBell, unlockAudio } from '@/lib/audio-synth';
import AudioShield from '@/components/AudioShield';

interface OrderItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  status: 'placed' | 'preparing' | 'ready' | 'served' | 'cancelled';
  specialNotes?: string;
}

interface Ticket {
  id: string;
  ticketNumber: string;
  orderType: 'DINE_IN' | 'PARCEL';
  seatId?: number;
  customerName: string;
  customerPhone?: string;
  placedAtTime: string;
  status: 'RECEIVED' | 'COOKING' | 'READY' | 'COMPLETED';
  waiterName: string;
  specialNotes?: string;
  items: OrderItem[];
}

interface MenuItem86 {
  id: string;
  name: string;
  isAvailable: boolean;
  price: number;
}

export default function KitchenKdsBoard() {
  const socket = useSocketRoom('room:kitchen');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem86[]>([]);
  const [show86Drawer, setShow86Drawer] = useState(false);
  const [loading, setLoading] = useState(true);
  const prevTicketCountRef = React.useRef<number | null>(null);
  const isMutatingRef = React.useRef(false);

  // Fetch initial tickets and 86 items
  const fetchTickets = (force = false) => {
    if (isMutatingRef.current && !force) return;
    fetch(`/api/kitchen/tickets?t=${Date.now()}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          // If new tickets arrived, ring the kitchen bell
          if (
            prevTicketCountRef.current !== null &&
            data.data.length > prevTicketCountRef.current
          ) {
            playKitchenBell();
          }
          prevTicketCountRef.current = data.data.length;
          setTickets(data.data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  const fetchMenu = () => {
    fetch(`/api/menu?t=${Date.now()}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setMenuItems(data.data.items);
        }
      });
  };

  useEffect(() => {
    unlockAudio();
    fetchTickets(true);
    fetchMenu();

    // 3-second background polling backup (skipped during active mutations to prevent flicker)
    const interval = setInterval(() => {
      fetchTickets();
    }, 3000);

    // Instant re-fetch on window focus / tab visibility
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchTickets(true);
      }
    };
    window.addEventListener('focus', () => fetchTickets(true));
    window.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', () => fetchTickets(true));
      window.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Real-time synchronization
  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = () => {
      playKitchenBell();
      fetchTickets(true);
    };

    const handleItemStatusChanged = () => {
      fetchTickets();
    };

    const handleSeatVacated = () => {
      fetchTickets(true);
    };

    socket.on('order:placed', handleNewOrder);
    socket.on('order:item_status_changed', handleItemStatusChanged);
    socket.on('seat:vacated', handleSeatVacated);
    socket.on('menu:item_86_toggled', fetchMenu);
    socket.on('menu:updated', fetchMenu);
    socket.on('connect', () => fetchTickets(true));

    return () => {
      socket.off('order:placed', handleNewOrder);
      socket.off('order:item_status_changed', handleItemStatusChanged);
      socket.off('seat:vacated', handleSeatVacated);
      socket.off('menu:item_86_toggled', fetchMenu);
      socket.off('menu:updated', fetchMenu);
      socket.off('connect', () => fetchTickets(true));
    };
  }, [socket]);

  // Update item status with Optimistic UI transition
  const handleItemStatus = async (orderItemId: string, status: string) => {
    isMutatingRef.current = true;

    // 1. Instant Optimistic UI Update
    setTickets((prev) =>
      prev.map((t) => ({
        ...t,
        items: t.items.map((i) =>
          i.id === orderItemId ? { ...i, status: status as any } : i
        ),
      }))
    );

    // 2. Server mutation
    try {
      await fetch(`/api/orders/${orderItemId}/item-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } catch (e) {
      console.error(e);
    } finally {
      isMutatingRef.current = false;
      fetchTickets(true);
    }
  };

  // Batch update all items in ticket atomically in a single request
  const handleBatchStatus = async (ticket: Ticket, targetStatus: 'preparing' | 'ready') => {
    isMutatingRef.current = true;

    // 1. Instant Optimistic UI Update (entire ticket slides to next column instantly)
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticket.id) return t;
        const mappedStatus = targetStatus === 'preparing' ? 'COOKING' : 'READY';
        return {
          ...t,
          status: mappedStatus as any,
          items: t.items.map((it) => ({
            ...it,
            status: targetStatus === 'preparing'
              ? (it.status === 'placed' ? 'preparing' : it.status)
              : (it.status !== 'cancelled' ? 'ready' : it.status),
          })),
        };
      })
    );

    // 2. Single Atomic Server Mutation
    try {
      await fetch('/api/orders/batch-item-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: ticket.id, status: targetStatus }),
      });
    } catch (e) {
      console.error(e);
    } finally {
      isMutatingRef.current = false;
      fetchTickets(true);
    }
  };

  // Toggle 86 Out of Stock
  const handleToggle86 = async (item: MenuItem86) => {
    try {
      const res = await fetch('/api/kitchen/toggle-86', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuItemId: item.id,
          isAvailable: !item.isAvailable,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMenuItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, isAvailable: !i.isAvailable } : i))
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Categorize tickets into 3 columns
  const receivedTickets = tickets.filter(
    (t) => t.status === 'RECEIVED' || t.items.some((i) => i.status === 'placed')
  );

  const cookingTickets = tickets.filter(
    (t) => t.items.some((i) => i.status === 'preparing')
  );

  const readyTickets = tickets.filter(
    (t) => t.items.some((i) => i.status === 'ready')
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none">
      {/* Top Navigation Bar */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-wider text-emerald-400 uppercase">
              Thoogudeepa KDS
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              Live Kitchen Display System • 3-Column Ticket Board
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={playKitchenBell}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition"
          >
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <span>Test Chime</span>
          </button>

          {/* 86 Drawer Button */}
          <button
            type="button"
            onClick={() => setShow86Drawer(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs transition"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>86 / Stock Manager</span>
          </button>

          <Link
            href="/kitchen"
            className="text-xs text-slate-500 hover:text-slate-300 font-medium ml-2"
          >
            Switch Staff
          </Link>
        </div>
      </header>

      {/* 3-Column Main Board */}
      <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        {/* ======================================================== */}
        {/* COLUMN 1: RECEIVED ORDERS */}
        {/* ======================================================== */}
        <div className="flex flex-col bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-black text-sm tracking-widest text-amber-400 uppercase flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              RECEIVED ORDERS ({receivedTickets.length})
            </h2>
          </div>

          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {receivedTickets.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-slate-500 font-medium">
                No new received orders
              </div>
            ) : (
              receivedTickets.map((ticket) => {
                const placedItems = ticket.items.filter((i) => i.status === 'placed');
                if (placedItems.length === 0) return null;

                const isParcel = ticket.orderType === 'PARCEL';

                return (
                  <div
                    key={ticket.id}
                    className={`rounded-2xl border p-4 shadow-lg flex flex-col justify-between transition ${
                      isParcel
                        ? 'bg-amber-950/30 border-amber-500/50'
                        : 'bg-slate-850 bg-slate-900 border-slate-700/80'
                    }`}
                  >
                    <div>
                      {/* Ticket Header with Exact Placed Time */}
                      <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-base text-white">
                              {isParcel ? `📦 ${ticket.ticketNumber}` : `Seat ${ticket.seatId}`}
                            </span>
                            <span className="text-xs font-bold text-slate-400">
                              #{ticket.ticketNumber}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 block font-medium">
                            {ticket.customerName !== '-' ? ticket.customerName : 'Diner'} • Waiter: {ticket.waiterName}
                          </span>
                        </div>

                        {/* Order Placed Time */}
                        <div className="text-right">
                          <span className="text-xs font-black text-amber-400 block">
                            🕒 {ticket.placedAtTime}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-slate-500">
                            Placed Time
                          </span>
                        </div>
                      </div>

                      {/* Items List with Individual Checkmarks */}
                      <div className="space-y-2 mb-4">
                        {placedItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700/50"
                          >
                            <div>
                              <span className="font-bold text-sm text-white">
                                {item.quantity}x {item.itemName}
                              </span>
                              {item.specialNotes && (
                                <p className="text-[10px] text-amber-400 font-medium">
                                  Note: {item.specialNotes}
                                </p>
                              )}
                            </div>

                            {/* Checkmark to move individual item to cooking */}
                            <button
                              type="button"
                              onClick={() => handleItemStatus(item.id, 'preparing')}
                              className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-blue-600 text-white flex items-center justify-center font-bold text-xs transition active:scale-95"
                              title="Start Cooking this item"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Batch Action: Mark All Cooking -> */}
                    <button
                      type="button"
                      onClick={() => handleBatchStatus(ticket, 'preparing')}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs tracking-wider transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 active:scale-98"
                    >
                      <span>Mark all cooking</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 2: ITEMS COOKING */}
        {/* ======================================================== */}
        <div className="flex flex-col bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-black text-sm tracking-widest text-blue-400 uppercase flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
              ITEMS COOKING ({cookingTickets.length})
            </h2>
          </div>

          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {cookingTickets.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-slate-500 font-medium">
                No items currently cooking
              </div>
            ) : (
              cookingTickets.map((ticket) => {
                const cookingItems = ticket.items.filter((i) => i.status === 'preparing');
                if (cookingItems.length === 0) return null;

                const isParcel = ticket.orderType === 'PARCEL';

                return (
                  <div
                    key={ticket.id}
                    className={`rounded-2xl border p-4 shadow-lg flex flex-col justify-between transition ${
                      isParcel
                        ? 'bg-amber-950/20 border-amber-600/40'
                        : 'bg-slate-900 border-blue-900/50'
                    }`}
                  >
                    <div>
                      {/* Ticket Header with Placed Time */}
                      <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-base text-white">
                              {isParcel ? `📦 ${ticket.ticketNumber}` : `Seat ${ticket.seatId}`}
                            </span>
                            <span className="text-xs font-bold text-slate-400">
                              #{ticket.ticketNumber}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 block font-medium">
                            {ticket.customerName !== '-' ? ticket.customerName : 'Diner'} • Waiter: {ticket.waiterName}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-black text-blue-400 block">
                            🕒 {ticket.placedAtTime}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-slate-500">
                            Placed Time
                          </span>
                        </div>
                      </div>

                      {/* Items Cooking with Checkmarks */}
                      <div className="space-y-2 mb-4">
                        {cookingItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-blue-900/40"
                          >
                            <div>
                              <span className="font-bold text-sm text-white">
                                {item.quantity}x {item.itemName}
                              </span>
                              {item.specialNotes && (
                                <p className="text-[10px] text-amber-400 font-medium">
                                  {item.specialNotes}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {/* Single-Item Cancel button */}
                              <button
                                type="button"
                                onClick={() => handleItemStatus(item.id, 'cancelled')}
                                title="Cancel item if unavailable"
                                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-500 hover:text-rose-300 flex items-center justify-center text-xs"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>

                              {/* Checkmark to mark Ready */}
                              <button
                                type="button"
                                onClick={() => handleItemStatus(item.id, 'ready')}
                                className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-emerald-600 text-white flex items-center justify-center font-bold text-xs transition active:scale-95"
                                title="Mark Ready"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Batch Action: Mark All Ready -> */}
                    <button
                      type="button"
                      onClick={() => handleBatchStatus(ticket, 'ready')}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs tracking-wider transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-98"
                    >
                      <span>Mark all Ready</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 3: ITEMS READY */}
        {/* ======================================================== */}
        <div className="flex flex-col bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-black text-sm tracking-widest text-emerald-400 uppercase flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              ITEMS READY ({readyTickets.length})
            </h2>
          </div>

          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {readyTickets.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-slate-500 font-medium">
                No items waiting for pickup
              </div>
            ) : (
              readyTickets.map((ticket) => {
                const readyItems = ticket.items.filter((i) => i.status === 'ready');
                if (readyItems.length === 0) return null;

                const isParcel = ticket.orderType === 'PARCEL';

                return (
                  <div
                    key={ticket.id}
                    className={`rounded-2xl border p-4 shadow-lg transition ${
                      isParcel
                        ? 'bg-amber-950/30 border-emerald-500/50'
                        : 'bg-slate-900 border-emerald-500/50'
                    }`}
                  >
                    <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-base text-white">
                            {isParcel ? `📦 ${ticket.ticketNumber}` : `Seat ${ticket.seatId}`}
                          </span>
                          <span className="text-xs font-bold text-slate-400">
                            #{ticket.ticketNumber}
                          </span>
                        </div>
                        <span className="text-[11px] text-emerald-400 block font-semibold">
                          Alert Sent to: {ticket.waiterName}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-black text-emerald-400 block">
                          🕒 {ticket.placedAtTime}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-slate-500">
                          Placed Time
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {readyItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-emerald-950/20 border border-emerald-500/30"
                        >
                          <span className="font-bold text-sm text-white">
                            {item.quantity}x {item.itemName}
                          </span>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">
                            Ready for Pickup
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 86 Out of Stock Slide-in Drawer */}
      {show86Drawer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-slate-900 h-full border-l border-slate-800 p-6 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <div>
                  <h3 className="font-black text-base text-white uppercase">86 / Stock Manager</h3>
                  <p className="text-xs text-slate-400">Toggle dish availability across all customer menus</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShow86Drawer(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2.5 max-h-[75vh] overflow-y-auto pr-1">
                {menuItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 border border-slate-700/70"
                  >
                    <div>
                      <h5 className="font-bold text-xs text-white">{item.name}</h5>
                      <span className="text-[11px] font-semibold text-amber-400">₹{item.price.toFixed(0)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggle86(item)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                        item.isAvailable
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-500'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-emerald-950/40 hover:text-emerald-400 hover:border-emerald-500'
                      }`}
                    >
                      {item.isAvailable ? '🟢 In Stock' : '🔴 SOLD OUT'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShow86Drawer(false)}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
            >
              Close Drawer
            </button>
          </div>
        </div>
      )}
      {/* Audio Autoplay Unblocking Shield */}
      <AudioShield label="Tap to Arm Kitchen Bell" />
    </div>
  );
}
