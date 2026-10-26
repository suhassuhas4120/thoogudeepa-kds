'use client';

import React from 'react';
import Link from 'next/link';
import { Ban, QrCode, ArrowRight, ShieldAlert, UtensilsCrossed } from 'lucide-react';
import { useCustomerTheme } from '@/lib/useCustomerTheme';
import { ThemeToggle } from '@/components/ThemeToggle';

interface SeatLockScreenProps {
  type: 'OCCUPIED' | 'ACTIVE_ELSEWHERE';
  seatNumber?: number;
  activeSeatNumber?: number;
  activeSeatId?: number;
  message?: string;
  onRefresh?: () => void;
}

export default function SeatLockScreen({
  type,
  seatNumber,
  activeSeatNumber,
  activeSeatId,
  message,
  onRefresh,
}: SeatLockScreenProps) {
  const { theme, toggleTheme } = useCustomerTheme();
  const isOrange = theme === 'burnt-orange';

  if (type === 'ACTIVE_ELSEWHERE') {
    return (
      <div
        className={`min-h-screen flex flex-col justify-between p-6 max-w-md mx-auto relative overflow-hidden font-sans select-none transition-colors duration-300 ${
          isOrange
            ? 'bg-[#FFFCF7] text-[#5B5049]'
            : 'bg-gradient-to-b from-[#051811] via-[#092219] to-[#04120d] text-white'
        }`}
      >
        {/* Glow Accents */}
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="w-full flex items-center justify-between pt-2 mb-4 z-10">
          <div className="flex items-center gap-2">
            <ShieldAlert className={`w-5 h-5 ${isOrange ? 'text-[#8A4228]' : 'text-amber-400'}`} />
            <span className="text-xs font-black tracking-widest uppercase opacity-80">
              Active Dining Session
            </span>
          </div>
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        </div>

        {/* Central Content */}
        <div className="flex-1 flex flex-col items-center justify-center text-center z-10 px-2 my-auto">
          {/* Animated Icon Badge */}
          <div
            className={`w-28 h-28 rounded-3xl p-5 mb-6 flex items-center justify-center shadow-2xl border-2 transition-all duration-300 ${
              isOrange
                ? 'bg-[#F3DFCC] border-[#8A4228]/40 shadow-[#8A4228]/20 text-[#8A4228]'
                : 'bg-[#0b2b20] border-amber-400/40 shadow-black/50 text-amber-400'
            }`}
          >
            <UtensilsCrossed className="w-14 h-14 animate-pulse" />
          </div>

          {/* Seat Badge */}
          <div
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-4 shadow-sm ${
              isOrange
                ? 'bg-[#F3DFCC]/80 border-[#D08A52]/40 text-[#8A4228]'
                : 'bg-[#0d3326] border-amber-400/30 text-amber-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span className="text-xs font-black tracking-wider uppercase">
              Seat {activeSeatNumber || activeSeatId || '?'} Active
            </span>
          </div>

          {/* Main Headline */}
          <h1
            className={`text-2xl sm:text-3xl font-black tracking-tight mb-2 ${
              isOrange ? 'text-[#8A4228]' : 'text-white'
            }`}
          >
            Active Order in Progress
          </h1>
          <p
            className={`text-xs font-bold tracking-wide mb-5 opacity-80 ${
              isOrange ? 'text-[#5B5049]' : 'text-emerald-300'
            }`}
          >
            ಸಕ್ರಿಯ ಆರ್ಡರ್ ಪ್ರಕ್ರಿಯೆಯಲ್ಲಿದೆ
          </p>

          {/* Detailed Explanation */}
          <div
            className={`w-full rounded-2xl p-4 mb-6 border text-left text-xs leading-relaxed shadow-sm ${
              isOrange
                ? 'bg-[#F9F3EA] border-[#E8D5C3] text-[#5B5049]'
                : 'bg-[#071f16]/90 border-emerald-500/20 text-emerald-100'
            }`}
          >
            <p className="font-semibold mb-2">
              Your device already has an active order session at{' '}
              <strong className={isOrange ? 'text-[#8A4228]' : 'text-amber-400'}>
                Seat {activeSeatNumber || activeSeatId}
              </strong>
              .
            </p>
            <p className="opacity-80">
              To prevent accidental mix-ups and protect your bill, you cannot scan or order at another seat until your current bill is settled.
            </p>
          </div>
        </div>

        {/* Action Button: Return to Active Seat ONLY */}
        <div className="w-full pb-6 z-10">
          <Link
            href={`/seat/${activeSeatId || activeSeatNumber || 1}/tracking`}
            className={`w-full py-4 rounded-2xl active:scale-95 font-black text-sm tracking-wider transition shadow-xl flex items-center justify-center gap-2 select-none ${
              isOrange
                ? 'bg-[#8A4228] hover:bg-[#71351F] text-[#FFFCF7] shadow-[#8A4228]/25'
                : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-amber-500/20'
            }`}
          >
            <span>Return to Seat {activeSeatNumber || activeSeatId}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // OCCUPIED Screen: Strict User Requirement - No option to select other seat!
  return (
    <div
      className={`min-h-screen flex flex-col justify-between p-6 max-w-md mx-auto relative overflow-hidden font-sans select-none transition-colors duration-300 ${
        isOrange
          ? 'bg-[#FFFCF7] text-[#5B5049]'
          : 'bg-gradient-to-b from-[#051811] via-[#092219] to-[#04120d] text-white'
      }`}
    >
      {/* Ambient background glows */}
      <div className="absolute -top-20 -left-20 w-80 h-80 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-24 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <div className="w-full flex items-center justify-between pt-2 mb-4 z-10">
        <div className="flex items-center gap-2">
          <Ban className="w-5 h-5 text-red-500" />
          <span className="text-xs font-black tracking-widest uppercase opacity-80">
            Table Restricted
          </span>
        </div>
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center z-10 px-2 my-auto">
        {/* Warning Icon Graphic */}
        <div
          className={`w-28 h-28 rounded-3xl p-5 mb-6 flex items-center justify-center shadow-2xl border-2 transition-all duration-300 ${
            isOrange
              ? 'bg-[#FEECEB] border-red-300 shadow-red-900/10 text-red-600'
              : 'bg-red-950/40 border-red-500/40 shadow-black/60 text-red-400'
          }`}
        >
          <Ban className="w-14 h-14" />
        </div>

        {/* Seat Badge */}
        {seatNumber && (
          <div
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-4 shadow-sm ${
              isOrange
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-red-950/60 border-red-500/30 text-red-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs font-black tracking-wider uppercase">
              Seat {seatNumber < 10 ? `0${seatNumber}` : seatNumber} • Occupied
            </span>
          </div>
        )}

        {/* Main Headline */}
        <h1
          className={`text-2xl sm:text-3xl font-black tracking-tight mb-2 ${
            isOrange ? 'text-red-700' : 'text-red-400'
          }`}
        >
          Sorry, this seat is occupied
        </h1>
        <p
          className={`text-xs font-bold tracking-wide mb-6 opacity-85 ${
            isOrange ? 'text-[#5B5049]' : 'text-emerald-300'
          }`}
        >
          ಕ್ಷಮಿಸಿ, ಈ ಸೀಟ್ ಈಗಾಗಲೇ ಆಕ್ಯುಪೈ ಆಗಿದೆ
        </p>

        {/* Strict Physical QR Code Instruction - NO manual seat picker */}
        <div
          className={`w-full rounded-2xl p-5 mb-4 border text-left space-y-3 shadow-md ${
            isOrange
              ? 'bg-[#F9F3EA] border-[#E8D5C3] text-[#5B5049]'
              : 'bg-[#071f16]/90 border-emerald-500/20 text-emerald-100'
          }`}
        >
          <div className="flex items-start gap-3">
            <QrCode className={`w-6 h-6 mt-0.5 shrink-0 ${isOrange ? 'text-[#8A4228]' : 'text-amber-400'}`} />
            <div>
              <p className="text-xs font-black uppercase tracking-wider mb-1">
                Physical QR Scan Required
              </p>
              <p className="text-[11px] leading-relaxed opacity-85">
                This table currently has an active order or dining session locked to another device.
              </p>
            </div>
          </div>

          <div
            className={`pt-3 border-t text-[11px] leading-relaxed ${
              isOrange ? 'border-[#E8D5C3] text-[#5B5049]' : 'border-emerald-500/10 text-emerald-200'
            }`}
          >
            Please look for a <strong>vacant seat</strong> and scan the physical QR stand on that table with your phone camera.
          </div>
        </div>

        <p className="text-[10px] font-bold tracking-wider uppercase opacity-60 mt-2">
          Manual seat switching is disabled for security
        </p>
      </div>

      {/* Bottom Button: Refresh Status Only (No Seat Selection) */}
      <div className="w-full pb-6 z-10">
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            className={`w-full py-3.5 rounded-2xl font-black text-xs tracking-wider transition shadow-md border ${
              isOrange
                ? 'bg-[#F3DFCC] hover:bg-[#E8D5C3] text-[#8A4228] border-[#8A4228]/30'
                : 'bg-[#0a281e] hover:bg-[#0d3326] text-amber-300 border-amber-400/30'
            }`}
          >
            Check if Table is Vacated
          </button>
        ) : (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={`w-full py-3.5 rounded-2xl font-black text-xs tracking-wider transition shadow-md border ${
              isOrange
                ? 'bg-[#F3DFCC] hover:bg-[#E8D5C3] text-[#8A4228] border-[#8A4228]/30'
                : 'bg-[#0a281e] hover:bg-[#0d3326] text-amber-300 border-amber-400/30'
            }`}
          >
            Check if Table is Vacated
          </button>
        )}
      </div>
    </div>
  );
}
