'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldCheck, RefreshCw, CreditCard, LogOut, CheckCircle2 } from 'lucide-react';
import { useSocketRoom } from '@/lib/useSocket';
import { playSuccessChime } from '@/lib/audio-synth';

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
  activeSession?: {
    id: string;
    customerName: string;
    subtotal: number;
    gstAmount: number;
    grandTotal: number;
    discountAmount: number;
    paymentPreferred?: string;
    orderTickets: {
      ticketNumber: string;
      placedAt: string;
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
  }, []);

  // Real-time synchronization
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchFloor();

    socket.on('seat:status_changed', handleUpdate);
    socket.on('order:placed', handleUpdate);
    socket.on('order:item_status_changed', handleUpdate);
    socket.on('seat:vacated', handleUpdate);

    return () => {
      socket.off('seat:status_changed', handleUpdate);
      socket.off('order:placed', handleUpdate);
      socket.off('order:item_status_changed', handleUpdate);
      socket.off('seat:vacated', handleUpdate);
    };
  }, [socket]);

  const selectedSeat = seats.find((s) => s.id === selectedSeatId) || seats[0];
  const session = selectedSeat?.activeSession;
  const isOccupied = selectedSeat?.status === 'OCCUPIED' || selectedSeat?.status === 'BILL_REQUESTED';

  // Manager Actions: Collect Payment & Vacate
  const handleCollectPaymentAndVacate = async (mode: string = 'CASH') => {
    if (!selectedSeat || !session) return;
    try {
      const res = await fetch('/api/billing/settle-vacate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seatId: selectedSeat.id,
          paymentMode: mode,
          settledBy: 'General Manager Desk',
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

  // Compile selected items
  const allSelectedItems: OrderItem[] = [];
  session?.orderTickets?.forEach((t) => {
    t.items.forEach((it) => allSelectedItems.push(it));
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none">
      {/* Top Executive Navigation Bar */}
      <header className="h-16 bg-[#181513] border-b border-[#2C2520] px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8A4228]/25 text-[#D08A52] border border-[#8A4228]/40 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white uppercase tracking-wider">
              THOOGUDEEPA DONNE BIRYANI
            </h1>
            <p className="text-[11px] text-[#D08A52] font-semibold tracking-wide">Executive Manager Portal</p>
          </div>
        </div>

        {/* 9 Manager Portal Navigation Links */}
        <nav className="flex items-center gap-1.5 bg-[#100E0C] p-1.5 rounded-2xl border border-[#2C2520] text-xs font-bold">
          <Link href="/manager/floor" className="px-3 py-1.5 rounded-xl bg-[#8A4228] text-white shadow-sm">
            Live Floor
          </Link>
          <Link href="/manager/kitchen" className="px-3 py-1.5 rounded-xl text-stone-400 hover:text-white transition">
            KDS Stream
          </Link>
          <Link href="/manager/parcel" className="px-3 py-1.5 rounded-xl text-stone-400 hover:text-white transition">
            📦 Parcel Desk
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
          <Link href="/manager/reports" className="px-3 py-1.5 rounded-xl text-stone-400 hover:text-white transition">
            Sales Reports
          </Link>
          <Link href="/manager/promos" className="px-3 py-1.5 rounded-xl text-stone-400 hover:text-white transition">
            Promos
          </Link>
        </nav>

        <Link href="/manager" className="text-xs text-stone-400 hover:text-white font-medium transition">
          Logout
        </Link>
      </header>

      {/* Main Workspace: Left Floor Grid (16 Seats) + Right Selected Seat Panel */}
      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        {/* ======================================================== */}
        {/* LEFT SIDE (7 COLS): 16 SEATS FLOOR MAP                   */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 bg-[#181513] border border-[#2C2520] rounded-3xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex justify-between items-center pb-3 border-b border-[#2C2520] mb-4">
              <h2 className="text-xs font-black text-stone-300 uppercase tracking-wider">
                📋 FLOOR MAP (16 SEATS)
              </h2>
              <span className="text-xs font-bold text-stone-400">
                Active: {seats.filter((s) => s.status !== 'VACANT').length} / 16
              </span>
            </div>

            {/* ZONE A: SUHAS (Seats 1 to 8) */}
            <div className="mb-5">
              <span className="text-[11px] font-black text-[#D08A52] uppercase tracking-wider block mb-2">
                ZONE A : SUHAS (Seats 1 to 8)
              </span>
              <div className="grid grid-cols-4 gap-2.5">
                {seats.slice(0, 8).map((seat) => {
                  const occupied = seat.status !== 'VACANT';
                  const isSelected = selectedSeat?.id === seat.id;
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      onClick={() => setSelectedSeatId(seat.id)}
                      className={`p-3 rounded-2xl border text-left transition ${
                        isSelected
                          ? 'ring-2 ring-[#8A4228] border-[#8A4228] bg-[#8A4228]/20 shadow-md'
                          : occupied
                          ? 'bg-[#221D1A] border-[#D08A52]/50 hover:border-[#D08A52]'
                          : 'bg-[#141210]/60 border-[#2C2520] hover:bg-[#201B18]'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-black text-xs text-white">S{seat.seatNumber}</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            occupied ? 'bg-[#198754] animate-pulse' : 'bg-stone-600'
                          }`}
                        />
                      </div>
                      <span className="text-[10px] text-stone-400 block truncate font-medium">
                        {occupied ? seat.currentGuestName || 'Diner Seated' : 'Vacant'}
                      </span>
                      <span className="text-[10px] font-bold text-[#D08A52] block mt-1">
                        {occupied ? `₹${seat.activeSession?.grandTotal?.toFixed(0) || '0'}` : '—'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ZONE B: SHIVA (Seats 9 to 16) */}
            <div>
              <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider block mb-2">
                ZONE B : SHIVA (Seats 9 to 16)
              </span>
              <div className="grid grid-cols-4 gap-2.5">
                {seats.slice(8, 16).map((seat) => {
                  const occupied = seat.status !== 'VACANT';
                  const isSelected = selectedSeat?.id === seat.id;
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      onClick={() => setSelectedSeatId(seat.id)}
                      className={`p-3 rounded-2xl border text-left transition ${
                        isSelected
                          ? 'ring-2 ring-[#8A4228] border-[#8A4228] bg-[#8A4228]/20 shadow-md'
                          : occupied
                          ? 'bg-[#221D1A] border-emerald-500/50 hover:border-emerald-400'
                          : 'bg-[#141210]/60 border-[#2C2520] hover:bg-[#201B18]'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-black text-xs text-white">S{seat.seatNumber}</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            occupied ? 'bg-emerald-400 animate-pulse' : 'bg-stone-600'
                          }`}
                        />
                      </div>
                      <span className="text-[10px] text-stone-400 block truncate font-medium">
                        {occupied ? seat.currentGuestName || 'Diner Seated' : 'Vacant'}
                      </span>
                      <span className="text-[10px] font-bold text-amber-400 block mt-1">
                        {occupied ? `₹${seat.activeSession?.grandTotal?.toFixed(0) || '0'}` : '—'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#2C2520] text-xs text-stone-400 flex justify-between">
            <span>Click any seat to inspect, collect payment or vacate.</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Cloud Database Connected
            </span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT SIDE (5 COLS): COMPLETE SELECTED SEAT PANEL        */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 bg-[#181513] border border-[#2C2520] rounded-3xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            {/* Header */}
            <div className="pb-3 border-b border-[#2C2520] mb-3 flex justify-between items-start">
              <div>
                <h3 className="font-black text-base text-white">
                  🔍 SEAT {selectedSeat?.seatNumber} ({selectedSeat?.currentGuestName || '-'})
                </h3>
                <span className="text-xs text-stone-400">
                  Assigned Waiter: <strong className="text-white">{selectedSeat?.assignedWaiter}</strong>
                </span>
              </div>
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                  isOccupied
                    ? 'bg-[#8A4228]/25 text-[#D08A52] border border-[#8A4228]/40'
                    : 'bg-[#100E0C] text-stone-400 border border-[#2C2520]'
                }`}
              >
                {selectedSeat?.status}
              </span>
            </div>

            {/* Ordered Dishes List */}
            <div className="mb-4">
              <span className="text-[11px] font-black text-stone-400 uppercase tracking-wider block mb-1.5">
                ORDERED ITEMS :
              </span>

              {!isOccupied ? (
                <div className="p-4 bg-[#100E0C] border border-[#2C2520] rounded-2xl text-center text-xs text-stone-400">
                  Seat is currently vacant
                </div>
              ) : allSelectedItems.length === 0 ? (
                <div className="p-4 bg-[#100E0C] border border-[#2C2520] rounded-2xl text-center text-xs text-[#D08A52]">
                  Diner seated • Browsing menu (No items ordered yet)
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[36vh] overflow-y-auto pr-1">
                  {allSelectedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center p-2.5 rounded-xl bg-[#221D1A] border border-[#2C2520] text-xs"
                    >
                      <div>
                        <span className="font-bold text-white">
                          {item.quantity}x {item.itemName}
                        </span>
                        <span className="text-[10px] text-stone-400 block capitalize">
                          Status: {item.status}
                        </span>
                      </div>
                      <span className="font-bold text-[#D08A52]">
                        ₹{(item.unitPrice * item.quantity).toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bill Math Summary */}
            {isOccupied && (
              <div className="bg-[#221D1A] border border-[#2C2520] rounded-2xl p-3.5 space-y-1.5 text-xs mb-4">
                <div className="flex justify-between text-stone-400">
                  <span>Item Subtotal:</span>
                  <span className="text-white font-medium">₹{session?.subtotal?.toFixed(2) || '0.00'}</span>
                </div>
                {session?.discountAmount ? (
                  <div className="flex justify-between text-emerald-400 font-semibold">
                    <span>Promo Discount:</span>
                    <span>-₹{session.discountAmount.toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-stone-400">
                  <span>GST (5%):</span>
                  <span className="text-white font-medium">₹{session?.gstAmount?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-[#D08A52] pt-1.5 border-t border-[#2C2520]">
                  <span>GRAND TOTAL DUE:</span>
                  <span className="text-base text-white">₹{session?.grandTotal?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Right Side Buttons: Collect Payment & Vacate */}
          <div className="space-y-2 pt-2 border-t border-[#2C2520]">
            <button
              type="button"
              onClick={() => handleCollectPaymentAndVacate('UPI')}
              disabled={!isOccupied}
              className={`w-full py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition shadow-md select-none ${
                isOccupied
                  ? 'bg-[#8A4228] hover:bg-[#71351F] text-white active:scale-98 shadow-[#8A4228]/20'
                  : 'bg-[#1E1A17] text-stone-600 border border-[#2C2520] cursor-not-allowed'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>COLLECT PAYMENT</span>
            </button>

            <button
              type="button"
              onClick={() => handleCollectPaymentAndVacate('CASH')}
              disabled={!isOccupied}
              className={`w-full py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition select-none ${
                isOccupied
                  ? 'bg-[#221D1A] hover:bg-rose-950/60 hover:text-rose-200 border border-[#2C2520] text-stone-300 active:scale-98'
                  : 'bg-[#141210] text-stone-600 border border-[#2C2520] cursor-not-allowed'
              }`}
            >
              <LogOut className="w-4 h-4" />
              <span>VACATE SEAT</span>
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
