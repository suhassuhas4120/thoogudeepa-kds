'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, EyeOff, X, Check, Clock, PackageCheck, Phone, User, FileText, Receipt, Layers, ExternalLink, Printer } from 'lucide-react';
import { useSocketRoom } from '@/lib/useSocket';
import { playKitchenBell } from '@/lib/audio-synth';
import ManagerTopNav from '@/components/ManagerTopNav';

interface OrderItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  status: 'placed' | 'preparing' | 'ready' | 'served' | 'cancelled';
  notes?: string;
  specialNotes?: string;
}

interface SessionRoundInfo {
  ticketNumber: string;
  roundNumber: number;
  placedAt: string;
  itemsCount: number;
  subtotal: number;
  itemsSummary: string;
}

interface Ticket {
  id: string;
  ticketNumber: string;
  orderType: string;
  seatId?: number;
  sessionId?: string;
  customerName?: string;
  customerPhone?: string;
  status: string;
  placedAtTime?: string;
  placedAt?: string;
  createdAt?: string;
  waiterName?: string;
  specialNotes?: string;
  totalAmount?: number;
  roundNumber?: number;
  totalRounds?: number;
  sessionRounds?: SessionRoundInfo[];
  invoiceNumber?: string | null;
  billSubtotal?: number;
  billGst?: number;
  billGrandTotal?: number;
  billPaymentMode?: string | null;
  billPaymentStatus?: string;
  billSettledAt?: string | null;
  items: OrderItem[];
}

interface MasterBill {
  id: string;
  billNumber: string;
  date: string;
  orderType: string;
  seatNumberOrToken: string;
  customerName: string;
  customerPhone?: string | null;
  serverName: string;
  itemsSummary: string;
  placedAt: string;
  settledAt: string;
  subtotal: number;
  discountAmount: number;
  packagingCharges: number;
  gst5Percent: number;
  grandTotal: number;
  paymentMode: string;
  paymentStatus: string;
  createdAt: string;
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
  const [masterBills, setMasterBills] = useState<MasterBill[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem86[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'KOT_TICKETS' | 'MASTER_BILLS'>('KOT_TICKETS');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'PARCELS' | 'COOKING' | 'READY' | 'COMPLETED'>('ALL');
  const [show86Drawer, setShow86Drawer] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedMasterBill, setSelectedMasterBill] = useState<MasterBill | null>(null);
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);

  const fetchKdsData = async () => {
    try {
      const [ticketsRes, menuRes] = await Promise.all([
        fetch(`/api/kitchen/tickets?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/menu?t=${Date.now()}`, { cache: 'no-store' }),
      ]);
      const ticketsData = await ticketsRes.json();
      const menuData = await menuRes.json();

      if (ticketsData.success) {
        setTickets(ticketsData.data || []);
        if (ticketsData.masterBills) {
          setMasterBills(ticketsData.masterBills);
        }
      }
      if (menuData.success) {
        setMenuItems(menuData.data.items || []);
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKdsData();
    const interval = setInterval(fetchKdsData, 3000); // 3-second rapid background polling backup
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchKdsData();
    };
    window.addEventListener('focus', fetchKdsData);
    window.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', fetchKdsData);
      window.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const formatOrderTime = (placedAt?: string, placedAtTime?: string) => {
    if (placedAt) {
      const d = new Date(placedAt);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }
    }
    return placedAtTime || '';
  };

  useEffect(() => {
    if (!socket) return;

    const handleTicket = (data: any) => {
      playKitchenBell();
      if (data?.orderTicket) {
        setTickets((prev) => {
          if (prev.some((t) => t.id === data.orderTicket.id)) return prev;
          return [data.orderTicket, ...prev];
        });
      }
      fetchKdsData();
    };

    const handleStatus = (data: any) => {
      if (!data) {
        fetchKdsData();
        return;
      }
      // Instant in-memory update across the table with 0 lag
      setTickets((prev) =>
        prev.map((t) => {
          if (data.ticketId && t.id === data.ticketId) {
            if (Array.isArray(data.items) && data.items.length > 0) {
              const itemStatusMap = new Map(data.items.map((it: any) => [it.id, it.status]));
              return {
                ...t,
                status: data.ticketStatus || t.status,
                items: t.items.map((i) =>
                  itemStatusMap.has(i.id) ? { ...i, status: itemStatusMap.get(i.id) as any } : i
                ),
              };
            }
            if (data.orderItemId) {
              return {
                ...t,
                status: data.ticketStatus || t.status,
                items: t.items.map((i) =>
                  i.id === data.orderItemId ? { ...i, status: data.status as any } : i
                ),
              };
            }
            if (data.status) {
              return {
                ...t,
                status: data.ticketStatus || (data.status === 'served' ? 'COMPLETED' : t.status),
                items: t.items.map((i) => ({ ...i, status: data.status })),
              };
            }
          }
          return t;
        })
      );
      if (selectedTicket && data.ticketId && selectedTicket.id === data.ticketId) {
        setSelectedTicket((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            status: data.ticketStatus || (data.status === 'served' ? 'COMPLETED' : prev.status),
            items: prev.items.map((i) => ({ ...i, status: data.status || i.status })),
          };
        });
      }
      fetchKdsData();
    };

    socket.on('order:placed', handleTicket);
    socket.on('order:item_status_changed', handleStatus);
    socket.on('seat:vacated', fetchKdsData);
    socket.on('payment:lock_changed', fetchKdsData);
    socket.on('menu:item_86_toggled', handleStatus);
    socket.on('menu:updated', handleStatus);

    return () => {
      socket.off('order:placed', handleTicket);
      socket.off('order:item_status_changed', handleStatus);
      socket.off('seat:vacated', fetchKdsData);
      socket.off('payment:lock_changed', fetchKdsData);
      socket.off('menu:item_86_toggled', handleStatus);
      socket.off('menu:updated', handleStatus);
    };
  }, [socket, selectedTicket]);

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

