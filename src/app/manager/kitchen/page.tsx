'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Flame,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  SlidersHorizontal,
  ChevronRight,
  EyeOff
} from 'lucide-react';
import { useSocketRoom } from '@/lib/useSocket';
import { playKitchenBell } from '@/lib/audio-synth';

interface OrderItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  status: 'RECEIVED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
  isVeg: boolean;
  notes?: string;
}

interface Ticket {
  id: string;
  ticketNumber: string;
  orderType: string;
  seatId?: number;
  customerName?: string;
  status: string;
  placedAt: string;
  items: OrderItem[];
}

interface MenuItem86 {
  id: string;
  name: string;
  category: { name: string };
  price: number;
  isAvailable: boolean;
  isVeg: boolean;
}

export default function ManagerKitchenOversightScreen() {
  const socket = useSocketRoom('room:manager');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem86[]>([]);
  const [loading, setLoading] = useState(true);
  const [show86Drawer, setShow86Drawer] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'DINE_IN' | 'PARCEL'>('ALL');

  const fetchKdsData = async () => {
    try {
      const [ticketsRes, menuRes] = await Promise.all([
        fetch('/api/kitchen/tickets'),
        fetch('/api/menu'),
      ]);
      const ticketsData = await ticketsRes.json();
      const menuData = await menuRes.json();

      if (ticketsData.success) {
        setTickets(ticketsData.data);
      }
      if (menuData.success) {
        setMenuItems(menuData.data.items);
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKdsData();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleTicket = () => {
      playKitchenBell();
      fetchKdsData();
    };
    const handleStatus = () => fetchKdsData();

    socket.on('order:placed', handleTicket);
    socket.on('order:item_status_changed', handleStatus);
    socket.on('menu:item_86_toggled', handleStatus);
    socket.on('menu:updated', handleStatus);

    return () => {
      socket.off('order:placed', handleTicket);
      socket.off('order:item_status_changed', handleStatus);
      socket.off('menu:item_86_toggled', handleStatus);
      socket.off('menu:updated', handleStatus);
    };
  }, [socket]);

  // Toggle item 86 availability
  const handleToggle86 = async (itemId: string, currentStatus: boolean) => {
    try {
      await fetch('/api/kitchen/toggle-86', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, isAvailable: !currentStatus }),
      });
      fetchKdsData();
    } catch (e) {
      console.error(e);
    }
  };

  // Update item status in KDS
  const handleUpdateItemStatus = async (ticketId: string, itemId: string, newStatus: string) => {
    try {
      await fetch(`/api/orders/${ticketId}/item-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, status: newStatus }),
      });
      fetchKdsData();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (filterType === 'DINE_IN') return t.orderType === 'DINE_IN';
    if (filterType === 'PARCEL') return t.orderType === 'TAKEAWAY';
    return true;
  });

  const receivedItems: { ticket: Ticket; item: OrderItem }[] = [];
  const cookingItems: { ticket: Ticket; item: OrderItem }[] = [];
  const readyItems: { ticket: Ticket; item: OrderItem }[] = [];

  filteredTickets.forEach((ticket) => {
    ticket.items.forEach((item) => {
      if (item.status === 'RECEIVED') receivedItems.push({ ticket, item });
      else if (item.status === 'PREPARING') cookingItems.push({ ticket, item });
      else if (item.status === 'READY') readyItems.push({ ticket, item });
    });
  });

  const total86Count = menuItems.filter((i) => !i.isAvailable).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none">
      {/* Executive Header */}
      <header className="h-16 bg-[#181513] border-b border-[#2C2520] px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8A4228]/25 text-[#D08A52] border border-[#8A4228]/40 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white uppercase tracking-wider">
              THOOGUDEEPA DONNE BIRYANI
            </h1>
            <p className="text-[11px] text-[#D08A52] font-semibold tracking-wide">Executive Kitchen Oversight (KDS)</p>
          </div>
        </div>

        {/* 9 Manager Portal Navigation Links */}
        <nav className="flex items-center gap-1.5 bg-[#100E0C] p-1.5 rounded-2xl border border-[#2C2520] text-xs font-bold">
          <Link href="/manager/floor" className="px-3 py-1.5 rounded-xl text-stone-400 hover:text-white transition">
            Live Floor
          </Link>
          <Link href="/manager/kitchen" className="px-3 py-1.5 rounded-xl bg-[#8A4228] text-white shadow-sm">
            Kitchen Oversight
          </Link>
          <Link href="/manager/menu" className="px-3 py-1.5 rounded-xl text-stone-400 hover:text-white transition">
            Menu Items
          </Link>
          <Link href="/manager/qrs" className="px-3 py-1.5 rounded-xl text-stone-400 hover:text-white transition">
            16 QRs
          </Link>
          <Link href="/manager/shift" className="px-3 py-1.5 rounded-xl text-stone-400 hover:text-white transition">
            Shift Audit
          </Link>
          <Link href="/manager/parcel" className="px-3 py-1.5 rounded-xl text-stone-400 hover:text-white transition">
            Parcel Desk
          </Link>
          <Link href="/manager/reports" className="px-3 py-1.5 rounded-xl text-stone-400 hover:text-white transition">
            Reports
          </Link>
          <Link href="/manager/promos" className="px-3 py-1.5 rounded-xl text-stone-400 hover:text-white transition">
            Offers & Promos
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShow86Drawer(true)}
            className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-bold hover:bg-amber-500/20"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>86 Items Drawer</span>
            {total86Count > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[10px] font-black">
                {total86Count}
              </span>
            )}
          </button>
          <Link
            href="/manager"
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition"
            title="Lock Portal"
          >
            <LogOut className="w-5 h-5" />
          </Link>
        </div>
      </header>

      {/* Filter and Metrics Bar */}
      <div className="h-12 bg-slate-900/50 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Channel:</span>
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              filterType === 'ALL' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            All Channels ({tickets.length})
          </button>
          <button
            onClick={() => setFilterType('DINE_IN')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              filterType === 'DINE_IN' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Dine-In (S1–S16)
          </button>
          <button
            onClick={() => setFilterType('PARCEL')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              filterType === 'PARCEL' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Parcel Desk
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs font-bold">
          <div className="flex items-center gap-2 text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Received: {receivedItems.length}</span>
          </div>
          <div className="flex items-center gap-2 text-blue-400">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <span>Cooking: {cookingItems.length}</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>Ready: {readyItems.length}</span>
          </div>
        </div>
      </div>

      {/* 3-Column KDS Live Board */}
      <div className="flex-1 p-6 grid grid-cols-3 gap-6 overflow-hidden">
        {/* Column 1: Received Orders */}
        <div className="flex flex-col bg-slate-900/60 rounded-2xl border border-amber-500/20 overflow-hidden">
          <div className="p-3.5 bg-amber-950/30 border-b border-amber-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <h2 className="font-black text-amber-400 text-sm tracking-wide">
                1. RECEIVED ORDERS ({receivedItems.length})
              </h2>
            </div>
            <span className="text-[10px] uppercase font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded">
              Awaiting Cook
            </span>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-3">
            {receivedItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16">
                <CheckCircle2 className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs font-bold">No orders waiting</p>
              </div>
            ) : (
              receivedItems.map(({ ticket, item }) => (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 hover:border-amber-500/40 transition shadow-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-xs font-black text-amber-400">
                        {ticket.orderType === 'TAKEAWAY' ? 'PARCEL' : `SEAT ${ticket.seatId}`}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-2 font-mono">
                        #{ticket.ticketNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>{new Date(ticket.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 font-black text-xs flex items-center justify-center">
                        {item.quantity}x
                      </span>
                      <div>
                        <div className="text-sm font-black text-white">{item.itemName}</div>
                        {item.notes && <div className="text-[11px] text-amber-400 italic">Note: {item.notes}</div>}
                      </div>
                    </div>

                    <button
                      onClick={() => handleUpdateItemStatus(ticket.id, item.id, 'PREPARING')}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>Start Cook</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Items Cooking */}
        <div className="flex flex-col bg-slate-900/60 rounded-2xl border border-blue-500/20 overflow-hidden">
          <div className="p-3.5 bg-blue-950/30 border-b border-blue-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
              <h2 className="font-black text-blue-400 text-sm tracking-wide">
                2. ITEMS COOKING ({cookingItems.length})
              </h2>
            </div>
            <span className="text-[10px] uppercase font-bold text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded">
              On Stove / Pot
            </span>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-3">
            {cookingItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16">
                <Flame className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs font-bold">No items currently on heat</p>
              </div>
            ) : (
              cookingItems.map(({ ticket, item }) => (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 hover:border-blue-500/40 transition shadow-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-xs font-black text-blue-400">
                        {ticket.orderType === 'TAKEAWAY' ? 'PARCEL' : `SEAT ${ticket.seatId}`}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-2 font-mono">
                        #{ticket.ticketNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-blue-400" />
                      <span>{new Date(ticket.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 font-black text-xs flex items-center justify-center">
                        {item.quantity}x
                      </span>
                      <div>
                        <div className="text-sm font-black text-white">{item.itemName}</div>
                        {item.notes && <div className="text-[11px] text-blue-400 italic">Note: {item.notes}</div>}
                      </div>
                    </div>

                    <button
                      onClick={() => handleUpdateItemStatus(ticket.id, item.id, 'READY')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Ready</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Items Ready (Pickup Desk) */}
        <div className="flex flex-col bg-slate-900/60 rounded-2xl border border-emerald-500/20 overflow-hidden">
          <div className="p-3.5 bg-emerald-950/30 border-b border-emerald-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <h2 className="font-black text-emerald-400 text-sm tracking-wide">
                3. READY FOR PICKUP ({readyItems.length})
              </h2>
            </div>
            <span className="text-[10px] uppercase font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded">
              Pass Counter
            </span>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-3">
            {readyItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16">
                <CheckCircle2 className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs font-bold">Pass counter clear</p>
              </div>
            ) : (
              readyItems.map(({ ticket, item }) => (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 hover:border-emerald-500/40 transition shadow-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-xs font-black text-emerald-400">
                        {ticket.orderType === 'TAKEAWAY' ? 'PARCEL' : `SEAT ${ticket.seatId}`}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-2 font-mono">
                        #{ticket.ticketNumber}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      Waiter Alert Sent
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 font-black text-xs flex items-center justify-center">
                        {item.quantity}x
                      </span>
                      <div className="text-sm font-black text-white">{item.itemName}</div>
                    </div>

                    <button
                      onClick={() => handleUpdateItemStatus(ticket.id, item.id, 'SERVED')}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold"
                    >
                      Served ✓
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 86 Items Drawer Modal */}
      {show86Drawer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-md bg-slate-900 h-full border-l border-slate-800 flex flex-col shadow-2xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-black text-amber-400 text-sm">Kitchen 86 Control Center</h3>
                <p className="text-[11px] text-slate-400">Instantly take dishes on/off menu live</p>
              </div>
              <button
                onClick={() => setShow86Drawer(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-2">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border flex items-center justify-between transition ${
                    item.isAvailable
                      ? 'bg-slate-950 border-slate-800'
                      : 'bg-red-950/20 border-red-500/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          item.isVeg ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      />
                      <span className="font-bold text-sm text-white">{item.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {item.category?.name} • ₹{item.price}
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggle86(item.id, item.isAvailable)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                      item.isAvailable
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-red-500/20 hover:text-red-400'
                        : 'bg-red-500 text-white hover:bg-emerald-600'
                    }`}
                  >
                    {item.isAvailable ? 'AVAILABLE (86 Off)' : 'SOLD OUT (86 ON)'}
                  </button>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800">
              <button
                onClick={() => setShow86Drawer(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
