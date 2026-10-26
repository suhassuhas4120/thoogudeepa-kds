'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Star, CheckCircle, ArrowRight, UserCheck, Tag, Banknote, Smartphone } from 'lucide-react';
import { useSocketRoom } from '@/lib/useSocket';
import { playSuccessChime } from '@/lib/audio-synth';
import confetti from 'canvas-confetti';
import { useCustomerTheme } from '@/lib/useCustomerTheme';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function CustomerScreen5({ params }: { params: { seatId: string } }) {
  const router = useRouter();
  const seatId = parseInt(params.seatId, 10);
  const socket = useSocketRoom(`room:seat:${seatId}`);
  const { theme, toggleTheme } = useCustomerTheme();
  const isOrange = theme === 'burnt-orange';

  const [customerName, setCustomerName] = useState('-');
  const [waiterName, setWaiterName] = useState('Suhas');
  const [grandTotalDue, setGrandTotalDue] = useState(0);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentChoice, setPaymentChoice] = useState<'CASH' | 'UPI'>('CASH');
  const [selectedUpiApp, setSelectedUpiApp] = useState<string>('PhonePe');
  const [isSettled, setIsSettled] = useState(false);
  const [rating, setRating] = useState(5);
  const [loadingPromo, setLoadingPromo] = useState(false);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/seats/${seatId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.activeSession) {
          const sess = data.data.activeSession;
          setCustomerName(sess.customerName || '-');
          setGrandTotalDue(sess.grandTotal || 0);
          setDiscountAmount(sess.discountAmount || 0);
          setAppliedPromo(sess.appliedPromoCode || null);
          setWaiterName(data.data.seat.assignedWaiter || (seatId <= 8 ? 'Suhas' : 'Shiva'));
        }
      });
  }, [seatId]);

  useEffect(() => {
    if (!socket) return;
    const handleVacate = () => {
      setIsSettled(true);
      playSuccessChime();
      try {
        confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
      } catch (e) {}
    };

    socket.on('seat:vacated', handleVacate);
    return () => {
      socket.off('seat:vacated', handleVacate);
    };
  }, [socket]);

  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim() || loadingPromo) return;
    setLoadingPromo(true);
    setPromoMessage(null);

    try {
      const res = await fetch('/api/billing/apply-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seatId,
          promoCode: promoCodeInput.trim().toUpperCase(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDiscountAmount(data.data.discountAmount);
        setAppliedPromo(data.data.appliedPromoCode);
        setPromoMessage(`Coupon applied: ₹${data.data.discountAmount.toFixed(0)} discount.`);
      } else {
        setPromoMessage(data.error || 'Invalid coupon code');
      }
    } catch (e) {
      console.error(e);
      setPromoMessage('Could not verify promo code');
    } finally {
      setLoadingPromo(false);
    }
  };

  const handleSelectPaymentChoice = async (mode: 'CASH' | 'UPI') => {
    setPaymentChoice(mode);
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
    } catch (e) {
      console.error(e);
    }
  };

  const totalAmountToBePaid = Math.max(0, grandTotalDue - discountAmount);

  return (
    <div
      className={`min-h-screen flex flex-col justify-between p-4 max-w-md mx-auto font-sans select-none relative transition-colors duration-300 ${
        isOrange ? 'bg-[#FFFCF7] text-[#5B5049]' : 'bg-gradient-to-b from-[#04120d] via-[#081e16] to-[#04110c] text-white'
      }`}
    >
      {/* Top Bar */}
      <div>
        <header
          className={`flex items-center justify-between pb-3 border-b ${
            isOrange ? 'border-[#E8D5C3]' : 'border-emerald-500/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <Link
              href={`/seat/${seatId}/tracking`}
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold transition ${
                isOrange
                  ? 'bg-[#F3DFCC] text-[#8A4228] hover:bg-[#ebd5c0]'
                  : 'bg-[#0b2d21] border border-emerald-500/30 text-amber-400 hover:bg-[#0f3d2d]'
              }`}
            >
              ‹
            </Link>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-black ${isOrange ? 'text-[#8A4228]' : 'text-amber-400'}`}>
                  SEAT {String(seatId).padStart(2, '0')}
                </span>
                {customerName !== '-' && (
                  <span className={`text-[11px] font-bold ${isOrange ? 'text-[#D08A52]' : 'text-emerald-300'}`}>
                    ({customerName})
                  </span>
                )}
              </div>
              <p className={`text-[9px] font-bold tracking-wider uppercase ${isOrange ? 'text-[#5B5049]/70' : 'text-emerald-400/80'}`}>
                Seat Billing
              </p>
            </div>
          </div>

          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        </header>

        {/* Content Details */}
        <div className="pt-4 space-y-4">
          <div>
            <span
              className={`text-[11px] font-black uppercase tracking-wider block ${
                isOrange ? 'text-[#D08A52]' : 'text-amber-400'
              }`}
            >
              Pay via Waiter Assistance
            </span>
            <h2 className={`text-2xl font-black mt-0.5 ${isOrange ? 'text-[#5B5049]' : 'text-white'}`}>
              Bill Amount: <span className={isOrange ? 'text-[#8A4228]' : 'text-amber-400'}>₹{grandTotalDue.toFixed(2)}</span>
            </h2>
          </div>

          {/* Promo Code Row (Below Grand Total) */}
          <div
            className={`border rounded-2xl p-4 space-y-2.5 shadow-sm transition ${
              isOrange
                ? 'bg-[#F3DFCC] border-[#E8D5C3]'
                : 'bg-gradient-to-r from-[#0b291f] to-[#072017] border-amber-400/30 text-white'
            }`}
          >
            <span
              className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                isOrange ? 'text-[#8A4228]' : 'text-amber-300'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Apply Promo Code</span>
            </span>

            <div className="flex gap-2">
              <input
                type="text"
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value)}
                placeholder="Enter promo code"
                className={`flex-1 rounded-xl px-3.5 py-2.5 text-xs font-black uppercase focus:outline-none transition ${
                  isOrange
                    ? 'bg-[#FFFCF7] border border-[#E8D5C3] text-[#8A4228] placeholder-[#5B5049]/40 focus:border-[#8A4228]'
                    : 'bg-[#061c14] border border-emerald-500/30 text-amber-300 placeholder-emerald-700 focus:border-amber-400'
                }`}
              />
              <button
                type="button"
                onClick={handleApplyPromo}
                disabled={loadingPromo}
                className={`px-4 py-2.5 font-black text-xs rounded-xl transition shadow-md active:scale-95 ${
                  isOrange
                    ? 'bg-[#8A4228] hover:bg-[#71351F] text-[#FFFCF7]'
                    : 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-amber-500/20'
                }`}
              >
                {loadingPromo ? '...' : 'APPLY'}
              </button>
            </div>

            {promoMessage && (
              <p
                className={`text-[11px] font-bold ${
                  appliedPromo
                    ? isOrange ? 'text-[#198754]' : 'text-emerald-300'
                    : 'text-[#D92D20]'
                }`}
              >
                {promoMessage}
              </p>
            )}

            {/* Total Amount to be Paid */}
            <div
              className={`pt-2.5 border-t flex justify-between items-center text-sm font-black ${
                isOrange ? 'border-[#E8D5C3]' : 'border-emerald-500/20 text-white'
              }`}
            >
              <span className={isOrange ? 'text-[#5B5049]' : 'text-emerald-200'}>Total to be Paid:</span>
              <span className={`text-lg font-black ${isOrange ? 'text-[#D92D20]' : 'text-amber-400'}`}>
                ₹{totalAmountToBePaid.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Assigned Waiter Card */}
          <div
            className={`text-xs flex items-center justify-between p-3 rounded-xl border ${
              isOrange
                ? 'bg-[#FFFCF7] border-[#E8D5C3] text-[#5B5049]'
                : 'bg-[#082218] border-emerald-500/20 text-emerald-300/80'
            }`}
          >
            <div className="flex items-center gap-2">
              <UserCheck className={`w-4 h-4 ${isOrange ? 'text-[#8A4228]' : 'text-amber-400'}`} />
              <span>
                Assigned Waiter:{' '}
                <strong className={isOrange ? 'text-[#8A4228]' : 'text-white'}>{waiterName}</strong>
              </span>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                isOrange
                  ? 'bg-[#F3DFCC] border-[#E8D5C3] text-[#8A4228]'
                  : 'bg-[#051711] border-amber-400/30 text-amber-300'
              }`}
            >
              {seatId <= 8 ? 'Zone A (Seats 1-8)' : 'Zone B (Seats 9-16)'}
            </span>
          </div>

          {/* Payment Method Choice */}
          <div className="space-y-2 pt-1">
            <h3
              className={`text-xs font-black tracking-wider uppercase ${
                isOrange ? 'text-[#8A4228]' : 'text-emerald-300'
              }`}
            >
              Select Preferred Payment Mode:
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSelectPaymentChoice('CASH')}
                className={`py-3 px-3 rounded-xl border text-xs font-black transition flex items-center justify-center gap-2 ${
                  paymentChoice === 'CASH'
                    ? isOrange
                      ? 'bg-[#8A4228] text-[#FFFCF7] border-[#8A4228]'
                      : 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 border-amber-300 shadow-amber-500/20'
                    : isOrange
                    ? 'bg-[#F3DFCC] border-[#E8D5C3] text-[#8A4228] hover:bg-[#ebd5c0]'
                    : 'bg-[#08241a] border-emerald-500/30 text-emerald-200 hover:bg-[#0c3124]'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Cash at Seat</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPaymentChoice('UPI')}
                className={`py-3 px-3 rounded-xl border text-xs font-black transition flex items-center justify-center gap-2 ${
                  paymentChoice === 'UPI'
                    ? isOrange
                      ? 'bg-[#8A4228] text-[#FFFCF7] border-[#8A4228]'
                      : 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 border-amber-300 shadow-amber-500/20'
                    : isOrange
                    ? 'bg-[#F3DFCC] border-[#E8D5C3] text-[#8A4228] hover:bg-[#ebd5c0]'
                    : 'bg-[#08241a] border-emerald-500/30 text-emerald-200 hover:bg-[#0c3124]'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>UPI on Device</span>
              </button>
            </div>

            {paymentChoice === 'UPI' && (
              <div className="flex gap-2 pt-1 overflow-x-auto no-scrollbar">
                {['PhonePe', 'GPay', 'Paytm', 'Other UPI'].map((app) => (
                  <button
                    key={app}
                    type="button"
                    onClick={() => setSelectedUpiApp(app)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-black border transition ${
                      selectedUpiApp === app
                        ? isOrange
                          ? 'bg-[#8A4228] text-[#FFFCF7] border-[#8A4228]'
                          : 'bg-amber-400/20 border-amber-400 text-amber-300'
                        : isOrange
                        ? 'bg-[#F3DFCC] border-[#E8D5C3] text-[#5B5049]'
                        : 'bg-[#082218] border-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {app}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Settlement / Awaiting Confirmation Card */}
          <div
            className={`border rounded-2xl p-4 text-center transition shadow-sm ${
              isSettled
                ? isOrange
                  ? 'bg-[#F3DFCC] border-[#198754]'
                  : 'bg-[#09291f] border-emerald-400'
                : isOrange
                ? 'bg-[#FFFCF7] border-[#E8D5C3]'
                : 'bg-[#072017] border-emerald-500/20'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center mb-2 ${
                isOrange ? 'bg-[#198754]/10 text-[#198754]' : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              <CheckCircle className="w-6 h-6" />
            </div>
            <h4 className={`font-black text-sm ${isOrange ? 'text-[#5B5049]' : 'text-white'}`}>
              {isSettled ? 'Payment Received & Settled' : 'Awaiting Waiter Confirmation'}
            </h4>
            <p className={`text-xs mt-0.5 ${isOrange ? 'text-[#5B5049]/80' : 'text-emerald-300/80'}`}>
              {isSettled
                ? `Paid via ${paymentChoice} • ₹${totalAmountToBePaid.toFixed(2)}`
                : `${waiterName} is attending Seat ${seatId} with the bill.`}
            </p>
          </div>

          {/* Star Rating Section */}
          <div
            className={`border rounded-2xl p-3.5 flex flex-col items-center ${
              isOrange ? 'bg-[#F3DFCC] border-[#E8D5C3]' : 'bg-[#082218] border-emerald-500/25'
            }`}
          >
            <span className={`text-xs font-black mb-2 ${isOrange ? 'text-[#8A4228]' : 'text-emerald-200'}`}>
              Rate Your Dining Experience
            </span>
            <div className="flex gap-2.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`p-1 hover:scale-125 transition ${
                    isOrange ? 'text-[#D08A52]' : 'text-amber-400'
                  }`}
                >
                  <Star
                    className={`w-6 h-6 ${
                      star <= rating
                        ? isOrange
                          ? 'fill-[#8A4228] text-[#8A4228]'
                          : 'fill-amber-400 text-amber-400'
                        : isOrange
                        ? 'text-[#5B5049]/30'
                        : 'text-emerald-800'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Button: View Tax Invoice Bill */}
      <div className="pt-4">
        <Link
          href={`/seat/${seatId}/bill`}
          className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl transition active:scale-98 ${
            isOrange
              ? 'bg-[#8A4228] hover:bg-[#71351F] text-[#FFFCF7]'
              : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 border border-white/20'
          }`}
        >
          <span>View Tax Invoice</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </Link>
      </div>
    </div>
  );
}
