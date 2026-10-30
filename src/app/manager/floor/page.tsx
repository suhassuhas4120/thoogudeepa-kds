'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CreditCard, LogOut, CheckCircle2, RefreshCw, Banknote, Smartphone, Printer, X } from 'lucide-react';
import { useSocketRoom } from '@/lib/useSocket';
import { playSuccessChime } from '@/lib/audio-synth';
import ManagerTopNav from '@/components/ManagerTopNav';

interface OrderItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  status: string;
}

interface SeatData {
  id: number;
  seatNumber: number;
  zone: string;
  assignedWaiter: string;
  status: 'VACANT' | 'OCCUPIED' | 'BILL_REQUESTED';
  currentGuestName: string;
  waterRequested?: boolean;
  activeSession?: {
    id: string;
    customerName: string;
    subtotal: number;
    gstAmount: number;
    grandTotal: number;
    discountAmount: number;
    appliedPromoCode?: string;
    paymentPreferred?: string;
    orderTickets: {
      id: string;
      ticketNumber: string;
      placedAt?: string | Date;
      placedAtTime?: string;
      status: string;
      items: OrderItem[];
    }[];
  } | null;
}

export default function ManagerFloorScreen() {
  const socket = useSocketRoom('room:manager');
  const [seats, setSeats] = useState<SeatData[]>([]);
  const [selectedSeatId, setSelectedSeatId] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI'>('CASH');
  const [showKotModal, setShowKotModal] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);

  const fetchFloor = async () => {
    try {
      const res = await fetch(`/api/seats?t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setSeats(json.data);
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFloor();
    // Relaxed fallback polling (5s) because WebSockets handle all live events in 0ms
    const interval = setInterval(fetchFloor, 5000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchFloor();
    };
    window.addEventListener('focus', fetchFloor);
    window.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', fetchFloor);
      window.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Real-time synchronization: Instant 0ms state reflection on WebSocket events
  useEffect(() => {
    if (!socket) return;

    let syncTimeout: NodeJS.Timeout;
    const debouncedSync = () => {
      clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        fetchFloor();
      }, 300);
    };

    const handleSeatVacated = (data: any) => {
      if (!data?.seatId) return;
      // Instant in-memory state transition across the floor grid (0ms)
      setSeats((prev) =>
        prev.map((s) =>
          s.id === data.seatId
            ? { ...s, status: 'VACANT', currentGuestName: '-', activeSession: null }
            : s
        )
      );
      debouncedSync();
    };

    const handleSeatStatus = (data: any) => {
      if (!data?.seatId) return;
      setSeats((prev) =>
        prev.map((s) =>
          s.id === data.seatId
            ? {
                ...s,
                status: data.status || s.status,
                currentGuestName: data.customerName || s.currentGuestName,
              }
            : s
        )
      );
      debouncedSync();
    };

    const handleOrderPlaced = (data: any) => {
      if (!data?.seatId) return;
      setSeats((prev) =>
        prev.map((s) => {
          if (s.id !== data.seatId) return s;
          const activeSession = s.activeSession
            ? {
                ...s.activeSession,
                grandTotal: data.sessionTotal || s.activeSession.grandTotal,
                orderTickets:
                  data.orderTicket && !(s.activeSession.orderTickets || []).some((t: any) => t.id === data.orderTicket.id)
                    ? [...(s.activeSession.orderTickets || []), data.orderTicket]
                    : s.activeSession.orderTickets || [],
              }
            : s.activeSession;
          return {
            ...s,
            status: 'OCCUPIED',
            currentGuestName: data.customerName || s.currentGuestName,
            activeSession,
          };
        })
      );
      debouncedSync();
    };

    const handleItemStatus = (data: any) => {
      if (!data?.seatId) return;
      setSeats((prev) =>
        prev.map((s) => {
          if (s.id !== data.seatId || !s.activeSession) return s;
          const updatedTickets = (s.activeSession.orderTickets || []).map((t: any) => {
            if (data.ticketId && t.id === data.ticketId) {
              const items = t.items.map((i: any) =>
                data.orderItemId && i.id === data.orderItemId
                  ? { ...i, status: data.status }
                  : i
              );
              return { ...t, status: data.ticketStatus || t.status, items };
            }
            return t;
          });
          return {
            ...s,
            activeSession: { ...s.activeSession, orderTickets: updatedTickets },
          };
        })
      );
      debouncedSync();
    };

    socket.on('seat:status_changed', handleSeatStatus);
    socket.on('order:placed', handleOrderPlaced);
    socket.on('order:item_status_changed', handleItemStatus);
    socket.on('seat:vacated', handleSeatVacated);
    socket.on('payment:completed', handleSeatVacated);
    socket.on('service:requested', debouncedSync);

    return () => {
      clearTimeout(syncTimeout);
      socket.off('seat:status_changed', handleSeatStatus);
      socket.off('order:placed', handleOrderPlaced);
      socket.off('order:item_status_changed', handleItemStatus);
      socket.off('seat:vacated', handleSeatVacated);
      socket.off('payment:completed', handleSeatVacated);
      socket.off('service:requested', debouncedSync);
    };
  }, [socket]);

  const selectedSeat = seats.find((s) => s.id === selectedSeatId) || seats[0];
  const session = selectedSeat?.activeSession;
  const isOccupied = selectedSeat?.status !== 'VACANT' && selectedSeat?.activeSession !== null;

  // Sync default payment mode with customer's preference if set
  useEffect(() => {
    if (session?.paymentPreferred === 'UPI') {
      setPaymentMode('UPI');
    } else if (session?.paymentPreferred === 'CASH') {
      setPaymentMode('CASH');
    }
  }, [session?.paymentPreferred, selectedSeatId]);

  // Manager Actions: Confirm Payment & Vacate
  const handleConfirmPayment = async () => {
    if (!selectedSeat || !session || (session.grandTotal || 0) <= 0 || loadingPayment) return;
    setLoadingPayment(true);
    try {
      const res = await fetch('/api/billing/settle-vacate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seatId: selectedSeat.id,
          paymentMode: paymentMode,
          settledBy: selectedSeat.assignedWaiter || 'General Manager Desk',
        }),
      });
      const data = await res.json();
      if (data.success) {
        playSuccessChime();
        fetchFloor();
      } else {
        alert(data.error || 'Failed to complete payment');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPayment(false);
    }
  };

  const handleCollectPaymentAndVacate = async (mode: string = 'UPI') => {
    if (!selectedSeat || !session || (session.grandTotal || 0) <= 0) return;
    try {
      const res = await fetch('/api/billing/settle-vacate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seatId: selectedSeat.id,
          paymentMode: mode,
          settledBy: selectedSeat.assignedWaiter || 'General Manager Desk',
        }),
      });
      const data = await res.json();
      if (data.success) {
        playSuccessChime();
        fetchFloor();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleVacateSeat = async () => {
    if (!selectedSeat) return;
    try {
      const hasAmount = (session?.grandTotal || 0) > 0;
      const res = await fetch('/api/billing/settle-vacate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seatId: selectedSeat.id,
          paymentMode: hasAmount ? 'CASH' : undefined,
          settledBy: hasAmount ? 'General Manager Desk' : 'General Manager Desk (Direct Vacate)',
        }),
      });
      const data = await res.json();
      if (data.success) {
        playSuccessChime();
        fetchFloor();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Compile selected items and ticket info
  const allSelectedItems: OrderItem[] = [];
  let latestTicketNumber = '—';
  let placedTime = '—';

  if (session?.orderTickets && session.orderTickets.length > 0) {
    session.orderTickets.forEach((t) => {
      if (t.ticketNumber) latestTicketNumber = `#${t.ticketNumber}`;
      if (t.placedAt) {
        const d = new Date(t.placedAt);
        if (!isNaN(d.getTime())) {
          placedTime = d.toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
        }
      } else if (t.placedAtTime) {
        placedTime = t.placedAtTime;
      }
      t.items?.forEach((it) => allSelectedItems.push(it));
    });
  }

  // Determine status display label and color for seat cards
  const getSeatCardStatus = (seat: SeatData, isSelected: boolean) => {
    if (isSelected) return { label: '🟢 Selected', color: 'text-emerald-700' };
    if (seat.status === 'VACANT' || !seat.activeSession) return { label: '⚪ Vacant', color: 'text-stone-500' };
    if (seat.status === 'BILL_REQUESTED') return { label: '🧾 Bill Req', color: 'text-amber-700 font-bold' };
    
    // Check ticket cooking/ready status
    const tickets = seat.activeSession?.orderTickets || [];
    const allItems = tickets.flatMap((t) => t.items || []);
    if (allItems.some((i) => i.status === 'ready')) return { label: '🟢 Ready', color: 'text-emerald-700 font-bold' };
    if (allItems.some((i) => i.status === 'preparing' || i.status === 'placed')) {
      return { label: '🍳 Cooking', color: 'text-orange-700' };
    }
    if (allItems.length > 0 && allItems.every((i) => i.status === 'served')) {
      return { label: '🍽️ Eating', color: 'text-blue-700' };
    }
    return { label: '🟢 Seated', color: 'text-emerald-700' };
  };

  return (
    <div className="min-h-screen bg-[#FBF9F6] p-3 text-stone-900 font-sans select-none">
      <div className="border border-[#8A4228] rounded-2xl bg-[#FBF9F6] flex flex-col min-h-[calc(100vh-1.5rem)] overflow-hidden shadow-xs">
        {/* Shared Manager Top Navigation */}
        <ManagerTopNav activeTab="floor" />

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* 2-COLUMN MAIN WORKSPACE                                            */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <div className="flex-1 p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
          {/* ============================================================== */}
          {/* LEFT COLUMN: FLOOR MAP (16 SEATS)                              */}
          {/* ============================================================== */}
          <div className="lg:col-span-7 bg-white border border-stone-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex justify-between items-center pb-2.5 border-b border-stone-200 mb-3">
                <h2 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  📋 FLOOR MAP (16 SEATS)
                </h2>
                <span className="text-xs font-semibold text-stone-500">
                  Active: {seats.filter((s) => s.status !== 'VACANT' && s.activeSession !== null).length} / 16
                </span>
              </div>

              {/* ZONE A : SUHAS (Seats 1 to 8) */}
              <div className="mb-4 p-3 bg-stone-50/70 border border-stone-200/80 rounded-xl">
                <span className="text-[11px] font-bold text-[#8A4228] uppercase tracking-wider block mb-2">
                  ZONE A : SUHAS (Seats 1 to 8)
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {seats.slice(0, 8).map((seat) => {
                    const isSelected = selectedSeat?.id === seat.id;
                    const statusInfo = getSeatCardStatus(seat, isSelected);
                    const isVacant = seat.status === 'VACANT' || !seat.activeSession;
                    const dinerName = seat.currentGuestName && seat.currentGuestName !== '-' ? `(${seat.currentGuestName})` : '';

                    return (
                      <button
                        key={seat.id}
                        type="button"
                        onClick={() => setSelectedSeatId(seat.id)}
                        className={`p-2.5 rounded-xl border text-left transition select-none ${
                          isSelected
                            ? 'ring-2 ring-[#8A4228] border-[#8A4228] bg-white shadow-xs'
                            : !isVacant
                            ? 'bg-purple-50/50 border-purple-200 hover:border-purple-300'
                            : 'bg-white border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <div className="font-bold text-xs text-stone-900 truncate">
                          S{seat.seatNumber} <span className="text-[11px] font-normal text-stone-500">{dinerName}</span>
                        </div>
                        <div className={`text-[11px] mt-1 ${statusInfo.color}`}>
                          {statusInfo.label}
                        </div>
                        <div className="text-[11px] font-bold text-[#8A4228] mt-0.5">
                          {!isVacant ? `₹${seat.activeSession?.grandTotal?.toFixed(0) || '0'}` : '—'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ZONE B : SHIVA (Seats 9 to 16) */}
              <div className="p-3 bg-stone-50/70 border border-stone-200/80 rounded-xl">
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block mb-2">
                  ZONE B : SHIVA (Seats 9 to 16)
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {seats.slice(8, 16).map((seat) => {
                    const isSelected = selectedSeat?.id === seat.id;
                    const statusInfo = getSeatCardStatus(seat, isSelected);
                    const isVacant = seat.status === 'VACANT' || !seat.activeSession;
                    const dinerName = seat.currentGuestName && seat.currentGuestName !== '-' ? `(${seat.currentGuestName})` : '';

                    return (
                      <button
                        key={seat.id}
                        type="button"
                        onClick={() => setSelectedSeatId(seat.id)}
                        className={`p-2.5 rounded-xl border text-left transition select-none ${
                          isSelected
                            ? 'ring-2 ring-[#8A4228] border-[#8A4228] bg-white shadow-xs'
                            : !isVacant
                            ? 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-300'
                            : 'bg-white border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <div className="font-bold text-xs text-stone-900 truncate">
                          S{seat.seatNumber} <span className="text-[11px] font-normal text-stone-500">{dinerName}</span>
                        </div>
                        <div className={`text-[11px] mt-1 ${statusInfo.color}`}>
                          {statusInfo.label}
                        </div>
                        <div className="text-[11px] font-bold text-[#8A4228] mt-0.5">
                          {!isVacant ? `₹${seat.activeSession?.grandTotal?.toFixed(0) || '0'}` : '—'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-200 text-xs text-stone-500 flex justify-between">
              <span>Click any seat to inspect, collect payment or vacate.</span>
              <span className="text-emerald-600 font-medium">● Connected</span>
            </div>
          </div>

          {/* ============================================================== */}
          {/* RIGHT COLUMN: SELECTED SEAT DETAILS & BILLING                  */}
          {/* ============================================================== */}
          <div className="lg:col-span-5 bg-white border border-stone-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
            <div>
              {/* Header */}
              <div className="pb-3 border-b border-stone-200 mb-3">
                <h3 className="font-bold text-sm text-stone-900 tracking-wide">
                  🔍 SELECTED: SEAT {String(selectedSeat?.seatNumber || 1).padStart(2, '0')} {selectedSeat?.currentGuestName && selectedSeat.currentGuestName !== '-' ? `(${selectedSeat.currentGuestName})` : ''}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Waiter: <strong className="text-stone-800">{selectedSeat?.assignedWaiter} ({selectedSeat?.zone === 'ZONE_A' ? 'Zone A' : 'Zone B'})</strong> {latestTicketNumber !== '—' ? `• Ticket ${latestTicketNumber}` : ''}
                </p>
                <p className="text-xs text-stone-500 mt-0.5">
                  🕒 Placed Time: <strong className="text-stone-800">{placedTime}</strong>
                </p>
              </div>

              {/* ORDERED ITEMS section */}
              <div className="mb-4">
                <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block mb-2">
                  ORDERED ITEMS :
                </span>

                {!isOccupied ? (
                  <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl text-center text-xs text-stone-400 font-mono">
                    Seat is currently vacant
                  </div>
                ) : allSelectedItems.length === 0 ? (
                  <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl text-center text-xs text-[#8A4228] font-medium">
                    Diner seated • Browsing menu (No items ordered yet)
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[30vh] overflow-y-auto pr-1">
                    {allSelectedItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center py-1.5 px-2.5 rounded-lg bg-stone-50/80 border border-stone-200/80 text-xs"
                      >
                        <span className="font-medium text-stone-800">
                          • {item.quantity}x {item.itemName}
                        </span>
                        <span className="font-mono font-bold text-[#8A4228]">
                          ₹{(item.unitPrice * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bill Math Summary */}
              {isOccupied && (
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-1.5 text-xs text-stone-600 mb-3">
                  <div className="flex justify-between text-stone-500">
                    <span>Item Subtotal:</span>
                    <span className="text-stone-900 font-mono font-semibold">₹{session?.subtotal?.toFixed(2) || '0.00'}</span>
                  </div>
                  {session?.discountAmount ? (
                    <div className="flex justify-between text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      <span>Promo Applied ({session.appliedPromoCode || 'Coupon'}):</span>
                      <span className="font-mono font-bold">-₹{session.discountAmount.toFixed(2)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-stone-500">
                    <span>GST (5%):</span>
                    <span className="text-stone-900 font-mono font-semibold">₹{session?.gstAmount?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>Packaging / Service:</span>
                    <span className="text-stone-900 font-mono font-semibold">₹0.00</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-[#8A4228] pt-2 border-t border-stone-200">
                    <span>GRAND TOTAL:</span>
                    <span className="text-base text-stone-900 font-black font-mono">₹{session?.grandTotal?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              )}

              {/* Payment Preferred line */}
              {isOccupied && (
                <div className="text-xs text-stone-500 mb-2">
                  Payment Preferred: <strong className="text-[#8A4228]">{session?.paymentPreferred === 'CASH' ? '💵 Cash' : '📱 UPI'}</strong>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-stone-200">
              {/* 1. Payment Mode Selector */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                  Select Settlement Mode:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('CASH')}
                    disabled={!isOccupied}
                    className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition select-none ${
                      paymentMode === 'CASH'
                        ? 'bg-[#8A4228] text-white shadow-xs'
                        : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>💵 CASH</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('UPI')}
                    disabled={!isOccupied}
                    className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition select-none ${
                      paymentMode === 'UPI'
                        ? 'bg-[#8A4228] text-white shadow-xs'
                        : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>📱 UPI</span>
                  </button>
                </div>
              </div>

              {/* 2. Confirm Payment Button */}
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={!isOccupied || (session?.grandTotal || 0) <= 0 || loadingPayment}
                className={`w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs select-none ${
                  isOccupied && (session?.grandTotal || 0) > 0
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98'
                    : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {loadingPayment
                    ? 'PROCESSING PAYMENT...'
                    : `CONFIRM PAYMENT (${paymentMode} - ₹${session?.grandTotal?.toFixed(2) || '0.00'})`}
                </span>
              </button>

              {/* 3. Two Supporting Buttons: Print KOT / Bill & Vacate Seat */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowKotModal(true)}
                  disabled={!isOccupied}
                  className={`py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition select-none ${
                    isOccupied
                      ? 'bg-[#1E293B] hover:bg-[#0F172A] text-white shadow-xs active:scale-98'
                      : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                  }`}
                >
                  <Printer className="w-4 h-4" />
                  <span>PRINT KOT</span>
                </button>

                <button
                  type="button"
                  onClick={handleVacateSeat}
                  disabled={!isOccupied}
                  className={`py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition select-none ${
                    isOccupied
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 active:scale-98'
                      : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                  }`}
                >
                  <LogOut className="w-4 h-4" />
                  <span>VACATE</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* KOT / Tax Invoice Preview Modal */}
        {showKotModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-stone-200 rounded-2xl max-w-sm w-full p-6 text-stone-900 shadow-xl space-y-4">
              {/* Receipt Header */}
              <div className="text-center pb-3 border-b border-dashed border-stone-200">
                <h3 className="font-extrabold text-base tracking-wider text-[#8A4228]">THOOGUDEEPA</h3>
                <p className="text-[10px] text-stone-500 uppercase tracking-widest">Donne Biryani Mane</p>
                <div className="inline-block px-2.5 py-0.5 rounded bg-[#8A4228]/10 text-[#8A4228] font-bold text-[10px] mt-1.5 uppercase">
                  KOT & TAX INVOICE
                </div>
              </div>

              {/* Table & Ticket Meta */}
              <div className="text-xs space-y-1 text-stone-700 bg-stone-50 p-3 rounded-xl border border-stone-200">
                <div className="flex justify-between font-bold">
                  <span className="text-[#8A4228]">TABLE: SEAT {selectedSeat.seatNumber}</span>
                  <span>Ticket #{latestTicketNumber}</span>
                </div>
                <div className="flex justify-between text-[11px] text-stone-500">
                  <span>Waiter: {selectedSeat.assignedWaiter || (selectedSeat.seatNumber <= 8 ? 'Suhas' : 'Shiva')}</span>
                  <span>Time: {placedTime}</span>
                </div>
                <div className="flex justify-between text-[11px] text-stone-500">
                  <span>Customer: {session?.customerName || '(-)'}</span>
                  <span>Mode: {paymentMode}</span>
                </div>
              </div>

              {/* Ordered Items Table */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs py-1">
                {allSelectedItems.length === 0 ? (
                  <p className="text-center text-stone-400 py-2 font-mono">No active items</p>
                ) : (
                  allSelectedItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1 border-b border-stone-100">
                      <span className="text-stone-800">
                        <strong className="text-[#8A4228] font-mono mr-1.5">{item.quantity}x</strong>
                        {item.itemName}
                      </span>
                      <span className="font-mono font-bold text-stone-900">
                        ₹{(item.unitPrice * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Financial Summary */}
              <div className="pt-2 border-t border-dashed border-stone-200 space-y-1 text-xs text-stone-600">
                <div className="flex justify-between text-stone-500">
                  <span>Subtotal:</span>
                  <span className="font-mono text-stone-900 font-semibold">₹{session?.subtotal?.toFixed(2) || '0.00'}</span>
                </div>
                {(session?.discountAmount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                    <span>Discount ({session?.appliedPromoCode || 'Promo'}):</span>
                    <span className="font-mono">-₹{session?.discountAmount?.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-stone-500">
                  <span>GST (5%):</span>
                  <span className="font-mono text-stone-900 font-semibold">₹{session?.gstAmount?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[#8A4228] pt-1.5 border-t border-stone-200">
                  <span>GRAND TOTAL DUE:</span>
                  <span className="font-mono text-base text-stone-900 font-black">₹{session?.grandTotal?.toFixed(2) || '0.00'}</span>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-3 rounded-xl bg-[#8A4228] hover:bg-[#71351F] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>PRINT BILL</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowKotModal(false)}
                  className="py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs flex items-center justify-center gap-1.5 border border-stone-200 transition active:scale-95"
                >
                  <span>CLOSE</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
