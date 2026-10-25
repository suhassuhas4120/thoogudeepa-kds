'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { useCustomerTheme } from '@/lib/useCustomerTheme';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function CustomerScreen1({ params }: { params: { seatId: string } }) {
  const router = useRouter();
  const seatId = parseInt(params.seatId, 10);
  const { theme, toggleTheme } = useCustomerTheme();
  const isOrange = theme === 'burnt-orange';

  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/seats/${seatId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.activeSession) {
          const session = data.data.activeSession;
          if (session.customerName && session.customerName !== '-') {
            setCustomerName(session.customerName);
          }
          if (session.orderTickets && session.orderTickets.length > 0) {
            router.push(`/seat/${seatId}/tracking`);
          }
        }
      })
      .catch(console.error);
  }, [seatId, router]);

  const handleEnterMenu = async () => {
    setLoading(true);
    try {
      await fetch(`/api/seats/${seatId}/init-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName }),
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem(`customer_name_seat_${seatId}`, customerName.trim() || '-');
      }
      router.push(`/seat/${seatId}/menu`);
    } catch (err) {
      console.error(err);
      router.push(`/seat/${seatId}/menu`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between p-5 max-w-md mx-auto relative overflow-hidden font-sans select-none transition-colors duration-300 ${
        isOrange
          ? 'bg-[#FFFCF7] text-[#5B5049]'
          : 'bg-gradient-to-b from-[#051811] via-[#092219] to-[#04120d] text-white'
      }`}
    >
      {/* Ambient background glows */}
      {isOrange ? (
        <>
          <div className="absolute -top-20 -left-20 w-80 h-80 bg-[#D08A52]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 -right-24 w-80 h-80 bg-[#8A4228]/10 rounded-full blur-3xl pointer-events-none" />
        </>
      ) : (
        <>
          <div className="absolute -top-20 -left-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 -right-24 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      {/* Main Content Flow */}
      <div className="z-10 flex flex-col items-center w-full">
        {/* Top Header with Theme Switcher */}
        <div className="w-full flex items-center justify-end pt-1 mb-2">
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        </div>

        {/* Brand Name (Larger & More Prominent) */}
        <div className="text-center mb-5">
          <h1
            className={`text-3xl sm:text-4xl font-black tracking-widest uppercase drop-shadow-sm ${
              isOrange ? 'text-[#8A4228]' : 'text-amber-400'
            }`}
          >
            THOOGUDEEPA
          </h1>
          <p
            className={`text-xs sm:text-sm font-extrabold tracking-[0.22em] uppercase mt-1 ${
              isOrange ? 'text-[#D08A52]' : 'text-emerald-200'
            }`}
          >
            DONNE BIRYANI MANE
          </p>
          <p
            className={`text-xs font-semibold tracking-wider mt-1 opacity-80 ${
              isOrange ? 'text-[#5B5049]' : 'text-emerald-400'
            }`}
          >
            ತೂಗುದೀಪ ದೊನ್ನೆ ಬಿರಿಯಾನಿ ಮನೆ
          </p>
        </div>

        {/* Official Restaurant Logo (Larger, Elevated & Higher Up) */}
        <div className="relative mb-5">
          <div
            className={`w-44 h-44 sm:w-48 sm:h-48 rounded-full border-[3px] p-2 shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-300 ${
              isOrange
                ? 'border-[#8A4228] bg-[#F3DFCC] shadow-[#8A4228]/25'
                : 'border-amber-400/60 bg-[#072017] shadow-emerald-950/90'
            }`}
          >
            <img
              src="/logo.jpg"
              alt="Thoogudeepa Donne Biryani Mane"
              className="w-full h-full object-cover rounded-full"
              onError={(e) => {
                const target = e.target as HTMLElement;
                target.style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* Dynamic Seat Badge */}
        <div
          className={`inline-flex items-center gap-2.5 px-6 py-2 rounded-full border shadow-md mb-4 transition-all duration-300 ${
            isOrange
              ? 'bg-[#F3DFCC] border-[#D08A52]/40 text-[#8A4228]'
              : 'bg-[#0b2b20] border-amber-400/30 text-amber-300 shadow-black/40'
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full animate-pulse ${
              isOrange ? 'bg-[#198754]' : 'bg-emerald-400'
            }`}
          />
          <span className="text-sm font-black tracking-widest">
            SEAT {String(seatId).padStart(2, '0')}
          </span>
        </div>

        {/* Welcome Headline */}
        <div
          className={`w-full border rounded-2xl py-2.5 px-5 text-center mb-3 shadow-sm transition-all duration-300 ${
            isOrange
              ? 'bg-[#FFFCF7] border-[#E8D5C3] shadow-[#8A4228]/5'
              : 'bg-[#0a281e]/90 border-emerald-500/20 shadow-xl'
          }`}
        >
          <h2
            className={`text-base font-extrabold tracking-wide ${
              isOrange ? 'text-[#8A4228]' : 'text-slate-100'
            }`}
          >
            Namaskara • Welcome
          </h2>
        </div>

        {/* Customer Name Input (Clean, Centered) */}
        <div className="w-full">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Enter your name"
            className={`w-full rounded-2xl py-3.5 px-4 text-center text-sm font-bold shadow-inner transition focus:outline-none ${
              isOrange
                ? 'bg-[#FFFCF7] border border-[#E8D5C3] text-[#5B5049] placeholder-[#5B5049]/50 focus:border-[#8A4228] focus:ring-2 focus:ring-[#8A4228]/20'
                : 'bg-[#061c14] border border-amber-400/30 text-white placeholder-emerald-700/60 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20'
            }`}
          />
        </div>
      </div>

      {/* Bottom Primary Button */}
      <div className="pb-6 z-10">
        <button
          type="button"
          onClick={handleEnterMenu}
          disabled={loading}
          className={`w-full py-4 rounded-2xl active:scale-95 font-black text-base tracking-wider transition shadow-xl flex items-center justify-center gap-2 select-none ${
            isOrange
              ? 'bg-[#8A4228] hover:bg-[#71351F] text-[#FFFCF7] shadow-[#8A4228]/25'
              : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-amber-500/20'
          }`}
        >
          <span>{loading ? 'Opening Menu...' : 'Explore Menu'}</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
