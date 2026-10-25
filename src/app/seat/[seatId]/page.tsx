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
      className={`min-h-screen flex flex-col justify-between p-6 max-w-md mx-auto relative overflow-hidden font-sans select-none transition-colors duration-300 ${
        isOrange
          ? 'bg-[#FFFCF7] text-[#5B5049]'
          : 'bg-gradient-to-b from-[#051811] via-[#092219] to-[#04120d] text-white'
      }`}
    >
      {/* Ambient background glows */}
      {isOrange ? (
        <>
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-[#D08A52]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 -right-24 w-72 h-72 bg-[#8A4228]/5 rounded-full blur-3xl pointer-events-none" />
        </>
      ) : (
        <>
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 -right-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      {/* Top Header & Theme Switcher */}
      <div className="pt-2 z-10 flex flex-col items-center">
        <div className="w-full flex items-center justify-between mb-4">
          <span
            className={`px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase border shadow-sm ${
              isOrange
                ? 'bg-[#F3DFCC] border-[#D08A52]/40 text-[#8A4228]'
                : 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300'
            }`}
          >
            Karnataka Military Style
          </span>
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        </div>

        <div className="text-center">
          <h1
            className={`text-2xl font-black tracking-wider uppercase drop-shadow-sm ${
              isOrange ? 'text-[#8A4228]' : 'text-amber-400'
            }`}
          >
            THOOGUDEEPA
          </h1>
          <p
            className={`text-xs font-bold tracking-widest uppercase mt-0.5 ${
              isOrange ? 'text-[#D08A52]' : 'text-emerald-200'
            }`}
          >
            DONNE BIRYANI MANE
          </p>
          <p
            className={`text-[11px] font-medium tracking-wide mt-1 ${
              isOrange ? 'text-[#5B5049]/80' : 'text-emerald-400/80'
            }`}
          >
            ತೂಗುದೀಪ ದೊನ್ನೆ ಬಿರಿಯಾನಿ ಮನೆ
          </p>
        </div>
      </div>

      {/* Center Branding with Authentic Logo */}
      <div className="flex flex-col items-center my-auto w-full z-10 py-4">
        {/* Official Restaurant Logo Badge */}
        <div className="relative mb-5">
          <div
            className={`w-32 h-32 rounded-full border-2 p-1.5 shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-300 ${
              isOrange
                ? 'border-[#8A4228] bg-[#F3DFCC] shadow-[#8A4228]/15'
                : 'border-amber-400/50 bg-[#072017] shadow-emerald-950/90'
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
          className={`inline-flex items-center gap-2.5 px-5 py-2 rounded-2xl border shadow-md mb-4 transition-all duration-300 ${
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
          <span className="text-sm font-black tracking-wide">
            SEAT {String(seatId).padStart(2, '0')}
          </span>
          <span
            className={`text-[11px] font-bold ${
              isOrange ? 'text-[#8A4228]/80' : 'text-emerald-400/80'
            }`}
          >
            • DINE-IN
          </span>
        </div>

        {/* Welcome Message Card */}
        <div
          className={`w-full border rounded-2xl py-3.5 px-5 text-center mb-4 shadow-sm transition-all duration-300 ${
            isOrange
              ? 'bg-[#FFFCF7] border-[#E8D5C3] shadow-[#8A4228]/5'
              : 'bg-[#0a281e]/90 border-emerald-500/20 shadow-xl'
          }`}
        >
          <h2
            className={`text-base font-extrabold block ${
              isOrange ? 'text-[#8A4228]' : 'text-slate-100'
            }`}
          >
            Namaskara • Welcome
          </h2>
          <p
            className={`text-xs font-medium mt-0.5 ${
              isOrange ? 'text-[#5B5049]/90' : 'text-emerald-300/80'
            }`}
          >
            Traditional Seeraga Samba Donne Biryani prepared fresh to order.
          </p>
        </div>

        {/* Customer Name Input */}
        <div className="w-full">
          <label
            className={`block text-[11px] font-bold uppercase tracking-wider text-center mb-1.5 ${
              isOrange ? 'text-[#8A4228]' : 'text-amber-400/90'
            }`}
          >
            Your Name (Optional)
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Enter your name"
            className={`w-full rounded-2xl py-3.5 px-4 text-center text-sm font-bold shadow-inner transition focus:outline-none ${
              isOrange
                ? 'bg-[#FFFCF7] border border-[#E8D5C3] text-[#5B5049] placeholder-[#5B5049]/50 focus:border-[#8A4228] focus:ring-1 focus:ring-[#8A4228]'
                : 'bg-[#061c14] border border-amber-400/30 text-white placeholder-emerald-700/60 focus:border-amber-400 focus:ring-1 focus:ring-amber-400'
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
