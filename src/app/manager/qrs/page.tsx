'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Printer,
  ExternalLink,
  QrCode,
  Download,
  Sparkles
} from 'lucide-react';
import ManagerTopNav from '@/components/ManagerTopNav';

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
    <div className="min-h-screen bg-[#FBF9F6] text-stone-900 flex flex-col font-sans select-none p-3">
      <div className="border border-[#8A4228] rounded-2xl bg-[#FBF9F6] min-h-[calc(100vh-1.5rem)] flex flex-col overflow-hidden">
      {/* Executive Unified Navigation Bar - Hidden on Print */}
      <div className="print:hidden">
        <ManagerTopNav
          activeTab="qrs"
          extraRightActions={
            <button
              onClick={handlePrintAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8A4228] hover:bg-[#71351F] text-white text-xs font-black rounded-xl shadow-md transition active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print All Stands</span>
            </button>
          }
        />
      </div>

      {/* Subheader Instructions - Hidden on Print */}
      <div className="h-12 bg-[#181513] border-b border-stone-200 px-6 flex items-center justify-between text-xs text-stone-400 print:hidden">
        <div>
          <span>High-Resolution Acrylic QR Stands for Seats 1 to 16.</span>
          <span className="text-[#D08A52] font-bold ml-2">
            Tip: Press Ctrl+P or click &apos;Print&apos; to export as PDF or print acrylic inserts.
          </span>
        </div>
        <div className="font-mono text-[#D08A52]">
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
                className="bg-[#181513] rounded-3xl border border-stone-200 p-5 flex flex-col items-center justify-between text-center relative overflow-hidden shadow-xl print:border-2 print:border-black print:bg-white print:text-black print:page-break-after-always print:rounded-2xl print:my-4"
              >
                {/* Gold/Copper Top Accent Line */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#8A4228] via-[#D08A52] to-[#8A4228] print:hidden" />

                <div className="w-full">
                  <div className="text-[11px] font-black uppercase tracking-widest text-[#D08A52] print:text-black">
                    THOOGUDEEPA
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-stone-300 print:text-black">
                    DONNE BIRYANI MANE
                  </h2>

                  {/* Seat Badge */}
                  <div className="my-4 py-2 px-6 rounded-2xl bg-[#8A4228]/15 border border-[#8A4228]/30 inline-block print:bg-gray-100 print:border-black">
                    <span className="text-2xl font-black text-[#D08A52] print:text-black tracking-tight">
                      SEAT {seat.seatNumber < 10 ? `0${seat.seatNumber}` : seat.seatNumber}
                    </span>
                    <div className="text-[10px] font-bold text-stone-400 print:text-gray-700">
                      {seat.zone} • {seat.assignedWaiter}
                    </div>
                  </div>
                </div>

                {/* QR Code Container */}
                <div className="p-3 bg-white rounded-2xl shadow-inner border border-stone-700 my-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrApiUrl}
                    alt={`Seat ${seat.seatNumber} QR Code`}
                    className="w-40 h-40 object-contain"
                  />
                </div>

                <div className="w-full mt-3">
                  <p className="text-xs font-bold text-white print:text-black">
                    Scan to Order & Pay
                  </p>
                  <p className="text-[10px] text-stone-400 print:text-gray-600">
                    UPI • Cash • Live Item Tracking
                  </p>
                </div>

                {/* Bottom Actions - Hidden on Print */}
                <div className="w-full mt-4 pt-3 border-t border-stone-200 flex items-center justify-between gap-2 print:hidden">
                  <button
                    onClick={() => handlePrintSingle(seat.id)}
                    className="flex-1 py-1.5 px-2 bg-stone-50 hover:bg-[#2C2520] border border-stone-200 text-stone-300 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Stand</span>
                  </button>

                  <a
                    href={`/seat/${seat.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-[#8A4228]/20 text-[#D08A52] hover:bg-[#8A4228]/30 rounded-xl text-xs font-bold transition border border-[#8A4228]/30"
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
    </div>
  );
}
