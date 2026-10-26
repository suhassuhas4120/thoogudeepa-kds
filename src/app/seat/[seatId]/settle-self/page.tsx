'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Star, ArrowRight, CheckCircle2, QrCode } from 'lucide-react';
import { useSocketRoom } from '@/lib/useSocket';
import { playSuccessChime } from '@/lib/audio-synth';
import confetti from 'canvas-confetti';
import { useCustomerTheme } from '@/lib/useCustomerTheme';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function CustomerScreen6({ params }: { params: { seatId: string } }) {
  const router = useRouter();
  const seatId = parseInt(params.seatId, 10);
  const socket = useSocketRoom(`room:seat:${seatId}`);
  const { theme, toggleTheme } = useCustomerTheme();
  const isOrange = theme === 'burnt-orange';

  const [customerName, setCustomerName] = useState('-');
  const [grandTotalDue, setGrandTotalDue] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [rating, setRating] = useState(5);
  const [isConfirmed, setIsConfirmed] = useState(false);

  useEffect(() => {
    fetch(`/api/seats/${seatId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.activeSession) {
          const sess = data.data.activeSession;
          setCustomerName(sess.customerName || '-');
          setGrandTotalDue(sess.grandTotal || 0);
          setDiscountAmount(sess.discountAmount || 0);
        }
      });
  }, [seatId]);

  useEffect(() => {
    if (!socket) return;
    const handleVacate = () => {
      setIsConfirmed(true);
      playSuccessChime();
      try {
        confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
      } catch (e) {}
      setTimeout(() => {
        router.push(`/seat/${seatId}/bill`);
      }, 1000);
    };

    socket.on('seat:vacated', handleVacate);
    socket.on('payment:completed', handleVacate);
    return () => {
      socket.off('seat:vacated', handleVacate);
      socket.off('payment:completed', handleVacate);
    };
  }, [socket, seatId, router]);

  const handleSimulateSelfPay = async () => {
    if (finalAmount <= 0) return;
    try {
      await fetch('/api/billing/settle-vacate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seatId,
          paymentMode: 'UPI',
          settledBy: 'Self Pay (Direct UPI)',
        }),
      });
      setIsConfirmed(true);
      playSuccessChime();
      try {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } catch (e) {}
      setTimeout(() => {
        router.push(`/seat/${seatId}/bill`);
      }, 1000);
    } catch (e) {
      console.error(e);
    }
  };

  const finalAmount = grandTotalDue;
  const upiIntentUri = `upi://pay?pa=thoogudeepabiryani@upi&pn=Thoogudeepa+Donne+Biryani&am=${finalAmount.toFixed(
    2
  )}&cu=INR`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    upiIntentUri
  )}`;

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
                Direct UPI Checkout
              </p>
            </div>
          </div>

          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        </header>

        {/* Content */}
        <div className="pt-4 space-y-4">
          <div>
            <span
              className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1 ${
                isOrange ? 'text-[#D08A52]' : 'text-amber-400'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Instant UPI Payment</span>
            </span>
            <h2 className={`text-2xl font-black mt-0.5 ${isOrange ? 'text-[#5B5049]' : 'text-white'}`}>
              Total to Pay: <span className={isOrange ? 'text-[#8A4228]' : 'text-amber-400'}>₹{finalAmount.toFixed(2)}</span>
            </h2>
          </div>

          {/* Dynamic UPI QR Code Box */}
          <div
            className={`border rounded-3xl p-5 flex flex-col items-center shadow-lg relative transition ${
              isOrange
                ? 'bg-[#F3DFCC] border-[#E8D5C3]'
                : 'bg-gradient-to-b from-[#0b291f] to-[#072017] border-amber-400/30 text-white'
            }`}
          >
            <div
              onClick={handleSimulateSelfPay}
              title="Click or scan QR to complete payment"
              className={`w-48 h-48 bg-white rounded-2xl p-2.5 flex flex-col items-center justify-center cursor-pointer shadow-md hover:scale-105 transition border-2 ${
                isOrange ? 'border-[#8A4228]' : 'border-amber-400'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl}
                alt="Dynamic UPI QR Code"
                className="w-40 h-40 object-contain"
              />
            </div>

            <span className={`text-sm font-black mt-3 ${isOrange ? 'text-[#8A4228]' : 'text-amber-300'}`}>
              Scan with GPay / PhonePe / Paytm
            </span>
            <span className={`text-[10px] mt-0.5 font-medium ${isOrange ? 'text-[#5B5049]/70' : 'text-emerald-300/80'}`}>
              Auto-verifies upon payment receipt
            </span>
          </div>

          {/* UPI App Quick Intent */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`h-px flex-1 ${isOrange ? 'bg-[#E8D5C3]' : 'bg-emerald-500/20'}`} />
              <span
                className={`text-[10px] font-black uppercase tracking-wider ${
                  isOrange ? 'text-[#5B5049]/70' : 'text-emerald-300/80'
                }`}
              >
                Or Pay Directly with App
              </span>
              <div className={`h-px flex-1 ${isOrange ? 'bg-[#E8D5C3]' : 'bg-emerald-500/20'}`} />
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {['GPay', 'PhonePe', 'Paytm'].map((app) => (
                <button
                  key={app}
                  type="button"
                  onClick={handleSimulateSelfPay}
                  className={`py-3 rounded-xl border text-xs font-black flex items-center justify-center transition active:scale-95 ${
                    isOrange
                      ? 'bg-[#FFFCF7] border-[#E8D5C3] text-[#5B5049] hover:border-[#8A4228] hover:text-[#8A4228]'
                      : 'bg-[#082218] border-emerald-500/20 text-white hover:text-amber-300 hover:border-amber-400'
                  }`}
                >
                  {app}
                </button>
              ))}
            </div>
          </div>

          {/* Status Box */}
          <div
            className={`border rounded-2xl p-4 text-center transition shadow-sm ${
              isConfirmed
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
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className={`font-black text-sm ${isOrange ? 'text-[#5B5049]' : 'text-white'}`}>
              {isConfirmed ? 'Payment Successful' : 'Waiting for Payment'}
            </h4>
            <p className={`text-xs mt-0.5 ${isOrange ? 'text-[#5B5049]/80' : 'text-emerald-300/80'}`}>
              {isConfirmed
                ? `UPI Transfer Received • ₹${finalAmount.toFixed(2)}`
                : 'Complete the payment on your UPI app to receive bill.'}
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

      {/* Bottom Button */}
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
