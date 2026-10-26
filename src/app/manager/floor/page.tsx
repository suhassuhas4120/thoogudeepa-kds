'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CreditCard, LogOut, CheckCircle2, RefreshCw, Banknote, Smartphone } from 'lucide-react';
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

  const fetchFloor = async () => {
    try {
      const promises = Array.from({ length: 16 }, (_, i) =>
        fetch(`/api/seats/${i + 1}`).then((res) => res.json())
      );
      const results = await Promise.all(promises);
      const list: SeatData[] = results.map((r) => ({
        ...r.data.seat,
        activeSession: r.data.activeSession,
      }));
      setSeats(list);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFloor();
    const interval = setInterval(fetchFloor, 3000);
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

  // Real-time synchronization
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchFloor();

    socket.on('seat:status_changed', handleUpdate);
    socket.on('order:placed', handleUpdate);
    socket.on('order:item_status_changed', handleUpdate);
    socket.on('seat:vacated', handleUpdate);
    socket.on('service:requested', handleUpdate);

    return () => {
      socket.off('seat:status_changed', handleUpdate);
      socket.off('order:placed', handleUpdate);
      socket.off('order:item_status_changed', handleUpdate);
      socket.off('seat:vacated', handleUpdate);
      socket.off('service:requested', handleUpdate);
    };
  }, [socket]);

  const selectedSeat = seats.find((s) => s.id === selectedSeatId) || seats[0];
  const session = selectedSeat?.activeSession;
  const isOccupied = selectedSeat?.status !== 'VACANT';

  // Manager Actions: Collect Payment & Vacate
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
    if (isSelected) return { label: '🟢 Selected', color: 'text-emerald-400' };
    if (seat.status === 'VACANT') return { label: '⚪ Vacant', color: 'text-stone-500' };
    if (seat.status === 'BILL_REQUESTED') return { label: '🧾 Bill Req', color: 'text-amber-400 font-bold' };
    
    // Check ticket cooking/ready status
    const tickets = seat.activeSession?.orderTickets || [];
    const allItems = tickets.flatMap((t) => t.items || []);
    if (allItems.some((i) => i.status === 'ready')) return { label: '🟢 Ready', color: 'text-emerald-400 font-bold' };
    if (allItems.some((i) => i.status === 'preparing' || i.status === 'placed')) {
      return { label: '🍳 Cooking', color: 'text-orange-400' };
    }
    if (allItems.length > 0 && allItems.every((i) => i.status === 'served')) {
      return { label: '🍽️ Eating', color: 'text-blue-400' };
    }
    return { label: '🟢 Seated', color: 'text-emerald-400' };
  };

  return (
    <div className="min-h-screen bg-[#100E0C] text-white flex flex-col font-sans select-none">
      {/* Shared Manager Top Navigation */}
      <ManagerTopNav activeTab="floor" />

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 2-COLUMN MAIN WORKSPACE                                            */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
        {/* ============================================================== */}
        {/* LEFT COLUMN: FLOOR MAP (16 SEATS)                              */}
        {/* ============================================================== */}
        <div className="lg:col-span-7 bg-[#181513] border border-[#2C2520] rounded-3xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex justify-between items-center pb-2.5 border-b border-[#2C2520] mb-3">
              <h2 className="text-xs font-black text-stone-300 uppercase tracking-wider">
                📋 FLOOR MAP (16 SEATS)
              </h2>
              <span className="text-xs font-bold text-stone-400">
                Active: {seats.filter((s) => s.status !== 'VACANT').length} / 16
              </span>
            </div>

            {/* ZONE A : SUHAS (Seats 1 to 8) */}
            <div className="mb-4 p-3 bg-[#13110F] border border-[#26201B] rounded-2xl">
              <span className="text-[11px] font-black text-[#D08A52] uppercase tracking-wider block mb-2">
                ZONE A : SUHAS (Seats 1 to 8)
              </span>
              <div className="grid grid-cols-4 gap-2">
                {seats.slice(0, 8).map((seat) => {
                  const isSelected = selectedSeat?.id === seat.id;
                  const statusInfo = getSeatCardStatus(seat, isSelected);
                  const isVacant = seat.status === 'VACANT';
                  const dinerName = seat.currentGuestName && seat.currentGuestName !== '-' ? `(${seat.currentGuestName})` : '';

                  return (
                    <button
                      key={seat.id}
                      type="button"
                      onClick={() => setSelectedSeatId(seat.id)}
                      className={`p-2.5 rounded-xl border text-left transition select-none ${
                        isSelected
                          ? 'ring-2 ring-[#8A4228] border-[#8A4228] bg-[#8A4228]/20 shadow-lg'
                          : !isVacant
                          ? 'bg-[#221D1A] border-[#D08A52]/40 hover:border-[#D08A52]'
                          : 'bg-[#181513] border-[#2C2520] hover:bg-[#201B18]'
                      }`}
                    >
                      <div className="font-black text-xs text-white truncate">
                        S{seat.seatNumber} <span className="text-[11px] font-medium text-stone-400">{dinerName}</span>
                      </div>
                      <div className={`text-[11px] mt-1 ${statusInfo.color}`}>
                        {statusInfo.label}
                      </div>
                      <div className="text-[11px] font-bold text-[#D08A52] mt-0.5">
                        {!isVacant ? `₹${seat.activeSession?.grandTotal?.toFixed(0) || '0'}` : '—'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ZONE B : SHIVA (Seats 9 to 16) */}
            <div className="p-3 bg-[#13110F] border border-[#26201B] rounded-2xl">
              <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider block mb-2">
                ZONE B : SHIVA (Seats 9 to 16)
              </span>
              <div className="grid grid-cols-4 gap-2">
                {seats.slice(8, 16).map((seat) => {
                  const isSelected = selectedSeat?.id === seat.id;
                  const statusInfo = getSeatCardStatus(seat, isSelected);
                  const isVacant = seat.status === 'VACANT';
                  const dinerName = seat.currentGuestName && seat.currentGuestName !== '-' ? `(${seat.currentGuestName})` : '';

                  return (
                    <button
                      key={seat.id}
                      type="button"
                      onClick={() => setSelectedSeatId(seat.id)}
                      className={`p-2.5 rounded-xl border text-left transition select-none ${
                        isSelected
                          ? 'ring-2 ring-[#8A4228] border-[#8A4228] bg-[#8A4228]/20 shadow-lg'
                          : !isVacant
                          ? 'bg-[#221D1A] border-emerald-500/40 hover:border-emerald-400'
                          : 'bg-[#181513] border-[#2C2520] hover:bg-[#201B18]'
                      }`}
                    >
                      <div className="font-black text-xs text-white truncate">
                        S{seat.seatNumber} <span className="text-[11px] font-medium text-stone-400">{dinerName}</span>
                      </div>
                      <div className={`text-[11px] mt-1 ${statusInfo.color}`}>
                        {statusInfo.label}
                      </div>
                      <div className="text-[11px] font-bold text-amber-400 mt-0.5">
                        {!isVacant ? `₹${seat.activeSession?.grandTotal?.toFixed(0) || '0'}` : '—'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#2C2520] text-xs text-stone-400 flex justify-between">
            <span>Click any seat to inspect, collect payment or vacate.</span>
            <span className="text-emerald-400 font-medium">● Connected</span>
          </div>
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: SELECTED SEAT DETAILS & BILLING                  */}
        {/* ============================================================== */}
        <div className="lg:col-span-5 bg-[#181513] border border-[#2C2520] rounded-3xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            {/* Header matching ASCII */}
            <div className="pb-3 border-b border-[#2C2520] mb-3">
              <h3 className="font-black text-sm text-white tracking-wide">
                🔍 SELECTED: SEAT {String(selectedSeat?.seatNumber || 1).padStart(2, '0')} {selectedSeat?.currentGuestName && selectedSeat.currentGuestName !== '-' ? `(${selectedSeat.currentGuestName})` : ''}
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Waiter: <strong className="text-white">{selectedSeat?.assignedWaiter} ({selectedSeat?.zone === 'ZONE_A' ? 'Zone A' : 'Zone B'})</strong> {latestTicketNumber !== '—' ? `• Ticket ${latestTicketNumber}` : ''}
              </p>
              <p className="text-xs text-stone-400 mt-0.5">
                🕒 Placed Time: <strong className="text-stone-300">{placedTime}</strong>
              </p>
            </div>

            {/* ORDERED ITEMS section matching ASCII */}
            <div className="mb-4">
              <span className="text-[11px] font-black text-stone-400 uppercase tracking-wider block mb-2">
                ORDERED ITEMS :
              </span>

              {!isOccupied ? (
                <div className="p-4 bg-[#100E0C] border border-[#2C2520] rounded-2xl text-center text-xs text-stone-500">
                  Seat is currently vacant
                </div>
              ) : allSelectedItems.length === 0 ? (
                <div className="p-4 bg-[#100E0C] border border-[#2C2520] rounded-2xl text-center text-xs text-[#D08A52]">
                  Diner seated • Browsing menu (No items ordered yet)
                </div>
              ) : (
                <div className="space-y-1 max-h-[30vh] overflow-y-auto pr-1">
                  {allSelectedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center py-1.5 px-2.5 rounded-lg bg-[#221D1A] border border-[#2C2520] text-xs"
                    >
                      <span className="font-medium text-stone-200">
                        • {item.quantity}x {item.itemName}
                      </span>
                      <span className="font-mono font-bold text-[#D08A52]">
                        ₹{(item.unitPrice * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bill Math Summary matching ASCII */}
            {isOccupied && (
              <div className="bg-[#100E0C] border border-[#2C2520] rounded-2xl p-3.5 space-y-1.5 text-xs mb-3">
                <div className="flex justify-between text-stone-400">
                  <span>Item Subtotal:</span>
                  <span className="text-white font-mono">₹{session?.subtotal?.toFixed(2) || '0.00'}</span>
                </div>
                {session?.discountAmount ? (
                  <div className="flex justify-between text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded">
                    <span>Promo Applied ({session.appliedPromoCode || 'Coupon'}):</span>
                    <span className="font-mono font-bold">-₹{session.discountAmount.toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-stone-400">
                  <span>GST (5%):</span>
                  <span className="text-white font-mono">₹{session?.gstAmount?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Packaging / Service:</span>
                  <span className="text-white font-mono">₹0.00</span>
                </div>
                <div className="flex justify-between text-sm font-black text-[#D08A52] pt-2 border-t border-[#2C2520]">
                  <span>GRAND TOTAL:</span>
                  <span className="text-base text-white font-mono">₹{session?.grandTotal?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            )}

            {/* Payment Preferred line */}
            {isOccupied && (
              <div className="text-xs text-stone-400 mb-2">
                Payment Preferred: <strong className="text-[#D08A52]">{session?.paymentPreferred === 'CASH' ? '💵 Cash' : '📱 UPI'}</strong>
              </div>
            )}
          </div>

          {/* Action Buttons matching ASCII */}
          <div className="space-y-2 pt-2 border-t border-[#2C2520]">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleCollectPaymentAndVacate('CASH')}
                disabled={!isOccupied || (session?.grandTotal || 0) <= 0}
                className={`py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 transition shadow-md select-none ${
                  isOccupied && (session?.grandTotal || 0) > 0
                    ? 'bg-amber-700 hover:bg-amber-600 text-white active:scale-98 shadow-amber-900/30'
                    : 'bg-[#1C1815] text-stone-600 border border-[#2C2520] cursor-not-allowed opacity-50'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>💵 COLLECT CASH</span>
              </button>

              <button
                type="button"
                onClick={() => handleCollectPaymentAndVacate('UPI')}
                disabled={!isOccupied || (session?.grandTotal || 0) <= 0}
                className={`py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 transition shadow-md select-none ${
                  isOccupied && (session?.grandTotal || 0) > 0
                    ? 'bg-[#8A4228] hover:bg-[#71351F] text-white active:scale-98 shadow-[#8A4228]/25'
                    : 'bg-[#1C1815] text-stone-600 border border-[#2C2520] cursor-not-allowed opacity-50'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>📱 COLLECT UPI</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleVacateSeat}
              disabled={!isOccupied}
              className={`w-full py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition select-none ${
                isOccupied
                  ? 'bg-[#221D1A] hover:bg-rose-950/60 hover:text-rose-200 border border-[#2C2520] text-stone-300 active:scale-98'
                  : 'bg-[#141210] text-stone-600 border border-[#2C2520] cursor-not-allowed'
              }`}
            >
              <LogOut className="w-4 h-4" />
              <span>🚪 VACATE SEAT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