  // Check helpers
  const isTicketDone = (ticket: Ticket) => {
    if (ticket.status === 'COMPLETED') return true;
    const items = ticket.items || [];
    return items.length > 0 && items.every((i) => i.status === 'served' || i.status === 'cancelled');
  };

  const isTicketParcel = (ticket: Ticket) => {
    return (
      (ticket.orderType || '').toUpperCase().includes('PARCEL') ||
      (ticket.orderType || '').toUpperCase().includes('TAKE') ||
      ticket.ticketNumber?.startsWith('P')
    );
  };

  // Mark parcel order done
  const handleMarkParcelDone = async (ticket: Ticket) => {
    try {
      setUpdatingTicketId(ticket.id);

      // Optimistic update
      setTickets((prev) =>
        prev.map((t) => {
          if (t.id === ticket.id) {
            return {
              ...t,
              status: 'COMPLETED',
              items: t.items.map((i) => ({ ...i, status: 'served' })),
            };
          }
          return t;
        })
      );

      if (selectedTicket && selectedTicket.id === ticket.id) {
        setSelectedTicket({
          ...selectedTicket,
          status: 'COMPLETED',
          items: selectedTicket.items.map((i) => ({ ...i, status: 'served' })),
        });
      }

      const res = await fetch('/api/orders/batch-item-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          status: 'served',
        }),
      });
      const data = await res.json();
      if (!data.success) {
        fetchKdsData();
      }
    } catch (e) {
      console.error(e);
      fetchKdsData();
    } finally {
      setUpdatingTicketId(null);
    }
  };

  // Counts for filter pills
  const totalCount = tickets.length;
  const activeCount = tickets.filter((t) => !isTicketDone(t)).length;
  const parcelCount = tickets.filter((t) => isTicketParcel(t)).length;
  const cookingCount = tickets.filter((t) => !isTicketDone(t) && (t.items || []).some((i) => i.status === 'preparing')).length;
  const readyCount = tickets.filter((t) => !isTicketDone(t) && (t.items || []).some((i) => i.status === 'ready')).length;
  const completedCount = tickets.filter((t) => isTicketDone(t)).length;

  // Filtered tickets
  const filteredTickets = tickets.filter((ticket) => {
    const isDone = isTicketDone(ticket);
    const isParcel = isTicketParcel(ticket);

    switch (activeFilter) {
      case 'ALL':
        return true;
      case 'ACTIVE':
        return !isDone;
      case 'PARCELS':
        return isParcel;
      case 'COOKING':
        return !isDone && (ticket.items || []).some((i) => i.status === 'preparing');
      case 'READY':
        return !isDone && (ticket.items || []).some((i) => i.status === 'ready');
      case 'COMPLETED':
        return isDone;
      default:
        return true;
    }
  });

  const getTicketStatusBadge = (ticket: Ticket) => {
    if (isTicketDone(ticket)) {
      return { label: '✓ Done', color: 'bg-emerald-50 text-emerald-800 border border-emerald-200' };
    }
    const items = ticket.items || [];
    if (items.some((i) => i.status === 'ready')) {
      return { label: 'Ready', color: 'bg-emerald-100 text-emerald-900 border border-emerald-300' };
    }
    if (items.some((i) => i.status === 'preparing')) {
      return { label: 'Cooking', color: 'bg-sky-50 text-sky-800 border border-sky-200' };
    }
    return { label: 'Received', color: 'bg-amber-50 text-amber-800 border border-amber-200' };
  };

  return (
    <div className="min-h-screen bg-[#FBF9F6] text-stone-900 flex flex-col font-sans select-none p-3">
      <div className="border border-[#8A4228] rounded-2xl bg-[#FBF9F6] min-h-[calc(100vh-1.5rem)] flex flex-col overflow-hidden">
      <ManagerTopNav activeTab="orders" />

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* SECONDARY SUB-NAV / VIEW SWITCHER                                  */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-stone-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="font-black text-sm text-stone-900 uppercase tracking-wider">
            Orders & Kitchen Operations ({tickets.length})
          </h2>

          {/* Primary View Switcher: KOTs vs Master Invoices */}
          <div className="flex items-center bg-stone-100 p-0.5 rounded-xl border border-stone-200 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('KOT_TICKETS')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                viewMode === 'KOT_TICKETS'
                  ? 'bg-[#8A4228] text-white shadow-xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Kitchen Orders / KOTs ({tickets.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('MASTER_BILLS')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                viewMode === 'MASTER_BILLS'
                  ? 'bg-emerald-700 text-white shadow-xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Master Invoices & Bills ({masterBills.length})</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShow86Drawer(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 text-xs font-bold transition active:scale-95 shadow-sm"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>86 / Sold Out Item Manager</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* FILTER TABS (Only shown in KOT view)                                */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {viewMode === 'KOT_TICKETS' && (
        <div className="bg-stone-50 border-b border-stone-200 px-6 py-2.5 flex items-center justify-between text-xs overflow-x-auto">
          <div className="flex items-center gap-2">
            <span className="text-stone-500 font-bold uppercase tracking-wider text-[10px] mr-1">Filter KOTs:</span>
            <button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                activeFilter === 'ALL'
                  ? 'bg-[#8A4228] text-white shadow-xs font-bold'
                  : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
              }`}
            >
              [ All Orders ({totalCount}) ]
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('ACTIVE')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                activeFilter === 'ACTIVE'
                  ? 'bg-[#8A4228] text-white shadow-xs font-bold'
                  : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
              }`}
            >
              [ In Kitchen ({activeCount}) ]
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('PARCELS')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                activeFilter === 'PARCELS'
                  ? 'bg-[#8A4228] text-white shadow-xs font-bold'
                  : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
              }`}
            >
              [ 📦 Parcels ({parcelCount}) ]
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('COOKING')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                activeFilter === 'COOKING'
                  ? 'bg-sky-700 text-white shadow-xs font-bold'
                  : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
              }`}
            >
              [ Cooking ({cookingCount}) ]
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('READY')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                activeFilter === 'READY'
                  ? 'bg-emerald-700 text-white shadow-xs font-bold'
                  : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
              }`}
            >
              [ Ready ({readyCount}) ]
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('COMPLETED')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                activeFilter === 'COMPLETED'
                  ? 'bg-stone-700 text-white shadow-xs font-bold'
                  : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
              }`}
            >
              [ Completed ({completedCount}) ]
            </button>
          </div>

          <div className="text-[11px] text-stone-500 hidden sm:block">
            <span>Showing all individual order rounds & their final invoice totals</span>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 1. KITCHEN TICKETS (KOT) TABLE VIEW                                */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {viewMode === 'KOT_TICKETS' && (
        <div className="flex-1 p-6 overflow-x-auto">
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">TICKET / ROUND</th>
                  <th className="py-3 px-3">TYPE / SEAT</th>
                  <th className="py-3 px-4">LINKED INVOICE</th>
                  <th className="py-3 px-4">SERVER / DESK</th>
                  <th className="py-3 px-4">ITEMS IN THIS ORDER</th>
                  <th className="py-3 px-4">KOT AMOUNT</th>
                  <th className="py-3 px-4">BILL GRAND TOTAL</th>
                  <th className="py-3 px-4">TIME</th>
                  <th className="py-3 px-3">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-stone-500">
                      No tickets found in this filter view.
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((ticket) => {
                    const itemsSummary = (ticket.items || [])
                      .map((i) => `${i.itemName} x${i.quantity}`)
                      .join(', ');
                    const statusBadge = getTicketStatusBadge(ticket);
                    const isParcel = isTicketParcel(ticket);
                    const isDone = isTicketDone(ticket);
                    const seatDisplay = isParcel ? '📦 Parcel' : `S${ticket.seatId || '1'}`;
                    const serverName = isParcel
                      ? 'Manager Desk'
                      : ticket.waiterName || (ticket.seatId && ticket.seatId <= 8 ? 'Suhas' : 'Shiva');

                    return (
                      <tr key={ticket.id} className="hover:bg-stone-50/70 border-b border-stone-100 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-[#8A4228] text-sm">
                              #{ticket.ticketNumber}
                            </span>
                            {ticket.totalRounds && ticket.totalRounds > 1 && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-600/40 text-[10px] font-bold text-amber-300">
                                R{ticket.roundNumber}/{ticket.totalRounds}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-bold text-stone-900">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            isParcel ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-stone-100 text-stone-800 border border-stone-200'
                          }`}>
                            {seatDisplay}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {ticket.invoiceNumber ? (
                            <div className="flex flex-col">
                              <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono font-bold text-[11px] border border-emerald-200 w-fit">
                                #{ticket.invoiceNumber}
                              </span>
                              <span className="text-[10px] text-stone-500 mt-0.5">
                                {ticket.billPaymentMode || 'UPI'} • {ticket.billPaymentStatus || 'PAID'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-stone-500 font-mono text-[11px]">Unbilled (Active)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-stone-800 font-medium">
                          {serverName}
                        </td>
                        <td className="py-3 px-4 text-stone-700 font-medium max-w-xs truncate" title={itemsSummary}>
                          {itemsSummary}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-[#8A4228] text-sm font-black">
                            ₹{(ticket.totalAmount || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {ticket.billGrandTotal ? (
                            <div>
                              <div className="font-mono font-bold text-emerald-700 text-sm font-black">
                                ₹{ticket.billGrandTotal.toFixed(2)}
                              </div>
                              <div className="text-[10px] text-stone-500 font-normal">
                                Subtot: ₹{(ticket.billSubtotal || 0).toFixed(2)} + GST
                              </div>
                            </div>
                          ) : (
                            <span className="text-stone-500 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-stone-600 font-mono font-medium">
                          {formatOrderTime(ticket.placedAt, ticket.placedAtTime)}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedTicket(ticket)}
                              className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs border border-stone-200 transition active:scale-95 shadow-xs"
                            >
                              Details
                            </button>

                            {/* Dedicated Parcel "Mark Done" action button strictly for parcel orders */}
                            {isParcel && !isDone && (
                              <button
                                type="button"
                                disabled={updatingTicketId === ticket.id}
                                onClick={() => handleMarkParcelDone(ticket)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition active:scale-95 shadow-md flex items-center gap-1.5 disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{updatingTicketId === ticket.id ? 'Done...' : 'Mark Done'}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 2. MASTER BILLS & INVOICES TABLE VIEW (Matches Sales Report)       */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {viewMode === 'MASTER_BILLS' && (
        <div className="flex-1 p-6 overflow-x-auto">
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">INVOICE #</th>
                  <th className="py-3 px-3">DATE</th>
                  <th className="py-3 px-3">TYPE</th>
                  <th className="py-3 px-3">SEAT / TOKEN</th>
                  <th className="py-3 px-4">SERVER</th>
                  <th className="py-3 px-4">ITEMS SUMMARY</th>
                  <th className="py-3 px-3">PLACED</th>
                  <th className="py-3 px-3">SETTLED</th>
                  <th className="py-3 px-4 text-right">SUBTOTAL</th>
                  <th className="py-3 px-3 text-right">GST (5%)</th>
                  <th className="py-3 px-4 text-right">GRAND TOTAL</th>
                  <th className="py-3 px-3 text-center">MODE</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {masterBills.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-stone-500">
                      No master invoices found.
                    </td>
                  </tr>
                ) : (
                  masterBills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-stone-50/70 border-b border-stone-100 transition">
                      <td className="py-3 px-4 font-mono font-black text-[#8A4228]">
                        #{bill.billNumber}
                      </td>
                      <td className="py-3 px-3 text-stone-600 font-mono text-[11px]">
                        {bill.date}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          bill.orderType === 'Takeaway'
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : 'bg-stone-100 text-stone-800 border border-stone-200'
                        }`}>
                          {bill.orderType}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-stone-900 font-mono">
                        {bill.seatNumberOrToken}
                      </td>
                      <td className="py-3 px-4 text-stone-800 font-medium">
                        {bill.serverName}
                      </td>
                      <td className="py-3 px-4 text-stone-700 font-medium max-w-xs truncate" title={bill.itemsSummary}>
                        {bill.itemsSummary}
                      </td>
                      <td className="py-3 px-3 text-stone-500 font-mono text-[11px]">
                        {bill.placedAt}
                      </td>
                      <td className="py-3 px-3 text-stone-600 font-mono text-[11px]">
                        {bill.settledAt}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-stone-800">
                        ₹{bill.subtotal.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-stone-500">
                        ₹{bill.gst5Percent.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                        ₹{bill.grandTotal.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-800 border border-stone-200 text-[10px] font-bold">
                          {bill.paymentMode}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedMasterBill(bill)}
                          className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs border border-stone-200 transition active:scale-95 shadow-xs"
                        >
                          Invoice Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* TICKET DETAILS MODAL (With Full Session & Sales Report Sync)       */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {selectedTicket && (() => {
        const isParcel = isTicketParcel(selectedTicket);
        const isDone = isTicketDone(selectedTicket);
        const totalCalculated = (selectedTicket.items || []).reduce(
          (sum, i) => sum + (i.unitPrice || 0) * (i.quantity || 1),
          0
        );

        const handlePrintKot = () => {
          if (!selectedTicket) return;
          const printWindow = window.open('', '_blank', 'width=380,height=600');
          if (!printWindow) {
            window.print();
            return;
          }
          const itemsHtml = (selectedTicket.items || [])
            .map(
              (it) => `
              <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 13px;">
                <span><strong>${it.quantity}x</strong> ${it.itemName}</span>
                <span>₹${(it.unitPrice * it.quantity).toFixed(2)}</span>
              </div>
            `
            )
            .join('');

          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>KOT #${selectedTicket.ticketNumber}</title>
                <style>
                  @page { size: 80mm auto; margin: 5mm; }
                  body {
                    font-family: 'Courier New', Courier, monospace, sans-serif;
                    width: 72mm;
                    margin: 0 auto;
                    color: #000;
                    font-size: 12px;
                    line-height: 1.3;
                  }
                  .center { text-align: center; }
                  .bold { font-weight: bold; }
                  .divider { border-top: 1px dashed #000; margin: 6px 0; }
                  .double-divider { border-top: 2px dashed #000; margin: 6px 0; }
                  .flex-between { display: flex; justify-content: space-between; }
                </style>
              </head>
              <body>
                <div class="center">
                  <h2 style="margin: 0; font-size: 16px;">THOOGUDEEPA</h2>
                  <div style="font-size: 11px;">Donne Biryani Mane</div>
                  <div class="bold" style="font-size: 13px; margin-top: 4px;">KITCHEN ORDER TICKET (KOT)</div>
                </div>
                <div class="divider"></div>
                <div class="flex-between">
                  <span><strong>TICKET: #${selectedTicket.ticketNumber}</strong></span>
                  <span><strong>${isParcel ? '📦 TAKEAWAY' : `TABLE: S${selectedTicket.seatId || '1'}`}</strong></span>
                </div>
                <div class="flex-between">
                  <span>Server: ${selectedTicket.waiterName || 'Staff'}</span>
                  <span>${formatOrderTime(selectedTicket.placedAt, selectedTicket.placedAtTime)}</span>
                </div>
                ${
                  selectedTicket.customerName && selectedTicket.customerName !== '(-)'
                    ? `<div class="flex-between"><span>Guest: ${selectedTicket.customerName}</span></div>`
                    : ''
                }
                ${
                  selectedTicket.invoiceNumber
                    ? `<div class="flex-between"><span>Inv: #${selectedTicket.invoiceNumber} (${selectedTicket.billPaymentMode || 'PAID'})</span></div>`
                    : ''
                }
                <div class="divider"></div>
                <div style="margin: 4px 0;">
                  ${itemsHtml}
                </div>
                <div class="divider"></div>
                <div class="flex-between bold" style="font-size: 13px;">
                  <span>TOTAL:</span>
                  <span>₹${totalCalculated.toFixed(2)}</span>
                </div>
                ${
                  selectedTicket.specialNotes
                    ? `<div class="divider"></div><div style="font-size: 11px;">Note: ${selectedTicket.specialNotes}</div>`
                    : ''
                }
                <div class="double-divider"></div>
                <div class="center" style="font-size: 10px; margin-top: 6px;">
                  Printed at ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })}
                </div>
              </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 250);
        };

        return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-stone-200 rounded-3xl max-w-lg w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex justify-between items-start pb-4 border-b border-[#2C2520] mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono font-black text-xl text-[#8A4228]">
                      Ticket #{selectedTicket.ticketNumber}
                    </h3>
                    <span className="px-2.5 py-0.5 bg-stone-100 border border-stone-200 text-stone-700 text-xs font-bold rounded-full">
                      {isParcel ? '📦 TAKEAWAY' : `DINE-IN • S${selectedTicket.seatId || '1'}`}
                    </span>
                    {selectedTicket.totalRounds && selectedTicket.totalRounds > 1 && (
                      <span className="px-2 py-0.5 bg-[#8A4228]/10 text-[#8A4228] border border-[#8A4228]/30 text-[10px] font-bold rounded-full">
                        Round {selectedTicket.roundNumber} of {selectedTicket.totalRounds}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-stone-500 mt-1">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      Placed: {formatOrderTime(selectedTicket.placedAt, selectedTicket.placedAtTime)}
                    </span>
                    <span>•</span>
                    <span>Server: <strong className="text-stone-800">{selectedTicket.waiterName || 'Staff'}</strong></span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="p-1 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Linked Final Bill Banner (Direct Link to Sales Report) */}
              {selectedTicket.invoiceNumber && (
                <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-emerald-900 text-sm">
                        Master Invoice: #{selectedTicket.invoiceNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                        {selectedTicket.billPaymentStatus || 'PAID'}
                      </span>
                    </div>
                    <span className="text-stone-700 text-[11px] block mt-0.5">
                      Paid via {selectedTicket.billPaymentMode || 'UPI'} {selectedTicket.billSettledAt ? `at ${selectedTicket.billSettledAt}` : ''}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-wider text-stone-500 block font-bold">
                      Bill Grand Total
                    </span>
                    <span className="font-mono font-black text-emerald-700 text-base">
                      ₹{selectedTicket.billGrandTotal?.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Parcel Details Section */}
              {isParcel && (
                <div className="mb-4 p-3.5 bg-stone-50 border border-stone-200 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between text-stone-700">
                    <div className="flex items-center gap-1.5 font-bold">
                      <User className="w-3.5 h-3.5 text-[#8A4228]" />
                      <span>Customer:</span>
                    </div>
                    <span className="font-black text-stone-900">{selectedTicket.customerName || 'Takeaway Guest'}</span>
                  </div>

                  <div className="flex items-center justify-between text-stone-700">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Phone className="w-3.5 h-3.5 text-[#8A4228]" />
                      <span>Contact Phone:</span>
                    </div>
                    <span className="font-mono font-bold text-amber-300">{selectedTicket.customerPhone || 'Not provided'}</span>
                  </div>

                  <div className="flex items-start justify-between text-stone-700 pt-1 border-t border-[#2C2520]">
                    <div className="flex items-center gap-1.5 font-bold">
                      <FileText className="w-3.5 h-3.5 text-stone-500" />
                      <span>Packaging Instructions:</span>
                    </div>
                    <span className="text-stone-700 text-right font-medium max-w-[220px]">
                      {selectedTicket.specialNotes || 'PACKAGING REQUIRED (TAKEAWAY)'}
                    </span>
                  </div>
                </div>
              )}

              {/* Items in this specific KOT ticket */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
                    Items In This Order #{selectedTicket.ticketNumber} ({selectedTicket.items?.length || 0}):
                  </span>
                  {selectedTicket.totalRounds && selectedTicket.totalRounds > 1 && (
                    <span className="text-[10px] font-bold text-[#8A4228]">
                      (Round {selectedTicket.roundNumber} of {selectedTicket.totalRounds})
                    </span>
                  )}
                </div>
                <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                  {selectedTicket.items?.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex justify-between items-center text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-stone-900 text-sm">
                            {item.quantity}x
                          </span>
                          <span className="font-bold text-stone-800">
                            {item.itemName}
                          </span>
                        </div>
                        <span className="text-[10px] text-stone-500 block capitalize mt-0.5">
                          Status: <strong className={item.status === 'served' ? 'text-emerald-700' : 'text-[#8A4228]'}>{item.status}</strong>
                        </span>
                      </div>
                      <span className="font-mono font-black text-[#8A4228] text-sm">
                        ₹{(item.unitPrice * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* KOT Subtotal */}
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex justify-between items-center mb-4">
                <span className="text-xs font-bold text-stone-500">
                  This Ticket Subtotal (#{selectedTicket.ticketNumber}):
                </span>
                <span className="font-mono font-black text-base text-[#8A4228]">
                  ₹{totalCalculated.toFixed(2)}
                </span>
              </div>

              {/* Multi-Round Session & Sales Report Reconciliation */}
              {selectedTicket.sessionRounds && selectedTicket.sessionRounds.length > 1 && (
                <div className="mb-6 p-3.5 bg-stone-50 border border-stone-200 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-stone-900 pb-1.5 border-b border-stone-200">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#8A4228]" />
                      Table S{selectedTicket.seatId} Full Dining Session ({selectedTicket.totalRounds} Rounds)
                    </span>
                    <span className="text-[10px] text-emerald-700 font-mono font-bold">
                      ✓ Reconciled with Sales Report
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {selectedTicket.sessionRounds.map((sr) => (
                      <div
                        key={sr.ticketNumber}
                        className={`p-2 rounded-lg flex justify-between items-center text-xs ${
                          sr.ticketNumber === selectedTicket.ticketNumber
                            ? 'bg-[#8A4228]/10 border border-[#8A4228]/40 text-stone-900 font-bold'
                            : 'bg-white border border-stone-200 text-stone-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[#8A4228] font-bold">Round {sr.roundNumber} (#{sr.ticketNumber})</span>
                            <span className="text-[10px] text-stone-500 font-normal">at {sr.placedAt}</span>
                            {sr.ticketNumber === selectedTicket.ticketNumber && (
                              <span className="px-1.5 py-0.5 rounded bg-[#8A4228] text-white text-[9px] font-black uppercase">Viewing</span>
                            )}
                          </div>
                          <span className="text-[10px] text-stone-500 block font-normal mt-0.5">{sr.itemsSummary}</span>
                        </div>
                        <span className="font-mono font-bold text-stone-800">₹{sr.subtotal.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-stone-200 space-y-1">
                    <div className="flex justify-between text-stone-700">
                      <span>Total Food Subtotal (All Rounds):</span>
                      <span className="font-mono font-bold text-[#8A4228]">
                        ₹{selectedTicket.billSubtotal?.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-stone-500 text-[11px]">
                      <span>GST (5%):</span>
                      <span className="font-mono text-stone-700">
                        ₹{selectedTicket.billGst?.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-black text-sm pt-1 border-t border-dashed border-stone-300">
                      <span>Final Master Invoice #{selectedTicket.invoiceNumber || '—'}:</span>
                      <span className="font-mono">
                        ₹{selectedTicket.billGrandTotal?.toFixed(2)} ({selectedTicket.billPaymentMode || 'Paid'})
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Action Buttons */}
              <div className="flex items-center gap-3">
                {/* Dedicated Mark Parcel Done button */}
                {isParcel && !isDone && (
                  <button
                    type="button"
                    disabled={updatingTicketId === selectedTicket.id}
                    onClick={() => handleMarkParcelDone(selectedTicket)}
                    className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    <span>{updatingTicketId === selectedTicket.id ? 'Marking Done...' : '✓ Mark Done'}</span>
                  </button>
                )}

                {isParcel && isDone && (
                  <div className="flex-1 py-3 px-4 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2">
                    <Check className="w-4 h-4 text-emerald-700" />
                    <span>Parcel Completed</span>
                  </div>
                )}

                {/* Dedicated Print KOT button */}
                <button
                  type="button"
                  onClick={handlePrintKot}
                  className="flex-1 py-3 px-4 bg-[#1E293B] hover:bg-[#0F172A] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  <span>🖨️ PRINT KOT</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="py-3 px-5 bg-white hover:bg-stone-50 text-stone-700 font-bold text-xs rounded-xl border border-stone-200 transition active:scale-95 shadow-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* MASTER INVOICE DETAILS MODAL                                       */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {selectedMasterBill && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl max-w-lg w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start pb-4 border-b border-[#2C2520] mb-4">
              <div>
                <h3 className="font-mono font-black text-xl text-emerald-700">
                  Master Invoice #{selectedMasterBill.billNumber}
                </h3>
                <span className="text-xs text-stone-500 block mt-0.5">
                  {selectedMasterBill.date} • {selectedMasterBill.orderType} • {selectedMasterBill.seatNumberOrToken}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMasterBill(null)}
                className="p-1 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-6 text-xs">
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                <div className="flex justify-between text-stone-700">
                  <span className="text-stone-500 font-bold">Customer Name:</span>
                  <span className="font-bold text-stone-900">{selectedMasterBill.customerName || 'Walk-in Guest'}</span>
                </div>
                <div className="flex justify-between text-stone-700">
                  <span className="text-stone-500 font-bold">Server:</span>
                  <span className="font-bold text-stone-900">{selectedMasterBill.serverName}</span>
                </div>
                <div className="flex justify-between text-stone-700">
                  <span className="text-stone-500 font-bold">Order Placed:</span>
                  <span className="font-mono text-stone-700">{selectedMasterBill.placedAt}</span>
                </div>
                <div className="flex justify-between text-stone-700">
                  <span className="text-stone-500 font-bold">Settled At:</span>
                  <span className="font-mono text-[#8A4228] font-bold">{selectedMasterBill.settledAt}</span>
                </div>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-1">
                  Ordered Items Summary:
                </span>
                <span className="text-stone-800 font-medium leading-relaxed block">
                  {selectedMasterBill.itemsSummary}
                </span>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5">
                <div className="flex justify-between text-stone-700">
                  <span>Gross Food Subtotal:</span>
                  <span className="font-mono font-bold text-[#8A4228]">₹{selectedMasterBill.subtotal.toFixed(2)}</span>
                </div>
                {selectedMasterBill.packagingCharges > 0 && (
                  <div className="flex justify-between text-stone-500">
                    <span>Packaging Charges:</span>
                    <span className="font-mono text-stone-700">₹{selectedMasterBill.packagingCharges.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-stone-500">
                  <span>GST (5%):</span>
                  <span className="font-mono text-stone-700">₹{selectedMasterBill.gst5Percent.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-black text-sm pt-1.5 border-t border-[#2C2520]">
                  <span>Grand Total Paid:</span>
                  <span className="font-mono">₹{selectedMasterBill.grandTotal.toFixed(2)} ({selectedMasterBill.paymentMode})</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedMasterBill(null)}
              className="w-full py-3 bg-white hover:bg-stone-50 text-stone-700 font-bold text-xs rounded-xl border border-stone-200 transition active:scale-95 shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 86 SOLD OUT ITEMS SLIDE-OVER DRAWER                                */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {show86Drawer && (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-end">
          <div className="bg-white border-l border-stone-200 w-full max-w-md h-full flex flex-col p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-[#2C2520] mb-4">
              <div>
                <h3 className="font-black text-sm text-stone-900 uppercase tracking-wider">
                  86 / Sold Out Item Manager
                </h3>
                <p className="text-xs text-stone-500">Instantly toggle dish availability across all customer menus</p>
              </div>
              <button
                onClick={() => setShow86Drawer(false)}
                className="p-1 rounded-lg text-stone-500 hover:text-stone-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex justify-between items-center"
                >
                  <div>
                    <span className="font-bold text-xs text-stone-900 block">{item.name}</span>
                    <span className="text-[10px] text-stone-500">{item.category?.name} • ₹{item.price}</span>
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
                className="w-full py-3 bg-[#8A4228] hover:bg-[#71351F] text-white font-bold text-xs rounded-xl transition shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
