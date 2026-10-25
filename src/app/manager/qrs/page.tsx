'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Printer,
  ExternalLink,
  QrCode,
  Download,
  LogOut,
  Sparkles
} from 'lucide-react';

interface SeatItem {
  id: number;
  seatNumber: number;
  zone: string;
  assignedWaiter: string;
}

export default function ManagerQRStandsScreen() {
  const [origin, setOrigin] = useState('');
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const seats: SeatItem[] = Array.from({ length: 16 }, (_, i) => {
    const seatNum = i + 1;
    return {
      id: seatNum,
      seatNumber: seatNum,
      zone: seatNum <= 8 ? 'ZONE A' : 'ZONE B',
      assignedWaiter: seatNum <= 8 ? 'Suhas (Mobile)' : 'Shiva (Tablet)',
    };
  });

  const handlePrintAll = () => {
    window.print();
  };

  const handlePrintSingle = (seatNum: number) => {
    setSelectedSeat(seatNum);
    setTimeout(() => {
      window.print();
      setSelectedSeat(null);
    }, 150);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none">
      {/* Executive Header - Hidden on Print */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white uppercase tracking-wider">
              THOOGUDEEPA DONNE BIRYANI
            </h1>
            <p className="text-[11px] text-purple-400 font-medium">16-Seat QR Code Stand Engine</p>
          </div>
        </div>

        {/* 9 Manager Portal Navigation Links */}
        <nav className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold">
          <Link href="/manager/floor" className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white">
            Live Floor
          </Link>
          <Link href="/manager/kitchen" className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white">
            Kitchen Oversight
          </Link>
          <Link href="/manager/menu" className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white">
            Menu Items
          </Link>
          <Link href="/manager/qrs" className="px-3 py-1.5 rounded-xl bg-purple-500 text-white shadow-sm">
            QR Stands
          </Link>
          <Link href="/manager/shift" className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white">
            Shift Audit
          </Link>
          <Link href="/manager/parcel" className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white">
            Parcel Desk
          </Link>
          <Link href="/manager/reports" className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white">
            Reports
          </Link>
          <Link href="/manager/promos" className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white">
            Offers & Promos
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrintAll}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-black rounded-xl shadow-md transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print All 16 Stands</span>
          </button>
          <Link
            href="/manager"
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition"
            title="Lock Portal"
          >
            <LogOut className="w-5 h-5" />
          </Link>
        </div>
      </header>

      {/* Subheader Instructions - Hidden on Print */}
      <div className="h-12 bg-slate-900/40 border-b border-slate-800 px-6 flex items-center justify-between text-xs text-slate-400 print:hidden">
        <div>
          <span>High-Resolution Acrylic QR Stands for Seats 1 to 16.</span>
          <span className="text-amber-400 font-bold ml-2">
            Tip: Press Ctrl+P or click &apos;Print&apos; to export as PDF or print acrylic inserts.
          </span>
        </div>
        <div className="font-mono text-purple-400">
          Domain: {origin || 'http://localhost:3000'}
        </div>
      </div>

      {/* Stands Grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-2 print:gap-8 print:p-0">
          {seats.map((seat) => {
            const seatUrl = `${origin || 'http://localhost:3000'}/seat/${seat.id}`;
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
              seatUrl
            )}`;

            // When single printing, hide other seats
            if (selectedSeat !== null && selectedSeat !== seat.id) {
              return null;
            }

            return (
              <div
                key={seat.id}
                className="bg-slate-900 rounded-3xl border border-slate-800 p-5 flex flex-col items-center justify-between text-center relative overflow-hidden shadow-xl print:border-2 print:border-black print:bg-white print:text-black print:page-break-after-always print:rounded-2xl print:my-4"
              >
                {/* Gold Top Accent Line */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500 print:hidden" />

                <div className="w-full">
                  <div className="text-[11px] font-black uppercase tracking-widest text-amber-400 print:text-black">
                    THOOGUDEEPA
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-300 print:text-black">
                    DONNE BIRYANI MANE
                  </h2>

                  {/* Seat Badge */}
                  <div className="my-4 py-2 px-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 inline-block print:bg-gray-100 print:border-black">
                    <span className="text-2xl font-black text-amber-400 print:text-black tracking-tight">
                      SEAT {seat.seatNumber < 10 ? `0${seat.seatNumber}` : seat.seatNumber}
                    </span>
                    <div className="text-[10px] font-bold text-slate-400 print:text-gray-700">
                      {seat.zone} • {seat.assignedWaiter}
                    </div>
                  </div>
                </div>

                {/* QR Code Container */}
                <div className="p-3 bg-white rounded-2xl shadow-inner border border-slate-700 my-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrApiUrl}
                    alt={`Seat ${seat.seatNumber} QR Code`}
                    className="w-40 h-40 object-contain"
                  />
                </div>

                <div className="w-full mt-3">
                  <p className="text-xs font-bold text-slate-200 print:text-black">
                    Scan to Order & Pay
                  </p>
                  <p className="text-[10px] text-slate-400 print:text-gray-600">
                    UPI • Cash • Live Item Tracking
                  </p>
                </div>

                {/* Bottom Actions - Hidden on Print */}
                <div className="w-full mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2 print:hidden">
                  <button
                    onClick={() => handlePrintSingle(seat.id)}
                    className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Stand</span>
                  </button>

                  <a
                    href={`/seat/${seat.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-xl text-xs font-bold transition"
                    title="Open Seat Portal"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
