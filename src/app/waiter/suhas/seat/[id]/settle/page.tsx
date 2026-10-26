'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, CheckCircle2 } from 'lucide-react';
import { playSuccessChime } from '@/lib/audio-synth';

export default function WaiterSuhasSettleScreen({ params }: { params: { id: string } }) {
  const router = useRouter();
  const seatId = parseInt(params.id, 10);

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

  const handleVacateSeat = async () => {
    if (!confirmed || loading) return;
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
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 max-w-md mx-auto select-none">
      {/* Top Header */}
      <div>
        <header className="flex items-center justify-between pb-3 border-b border-slate-800">
          <Link
            href={`/waiter/suhas/seat/${seatId}`}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Link>
          <span className="text-sm font-black text-amber-400">Seat {seatId}</span>
        </header>

        {/* Details Card */}
        <div className="pt-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1.5">
            <span className="text-xs font-bold text-slate-400">
              Settle Bill • Ticket #{ticketNumber}
            </span>
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Bill Amount:</span>
              <span className="font-mono text-white">
                ₹{((subtotal || 0) + (gstAmount || 0) || grandTotal).toFixed(2)}
              </span>
            </div>
            {appliedPromo && discountAmount > 0 && (
              <div className="flex justify-between items-center text-xs text-emerald-400 font-bold bg-emerald-950/50 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                <span>Promo Applied ({appliedPromo}):</span>
                <span className="font-mono">-₹{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="pt-1.5 border-t border-slate-800 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-300">Final Amount Due:</span>
              <span className="text-xl font-black text-amber-400 font-mono">
                ₹{grandTotal.toFixed(2)}
              </span>
            </div>
            <span className="text-xs font-bold text-stone-300 block pt-1">
              Payment Preferred: {preferredMode === 'CASH' ? '💵 Cash at Seat' : '📱 UPI on Device'}
            </span>
          </div>

          {/* QR Code Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col items-center shadow-xl">
            <div className="w-48 h-48 bg-white rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg">
              <div className="w-full h-full border-4 border-slate-900 p-2 flex flex-col items-center justify-between">
                <div className="w-full flex justify-between">
                  <div className="w-8 h-8 bg-slate-900" />
                  <div className="w-8 h-8 bg-slate-900" />
                </div>
                <div className="text-center font-black text-xs text-slate-900">
                  QR
                </div>
                <div className="w-full flex justify-between">
                  <div className="w-8 h-8 bg-slate-900" />
                  <div className="w-6 h-6 border-2 border-slate-900" />
                </div>
              </div>
            </div>

            <span className="text-sm font-bold text-slate-200 mt-4 font-mono">
              Amount : ₹{grandTotal.toFixed(2)}
            </span>
          </div>

          {/* Confirm Payment Checkbox */}
          <button
            type="button"
            onClick={() => setConfirmed(!confirmed)}
            className="w-full flex items-center justify-center gap-2.5 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold hover:bg-slate-850 transition"
          >
            <div
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                confirmed ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-slate-600'
              }`}
            >
              {confirmed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
            <span className={confirmed ? 'text-emerald-400' : 'text-slate-300'}>
              confirm payment
            </span>
          </button>
        </div>
      </div>

      {/* Vacate Seat Button */}
      <div className="pt-4 pb-2">
        <button
          type="button"
          onClick={handleVacateSeat}
          disabled={!confirmed || loading}
          className={`w-full py-4 rounded-2xl font-black text-sm transition shadow-xl select-none active:scale-98 ${
            confirmed
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
