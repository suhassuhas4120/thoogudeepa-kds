'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, EyeOff, X, Check, Clock } from 'lucide-react';
import { useSocketRoom } from '@/lib/useSocket';
import { playKitchenBell } from '@/lib/audio-synth';

interface OrderItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  status: 'placed' | 'preparing' | 'ready' | 'served' | 'cancelled';
  notes?: string;
}

interface Ticket {
  id: string;
  ticketNumber: string;
  orderType: string;
  seatId?: number;
  customerName?: string;
  status: string;
  placedAtTime?: string;
  placedAt?: string;
  createdAt?: string;
  waiterName?: string;
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

export default function ManagerKitchenMonitorScreen() {
  const socket = useSocketRoom('room:manager');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem86[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'COOKING' | 'READY' | 'COMPLETED'>('ALL');
  const [show86Drawer, setShow86Drawer] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

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
    const interval = setInterval(fetchKdsData, 10000); // Polling backup
    return () => clearInterval(interval);
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

  // Helper to compute elapsed minutes
  const getElapsedMinutes = (placedTimeStr?: string, createdAtStr?: string) => {
    if (!placedTimeStr && !createdAtStr) return 5;
    try {
      const placedDate = createdAtStr ? new Date(createdAtStr) : new Date();
      const diffMs = Date.now() - placedDate.getTime();
      const mins = Math.max(1, Math.floor(diffMs / 60000));
      return isNaN(mins) ? 6 : mins;
    } catch {
      return 5;
    }
  };

  // Compute status summary of ticket
  const getTicketStatusBadge = (ticket: Ticket) => {
    const items = ticket.items || [];
    if (items.length === 0) return { label: '⚪ Placed', color: 'text-stone-400 bg-stone-800' };
    if (items.every((i) => i.status === 'served')) {
      return { label: '✔️ Done', color: 'text-stone-400 bg-stone-800/60' };
    }
    if (items.some((i) => i.status === 'ready')) {
      return { label: '🟢 Ready', color: 'text-emerald-400 bg-emerald-950/60 border border-emerald-500/40' };
    }
    if (items.some((i) => i.status === 'preparing' || i.status === 'placed')) {
      return { label: '🔵 Cook', color: 'text-sky-400 bg-sky-950/60 border border-sky-500/40' };
    }
    return { label: '⚪ Placed', color: 'text-stone-300 bg-stone-800' };
  };

  // Filter tickets
  const filteredTickets = tickets.filter((t) => {
    const items = t.items || [];
    const isCompleted = items.length > 0 && items.every((i) => i.status === 'served' || i.status === 'cancelled');
    const isReady = items.some((i) => i.status === 'ready');
    const isCooking = items.some((i) => i.status === 'preparing' || i.status === 'placed') && !isReady;

    if (activeFilter === 'COOKING') return isCooking;
    if (activeFilter === 'READY') return isReady;
    if (activeFilter === 'COMPLETED') return isCompleted;
    return !isCompleted; // ALL active orders
  });

  const soldOutCount = menuItems.filter((i) => !i.isAvailable).length;

  return (
    <div className="min-h-screen bg-[#100E0C] text-white flex flex-col font-sans select-none">
      {/* ────────────────────────────────────────────────────────────────── */}
      {/* TOP HEADER MATCHING ASCII: ← Back to Floor | Title | [ 86 Items ]   */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <header className="h-14 bg-[#181513] border-b border-[#2C2520] px-6 flex items-center justify-between shrink-0">
        <Link
          href="/manager/floor"
          className="flex items-center gap-1.5 text-xs font-bold text-stone-300 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4 text-[#D08A52]" />
          <span>← Back to Floor</span>
        </Link>

        <h1 className="text-sm font-black text-white tracking-widest uppercase">
          KITCHEN MONITOR & ACTIVE TICKETS
        </h1>

        <button
          type="button"
          onClick={() => setShow86Drawer(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
            soldOutCount > 0
              ? 'bg-rose-950/60 text-rose-300 border border-rose-500/40 hover:bg-rose-900/60'
              : 'bg-[#221D1A] text-stone-300 border border-[#2C2520] hover:text-white'
          }`}
        >
          <EyeOff className="w-3.5 h-3.5" />
          <span>[ 86 / Sold Out Items ({soldOutCount}) ]</span>
        </button>
      </header>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* FILTER BUTTONS MATCHING ASCII                                      */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <div className="bg-[#141210] border-b border-[#2C2520] px-6 py-2.5 flex items-center gap-2">
        <span className="text-xs font-bold text-stone-400 mr-2">Filters:</span>

        <button
          type="button"
          onClick={() => setActiveFilter('ALL')}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
            activeFilter === 'ALL'
              ? 'bg-[#8A4228] text-white shadow-sm'
              : 'bg-[#1C1815] text-stone-400 hover:text-white border border-[#2C2520]'
          }`}
        >
          [ All Active ({tickets.filter((t) => !t.items?.every((i) => i.status === 'served')).length}) ]
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('COOKING')}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
            activeFilter === 'COOKING'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'bg-[#1C1815] text-stone-400 hover:text-white border border-[#2C2520]'
          }`}
        >
          [ Cooking ({tickets.filter((t) => t.items?.some((i) => i.status === 'preparing' || i.status === 'placed')).length}) ]
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('READY')}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
            activeFilter === 'READY'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-[#1C1815] text-stone-400 hover:text-white border border-[#2C2520]'
          }`}
        >
          [ Ready ({tickets.filter((t) => t.items?.some((i) => i.status === 'ready')).length}) ]
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('COMPLETED')}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
            activeFilter === 'COMPLETED'
              ? 'bg-stone-700 text-white shadow-sm'
              : 'bg-[#1C1815] text-stone-400 hover:text-white border border-[#2C2520]'
          }`}
        >
          [ Completed Today ({tickets.filter((t) => t.items?.length > 0 && t.items.every((i) => i.status === 'served')).length}) ]
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* MASTER TICKETS TABLE MATCHING ASCII EXACT COLUMNS                  */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 p-6 overflow-x-auto">
        <div className="bg-[#181513] border border-[#2C2520] rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#13110F] border-b border-[#2C2520] text-stone-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">TICKET</th>
                <th className="py-3 px-3">SEAT</th>
                <th className="py-3 px-4">SERVER</th>
                <th className="py-3 px-4">ITEMS</th>
                <th className="py-3 px-3">ORDERED</th>
                <th className="py-3 px-3">ELAPSED</th>
                <th className="py-3 px-3">STATUS</th>
                <th className="py-3 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#26201B]">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-500">
                    No tickets found in this filter view.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => {
                  const itemsSummary = (ticket.items || [])
                    .map((i) => `${i.itemName} x${i.quantity}`)
                    .join(', ');
                  const elapsedMins = getElapsedMinutes(ticket.placedAtTime, ticket.createdAt);
                  const isWarning = elapsedMins >= 12;
                  const statusBadge = getTicketStatusBadge(ticket);
                  const seatDisplay = ticket.orderType === 'TAKEAWAY' ? '📦 Takeaway' : `S${ticket.seatId || '1'}`;
                  const serverName = ticket.waiterName || (ticket.seatId && ticket.seatId <= 8 ? 'Suhas' : 'Shiva');

                  return (
                    <tr key={ticket.id} className="hover:bg-[#201B18] transition">
                      <td className="py-3 px-4 font-mono font-black text-amber-400">
                        #{ticket.ticketNumber}
                      </td>
                      <td className="py-3 px-3 font-bold text-white">
                        {seatDisplay}
                      </td>
                      <td className="py-3 px-4 text-stone-300 font-medium">
                        {serverName}
                      </td>
                      <td className="py-3 px-4 text-stone-200 max-w-md truncate" title={itemsSummary}>
                        {itemsSummary}
                      </td>
                      <td className="py-3 px-3 text-stone-400 font-mono">
                        {ticket.placedAtTime || '12:20 PM'}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-mono font-bold ${
                            isWarning ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {String(elapsedMins).padStart(2, '0')}m {isWarning ? '(⚠️)' : '(OK)'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedTicket(ticket)}
                          className="px-3 py-1 rounded-lg bg-[#8A4228] hover:bg-[#71351F] text-white font-bold text-xs transition active:scale-95 shadow-sm"
                        >
                          [ Details ]
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* TICKET DETAILS MODAL                                               */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#181513] border border-[#2C2520] rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-start pb-3 border-b border-[#2C2520] mb-4">
              <div>
                <h3 className="font-black text-base text-white">
                  Ticket #{selectedTicket.ticketNumber} • {selectedTicket.orderType === 'TAKEAWAY' ? 'Takeaway' : `Seat ${selectedTicket.seatId}`}
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Placed: {selectedTicket.placedAtTime || '12:20 PM'} • Server: {selectedTicket.waiterName || 'Staff'}
                </p>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 mb-6 max-h-[45vh] overflow-y-auto pr-1">
              {selectedTicket.items?.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-[#221D1A] border border-[#2C2520] rounded-xl flex justify-between items-center text-xs"
                >
                  <div>
                    <span className="font-bold text-white block">
                      {item.quantity}x {item.itemName}
                    </span>
                    <span className="text-[10px] text-stone-400 block capitalize">
                      Status: {item.status}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-[#D08A52]">
                    ₹{(item.unitPrice * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setSelectedTicket(null)}
              className="w-full py-3 bg-[#8A4228] hover:bg-[#71351F] text-white font-bold text-xs rounded-xl transition"
            >
              Close Details
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 86 SOLD OUT ITEMS SLIDE-OVER DRAWER                                */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {show86Drawer && (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-end">
          <div className="bg-[#181513] border-l border-[#2C2520] w-full max-w-md h-full flex flex-col p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-[#2C2520] mb-4">
              <div>
                <h3 className="font-black text-sm text-white uppercase tracking-wider">
                  86 / Sold Out Item Manager
                </h3>
                <p className="text-xs text-stone-400">Instantly toggle dish availability across all customer menus</p>
              </div>
              <button
                onClick={() => setShow86Drawer(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-[#221D1A] border border-[#2C2520] rounded-xl flex justify-between items-center"
                >
                  <div>
                    <span className="font-bold text-xs text-white block">{item.name}</span>
                    <span className="text-[10px] text-stone-400">{item.category?.name} • ₹{item.price}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle86(item.id, item.isAvailable)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                      item.isAvailable
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 hover:bg-rose-950 hover:text-rose-300 hover:border-rose-500/40'
                        : 'bg-rose-950/80 text-rose-300 border border-rose-500/40 hover:bg-emerald-950 hover:text-emerald-300 hover:border-emerald-500/40'
                    }`}
                  >
                    {item.isAvailable ? '🟢 Available' : '🔴 SOLD OUT'}
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-[#2C2520]">
              <button
                type="button"
                onClick={() => setShow86Drawer(false)}
                className="w-full py-3 bg-[#8A4228] hover:bg-[#71351F] text-white font-bold text-xs rounded-xl transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
