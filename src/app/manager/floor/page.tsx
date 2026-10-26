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

          {/* Action Buttons */}
          <div className="space-y-2 pt-2 border-t border-[#2C2520]">
            {/* 1. Payment Mode Selector */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                Select Settlement Mode:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode('CASH')}
                  disabled={!isOccupied}
                  className={`py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition select-none ${
                    paymentMode === 'CASH'
                      ? 'bg-amber-600 text-white border-2 border-amber-400 shadow-md shadow-amber-900/40'
                      : 'bg-[#1C1815] text-stone-400 border border-[#2C2520] hover:bg-[#25201C]'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>💵 CASH</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('UPI')}
                  disabled={!isOccupied}
                  className={`py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition select-none ${
                    paymentMode === 'UPI'
                      ? 'bg-[#8A4228] text-white border-2 border-amber-400 shadow-md shadow-[#8A4228]/40'
                      : 'bg-[#1C1815] text-stone-400 border border-[#2C2520] hover:bg-[#25201C]'
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
              className={`w-full py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition shadow-md select-none ${
                isOccupied && (session?.grandTotal || 0) > 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-98 shadow-emerald-900/30'
                  : 'bg-[#1C1815] text-stone-600 border border-[#2C2520] cursor-not-allowed opacity-50'
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
                className={`py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 transition select-none ${
                  isOccupied
                    ? 'bg-[#24201D] hover:bg-[#2D2824] text-amber-300 border border-amber-600/40 active:scale-98'
                    : 'bg-[#141210] text-stone-600 border border-[#2C2520] cursor-not-allowed'
                }`}
              >
                <Printer className="w-4 h-4" />
                <span>🖨️ PRINT KOT</span>
              </button>

              <button
                type="button"
                onClick={handleVacateSeat}
                disabled={!isOccupied}
                className={`py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 transition select-none ${
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

      {/* KOT / Tax Invoice Preview Modal */}
      {showKotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181513] border-2 border-[#8A4228] rounded-3xl max-w-sm w-full p-6 text-white shadow-2xl space-y-4">
            {/* Receipt Header */}
            <div className="text-center pb-3 border-b border-dashed border-[#3D332C]">
              <h3 className="font-black text-base tracking-wider text-amber-400">THOOGUDEEPA</h3>
              <p className="text-[10px] text-stone-400 uppercase tracking-widest">Donne Biryani Mane</p>
              <div className="inline-block px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] mt-1.5 uppercase">
                KOT & TAX INVOICE
              </div>
            </div>

            {/* Table & Ticket Meta */}
            <div className="text-xs space-y-1 text-stone-300 bg-[#100E0C] p-3 rounded-xl border border-[#2C2520]">
              <div className="flex justify-between font-bold">
                <span className="text-amber-400">TABLE: SEAT {selectedSeat.seatNumber}</span>
                <span>Ticket #{latestTicketNumber}</span>
              </div>
              <div className="flex justify-between text-[11px] text-stone-400">
                <span>Waiter: {selectedSeat.assignedWaiter || (selectedSeat.seatNumber <= 8 ? 'Suhas' : 'Shiva')}</span>
                <span>Time: {placedTime}</span>
              </div>
              <div className="flex justify-between text-[11px] text-stone-400">
                <span>Customer: {session?.customerName || '(-)'}</span>
                <span>Mode: {paymentMode}</span>
              </div>
            </div>

            {/* Ordered Items Table */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs py-1">
              {allSelectedItems.length === 0 ? (
                <p className="text-center text-stone-500 py-2">No active items</p>
              ) : (
                allSelectedItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-[#2C2520]/60">
                    <span className="text-stone-200">
                      <strong className="text-amber-400 font-mono mr-1.5">{item.quantity}x</strong>
                      {item.itemName}
                    </span>
                    <span className="font-mono font-bold text-white">
                      ₹{(item.unitPrice * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Financial Summary */}
            <div className="pt-2 border-t border-dashed border-[#3D332C] space-y-1 text-xs">
              <div className="flex justify-between text-stone-400">
                <span>Subtotal:</span>
                <span className="font-mono text-white">₹{session?.subtotal?.toFixed(2) || '0.00'}</span>
              </div>
              {(session?.discountAmount || 0) > 0 && (
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>Discount ({session?.appliedPromoCode || 'Promo'}):</span>
                  <span className="font-mono">-₹{session?.discountAmount?.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-400">
                <span>GST (5%):</span>
                <span className="font-mono text-white">₹{session?.gstAmount?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-amber-400 pt-1.5 border-t border-[#3D332C]">
                <span>GRAND TOTAL DUE:</span>
                <span className="font-mono text-base text-white">₹{session?.grandTotal?.toFixed(2) || '0.00'}</span>
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>PRINT BILL</span>
              </button>
              <button
                type="button"
                onClick={() => setShowKotModal(false)}
                className="py-3 rounded-xl bg-[#221D1A] hover:bg-[#2C2520] text-stone-300 font-black text-xs flex items-center justify-center gap-1.5 border border-[#3D332C] transition active:scale-95"
              >
                <span>CLOSE</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
