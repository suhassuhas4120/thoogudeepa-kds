'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, CheckCircle2, Banknote, Smartphone } from 'lucide-react';
import { playSuccessChime } from '@/lib/audio-synth';
import { useSocketRoom } from '@/lib/useSocket';

export default function WaiterSuhasSettleScreen({ params }: { params: { id: string } }) {
  const router = useRouter();
  const seatId = parseInt(params.id, 10);
  const socket = useSocketRoom('room:waiter:zoneA');

  const [ticketNumber, setTicketNumber] = useState('101');
  const [subtotal, setSubtotal] = useState(0);
  const [gstAmount, setGstAmount] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [preferredMode, setPreferredMode] = useState('UPI');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchSession = () => {
    fetch(`/api/seats/${seatId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.activeSession) {
          const sess = data.data.activeSession;
          setSubtotal(sess.subtotal || 0);
          setGstAmount(sess.gstAmount || 0);
          setGrandTotal(sess.grandTotal || 0);
          setAppliedPromo(sess.appliedPromoCode || null);
          setDiscountAmount(sess.discountAmount || 0);
          setPreferredMode(sess.paymentPreferred || 'UPI');
          if (sess.orderTickets?.[0]) {
            setTicketNumber(sess.orderTickets[0].ticketNumber);
          }
        }
      });
  };

  useEffect(() => {
    fetchSession();
  }, [seatId]);

  useEffect(() => {
    if (!socket) return;
    const handleVacated = (data: any) => {
      if (!data?.seatId || data.seatId === seatId) {
        playSuccessChime();
        router.push('/waiter/suhas/floor');
      }
    };
    socket.on('seat:vacated', handleVacated);
    socket.on('payment:completed', handleVacated);

    return () => {
      socket.off('seat:vacated', handleVacated);
      socket.off('payment:completed', handleVacated);
    };
  }, [socket, seatId, router]);

  const handleSelectWaiterPaymentMode = async (mode: 'CASH' | 'UPI') => {
    setPreferredMode(mode);
    try {
      await fetch('/api/billing/payment-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seatId,
          lockMode: 'LOCKED_WAITER',
          paymentPreferred: mode,
        }),
      });
      fetchSession();
    } catch (e) {
      console.error(e);
    }
  };

  const handleVacateSeat = async () => {
    if (!confirmed || loading || grandTotal <= 0) return;
    setLoading(true);

    try {
      const res = await fetch('/api/billing/settle-vacate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seatId,
          paymentMode: preferredMode,
          settledBy: 'Suhas',
        }),
      });

      const data = await res.json();
      if (data.success) {
        playSuccessChime();
        router.push('/waiter/suhas/floor');
      } else {
        alert(data.error || 'Failed to vacate seat');
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

        {/* Details Card */}
        <div className="pt-4 space-y-4">
          <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-1.5 shadow-xs">
            <span className="text-xs font-bold text-stone-500">
              Settle Bill • Ticket #{ticketNumber}
            </span>
            <div className="flex justify-between items-center text-xs text-stone-500">
              <span>Bill Amount:</span>
              <span className="font-mono text-stone-900">
                ₹{((subtotal || 0) + (gstAmount || 0) || grandTotal).toFixed(2)}
              </span>
            </div>
            {appliedPromo && discountAmount > 0 && (
              <div className="flex justify-between items-center text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-emerald-800">
                <span>Promo Applied ({appliedPromo}):</span>
                <span className="font-mono">-₹{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="pt-1.5 border-t border-stone-200 flex justify-between items-center">
              <span className="text-xs font-bold text-stone-900">Final Amount Due:</span>
              <span className="text-xl font-black text-[#8A4228] font-mono">
                ₹{grandTotal.toFixed(2)}
              </span>
            </div>
            <span className="text-xs font-bold text-stone-600 block pt-1">
              Customer Preference: {preferredMode === 'CASH' ? '💵 Cash at Seat' : '📱 UPI on Device'}
            </span>
          </div>

          {/* Waiter Mode Toggle: Cash vs UPI */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
              Select Waiter Settlement Mode:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectWaiterPaymentMode('CASH')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  preferredMode === 'CASH'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-stone-800 text-slate-300 border-slate-800 hover:bg-slate-850'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>💵 Collect Cash</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectWaiterPaymentMode('UPI')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  preferredMode === 'UPI'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-stone-800 text-slate-300 border-slate-800 hover:bg-slate-850'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>📱 Scan UPI QR</span>
              </button>
            </div>
          </div>

          {/* Dynamic Payment Box: QR Code or Cash Collection Card */}
          {preferredMode === 'UPI' ? (
            <div className="bg-white border border-stone-200 rounded-3xl p-6 flex flex-col items-center shadow-xs">
              <div className="w-48 h-48 bg-white rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg">
                <div className="w-full h-full border-4 border-stone-800 p-2 flex flex-col items-center justify-between">
                  <div className="w-full flex justify-between">
                    <div className="w-8 h-8 bg-stone-800" />
                    <div className="w-8 h-8 bg-stone-800" />
                  </div>
                  <div className="text-center font-black text-xs text-stone-800">
                    QR
                  </div>
                  <div className="w-full flex justify-between">
                    <div className="w-8 h-8 bg-stone-800" />
                    <div className="w-6 h-6 border-2 border-stone-800" />
                  </div>
                </div>
              </div>

              <span className="text-sm font-bold text-stone-700 mt-4 font-mono">
                Amount : ₹{grandTotal.toFixed(2)}
              </span>
            </div>
          ) : (
            <div className="bg-stone-800 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-xl">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3 border border-amber-500/20">
                <Banknote className="w-8 h-8" />
              </div>
              <h4 className="font-black text-sm text-white">Cash Settlement at Seat</h4>
              <p className="text-xs text-stone-500 mt-1 max-w-[220px]">
                Collect <strong className="text-amber-400 font-mono">₹{grandTotal.toFixed(2)}</strong> cash from diner and hand over change.
              </p>
              <span className="text-[10px] text-amber-300 font-bold bg-amber-950/60 border border-amber-600/30 px-2 py-0.5 rounded mt-3">
                ✓ Customer UPI option disabled
              </span>
            </div>
          )}

          {/* Confirm Payment Checkbox */}
          {grandTotal <= 0 ? (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs text-center font-bold">
              Amount is ₹0.00 — Payment cannot be done.
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmed(!confirmed)}
              className="w-full flex items-center justify-center gap-2.5 p-3 rounded-xl bg-stone-800 border border-slate-800 text-xs font-bold hover:bg-slate-850 transition"
            >
              <div
                className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                  confirmed ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-stone-300'
                }`}
              >
                {confirmed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
              <span className={confirmed ? 'text-emerald-700 font-bold' : 'text-stone-700 font-medium'}>
                confirm payment
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Vacate Seat Button */}
      <div className="pt-4 pb-2">
        <button
          type="button"
          onClick={handleVacateSeat}
          disabled={!confirmed || loading || grandTotal <= 0}
          className={`w-full py-4 rounded-2xl font-black text-sm transition shadow-xl select-none active:scale-98 ${
            confirmed && grandTotal > 0
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
              : 'bg-slate-800 text-slate-500 border border-slate-800 cursor-not-allowed'
          }`}
        >
          {loading ? 'Clearing Seat...' : 'Vacate Seat'}
        </button>
      </div>
    </div>
  );
}
