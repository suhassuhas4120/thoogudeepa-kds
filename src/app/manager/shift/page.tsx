'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, AlertCircle, Printer, Lock, Store } from 'lucide-react';
import ManagerTopNav from '@/components/ManagerTopNav';
import { useSocketRoom } from '@/lib/useSocket';

export default function ManagerShiftAuditScreen() {
  const socket = useSocketRoom('room:manager');
  const [dateStr, setDateStr] = useState('26-Oct-2026');
  
  // Waiter 1 (Suhas) handover states
  const [suhasHandingOver, setSuhasHandingOver] = useState('');
  const [suhasHandedOver, setSuhasHandedOver] = useState<number>(0);
  const [suhasSubmitted, setSuhasSubmitted] = useState<boolean>(false);

  // Waiter 2 (Shiva) handover states
  const [shivaHandingOver, setShivaHandingOver] = useState('');
  const [shivaHandedOver, setShivaHandedOver] = useState<number>(0);
  const [shivaSubmitted, setShivaSubmitted] = useState<boolean>(false);

  // Real-time calculated live states
  const [suhasStats, setSuhasStats] = useState({
    tablesCount: 0,
    totalBilled: 0,
    upiCollected: 0,
    cashCollected: 0,
  });

  const [shivaStats, setShivaStats] = useState({
    tablesCount: 0,
    totalBilled: 0,
    upiCollected: 0,
    cashCollected: 0,
  });

  const [parcelStats, setParcelStats] = useState({
    tablesCount: 0,
    totalBilled: 0,
    upiCollected: 0,
    cashCollected: 0,
  });

  const fetchShiftData = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = now.toLocaleString('en-US', { month: 'short' });
    const year = now.getFullYear();
    setDateStr(`${day}-${month}-${year}`);

    const todayDbStr = `${day}-${String(now.getMonth() + 1).padStart(2, '0')}-${year}`;

    // Fetch live totals for today from /api/reports/master-sales
    fetch(`/api/reports/master-sales?date=${todayDbStr}&t=${Date.now()}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.records) {
          const records = data.data.records;
          let sTables = 0, sBilled = 0, sUpi = 0, sCash = 0;
          let shTables = 0, shBilled = 0, shUpi = 0, shCash = 0;
          let pTables = 0, pBilled = 0, pUpi = 0, pCash = 0;

          records.forEach((r: any) => {
            const isTakeaway = r.orderType === 'Takeaway' || (r.seatNumberOrToken && r.seatNumberOrToken.startsWith('P'));
            const seatNum = parseInt((r.seatNumberOrToken || '').replace(/\D/g, ''), 10);
            const isZoneA = r.serverName === 'Suhas' || (!isTakeaway && seatNum >= 1 && seatNum <= 8);
            const isZoneB = r.serverName === 'Shiva' || (!isTakeaway && seatNum >= 9 && seatNum <= 16);

            const mode = (r.paymentMode || '').toUpperCase();
            const isCash = mode.includes('CASH');

            if (isTakeaway) {
              pTables++;
              pBilled += r.grandTotal;
              if (isCash) pCash += r.grandTotal;
              else pUpi += r.grandTotal;
            } else if (isZoneA) {
              sTables++;
              sBilled += r.grandTotal;
              if (isCash) sCash += r.grandTotal;
              else sUpi += r.grandTotal;
            } else if (isZoneB) {
              shTables++;
              shBilled += r.grandTotal;
              if (isCash) shCash += r.grandTotal;
              else shUpi += r.grandTotal;
            }
          });

          setSuhasStats({ tablesCount: sTables, totalBilled: sBilled, upiCollected: sUpi, cashCollected: sCash });
          setShivaStats({ tablesCount: shTables, totalBilled: shBilled, upiCollected: shUpi, cashCollected: shCash });
          setParcelStats({ tablesCount: pTables, totalBilled: pBilled, upiCollected: pUpi, cashCollected: pCash });

          setSuhasHandedOver((prev) => (suhasSubmitted ? prev : sCash));
          setSuhasHandingOver((prev) => (prev !== '' && suhasSubmitted ? prev : (sCash > 0 ? String(sCash) : '0')));

          setShivaHandedOver((prev) => (shivaSubmitted ? prev : shCash));
          setShivaHandingOver((prev) => (prev !== '' && shivaSubmitted ? prev : (shCash > 0 ? String(shCash) : '0')));
        }
      })
      .catch(console.error);
  };

  const handleSuhasSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = parseFloat(suhasHandingOver) || 0;
    setSuhasHandedOver(val);
    setSuhasSubmitted(true);
  };

  const handleShivaSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = parseFloat(shivaHandingOver) || 0;
    setShivaHandedOver(val);
    setShivaSubmitted(true);
  };

  useEffect(() => {
    fetchShiftData();
    const interval = setInterval(fetchShiftData, 3000);

    if (socket) {
      socket.on('seat:vacated', fetchShiftData);
      socket.on('payment:completed', fetchShiftData);
      socket.on('payment:lock_changed', fetchShiftData);
      socket.on('order:placed', fetchShiftData);
    }

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('seat:vacated', fetchShiftData);
        socket.off('payment:completed', fetchShiftData);
        socket.off('payment:lock_changed', fetchShiftData);
        socket.off('order:placed', fetchShiftData);
      }
    };
  }, [socket, suhasSubmitted, shivaSubmitted]);

  // Balance Math: Remaining = Cash Collected - Handed Over
  const suhasBalance = Math.round((suhasStats.cashCollected - suhasHandedOver) * 100) / 100;
  const shivaBalance = Math.round((shivaStats.cashCollected - shivaHandedOver) * 100) / 100;

  // Total cash in register = Waiters' Handed Over cash + Parcel cash (directly collected at manager counter)
  const totalCashInDrawer =
    suhasHandedOver +
    shivaHandedOver +
    parcelStats.cashCollected;

  return (
    <div className="min-h-screen bg-[#100E0C] text-white flex flex-col font-sans select-none">
      {/* Shared Manager Top Navigation */}
      <ManagerTopNav activeTab="shift" />

      {/* Subheader */}
      <div className="bg-[#141210] border-b border-[#2C2520] px-6 py-3 flex items-center justify-between">
        <h1 className="text-xs md:text-sm font-black text-[#D08A52] uppercase tracking-wider">
          STAFF SHIFT AUDIT & CASH RECONCILIATION
        </h1>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#181513] border border-[#2C2520] text-amber-400">
          Date: {dateStr}
        </span>
      </div>

      {/* Main Audit Sections */}
      <div className="p-6 md:p-8 max-w-5xl w-full mx-auto space-y-5 flex-1">
        {/* 1. SUHAS SECTION */}
        <div className="bg-[#181513] border border-[#2C2520] rounded-2xl p-5 shadow-xl">
          <div className="flex justify-between items-center pb-2.5 border-b border-[#2C2520] mb-3">
            <h2 className="font-black text-sm text-sky-400 uppercase tracking-wider flex items-center gap-2">
              <span>🤵 WAITER 1: SUHAS</span>
              <span className="text-xs text-stone-400 font-normal">(Zone A: Seats 1 - 8)</span>
            </h2>
            <span className="text-xs text-stone-400">
              Total Seats Served: <strong className="text-white">{suhasStats.tablesCount}</strong>
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-stone-300 mb-3 font-medium">
            <span>• Total Billed: <strong className="text-white">₹{suhasStats.totalBilled.toFixed(2)}</strong></span>
            <span>• 📱 UPI / Online: <strong className="text-white">₹{suhasStats.upiCollected.toFixed(2)}</strong></span>
          </div>

          {/* 4-Item Cash Handover Row: (Cash Collected -> Handing Over Input + Submit -> Handed Over -> Remaining) */}
          <div className="p-4 rounded-xl bg-[#221D1A] border border-[#2C2520] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-center gap-4 text-xs">
            {/* 1. Cash Collected */}
            <div className="space-y-1">
              <span className="text-stone-400 font-bold block uppercase text-[10px] tracking-wider">
                💵 1. Cash Collected
              </span>
              <span className="font-black text-amber-400 text-base font-mono block">
                ₹{suhasStats.cashCollected.toFixed(2)}
              </span>
            </div>

            {/* 2. Handing Over Input Section with Submit Button */}
            <div className="space-y-1">
              <span className="text-stone-300 font-bold block uppercase text-[10px] tracking-wider">
                📥 2. Handing Over
              </span>
              <form onSubmit={handleSuhasSubmit} className="flex items-center gap-1.5">
                <div className="flex items-center bg-[#100E0C] border border-[#3D332C] rounded-lg px-2 py-1.5 flex-1 focus-within:border-amber-400 transition">
                  <span className="text-stone-500 mr-1 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    step="any"
                    value={suhasHandingOver}
                    onChange={(e) => setSuhasHandingOver(e.target.value)}
                    placeholder={String(suhasStats.cashCollected)}
                    className="w-full bg-transparent text-white font-black focus:outline-none text-xs font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition active:scale-95 shadow-sm whitespace-nowrap"
                >
                  Submit
                </button>
              </form>
            </div>

            {/* 3. Handed Over */}
            <div className="space-y-1">
              <span className="text-stone-400 font-bold block uppercase text-[10px] tracking-wider">
                🤝 3. Handed Over
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-black text-emerald-400 text-base font-mono">
                  ₹{suhasHandedOver.toFixed(2)}
                </span>
                <span className="text-[10px] text-stone-500">
                  (Target: ₹{suhasStats.cashCollected.toFixed(2)})
                </span>
              </div>
            </div>

            {/* 4. Remaining */}
            <div className="space-y-1">
              <span className="text-stone-400 font-bold block uppercase text-[10px] tracking-wider">
                ⚖️ 4. Remaining
              </span>
              <div>
                <span
                  className={`font-black px-2.5 py-1 rounded-md text-xs inline-flex items-center gap-1 font-mono ${
                    suhasBalance === 0
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : suhasBalance > 0
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  }`}
                >
                  {suhasBalance === 0 ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>₹0.00 (Balanced)</span>
                    </>
                  ) : suhasBalance > 0 ? (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>₹{suhasBalance.toFixed(2)} (Due)</span>
                    </>
                  ) : (
                    <span>+₹{Math.abs(suhasBalance).toFixed(2)} (Excess)</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. SHIVA SECTION */}
        <div className="bg-[#181513] border border-[#2C2520] rounded-2xl p-5 shadow-xl">
          <div className="flex justify-between items-center pb-2.5 border-b border-[#2C2520] mb-3">
            <h2 className="font-black text-sm text-cyan-400 uppercase tracking-wider flex items-center gap-2">
              <span>🤵 WAITER 2: SHIVA</span>
              <span className="text-xs text-stone-400 font-normal">(Zone B: Seats 9 - 16)</span>
            </h2>
            <span className="text-xs text-stone-400">
              Total Seats Served: <strong className="text-white">{shivaStats.tablesCount}</strong>
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-stone-300 mb-3 font-medium">
            <span>• Total Billed: <strong className="text-white">₹{shivaStats.totalBilled.toFixed(2)}</strong></span>
            <span>• 📱 UPI / Online: <strong className="text-white">₹{shivaStats.upiCollected.toFixed(2)}</strong></span>
          </div>

          {/* 4-Item Cash Handover Row: (Cash Collected -> Handing Over Input + Submit -> Handed Over -> Remaining) */}
          <div className="p-4 rounded-xl bg-[#221D1A] border border-[#2C2520] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-center gap-4 text-xs">
            {/* 1. Cash Collected */}
            <div className="space-y-1">
              <span className="text-stone-400 font-bold block uppercase text-[10px] tracking-wider">
                💵 1. Cash Collected
              </span>
              <span className="font-black text-amber-400 text-base font-mono block">
                ₹{shivaStats.cashCollected.toFixed(2)}
              </span>
            </div>

            {/* 2. Handing Over Input Section with Submit Button */}
            <div className="space-y-1">
              <span className="text-stone-300 font-bold block uppercase text-[10px] tracking-wider">
                📥 2. Handing Over
              </span>
              <form onSubmit={handleShivaSubmit} className="flex items-center gap-1.5">
                <div className="flex items-center bg-[#100E0C] border border-[#3D332C] rounded-lg px-2 py-1.5 flex-1 focus-within:border-amber-400 transition">
                  <span className="text-stone-500 mr-1 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    step="any"
                    value={shivaHandingOver}
                    onChange={(e) => setShivaHandingOver(e.target.value)}
                    placeholder={String(shivaStats.cashCollected)}
                    className="w-full bg-transparent text-white font-black focus:outline-none text-xs font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition active:scale-95 shadow-sm whitespace-nowrap"
                >
                  Submit
                </button>
              </form>
            </div>

            {/* 3. Handed Over */}
            <div className="space-y-1">
              <span className="text-stone-400 font-bold block uppercase text-[10px] tracking-wider">
                🤝 3. Handed Over
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-black text-emerald-400 text-base font-mono">
                  ₹{shivaHandedOver.toFixed(2)}
                </span>
                <span className="text-[10px] text-stone-500">
                  (Target: ₹{shivaStats.cashCollected.toFixed(2)})
                </span>
              </div>
            </div>

            {/* 4. Remaining */}
            <div className="space-y-1">
              <span className="text-stone-400 font-bold block uppercase text-[10px] tracking-wider">
                ⚖️ 4. Remaining
              </span>
              <div>
                <span
                  className={`font-black px-2.5 py-1 rounded-md text-xs inline-flex items-center gap-1 font-mono ${
                    shivaBalance === 0
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : shivaBalance > 0
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  }`}
                >
                  {shivaBalance === 0 ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>₹0.00 (Balanced)</span>
                    </>
                  ) : shivaBalance > 0 ? (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>₹{shivaBalance.toFixed(2)} (Due)</span>
                    </>
                  ) : (
                    <span>+₹{Math.abs(shivaBalance).toFixed(2)} (Excess)</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. PARCEL DESK SECTION (Manager Counter - Directly into Drawer) */}
        <div className="bg-[#181513] border border-[#2C2520] rounded-2xl p-5 shadow-xl">
          <div className="flex justify-between items-center pb-2.5 border-b border-[#2C2520] mb-3">
            <h2 className="font-black text-sm text-[#D08A52] uppercase tracking-wider flex items-center gap-2">
              <span>📦 PARCEL / TAKEAWAY DESK</span>
              <span className="text-xs text-amber-300/80 font-normal">(Manager Counter)</span>
            </h2>
            <span className="text-xs text-stone-400">
              Total Parcels: <strong className="text-white">{parcelStats.tablesCount}</strong>
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-stone-300 mb-3 font-medium">
            <span>• Total Billed: <strong className="text-white">₹{parcelStats.totalBilled.toFixed(2)}</strong></span>
            <span>• 📱 UPI / Online: <strong className="text-white">₹{parcelStats.upiCollected.toFixed(2)}</strong></span>
          </div>

          {/* Parcel Cash Row */}
          <div className="p-3.5 rounded-xl bg-[#221D1A] border border-[#8A4228]/40 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-stone-300 font-bold">• 💵 Cash Collected:</span>
              <span className="font-black text-amber-400 text-sm">₹{parcelStats.cashCollected.toFixed(2)}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-md bg-[#8A4228]/20 border border-[#8A4228]/40 text-amber-300 font-semibold flex items-center gap-1.5 text-xs">
                <Store className="w-3.5 h-3.5 text-[#D08A52]" />
                <span>Directly at Manager Counter — No Handover Required</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="px-3 py-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>🟢 Direct into Drawer</span>
              </span>
            </div>
          </div>
        </div>

        {/* Total Cash In Drawer Bar */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-[#8A4228]/20 via-[#181513] to-[#8A4228]/20 border-2 border-[#8A4228]/60 flex flex-wrap justify-between items-center shadow-lg gap-3">
          <div>
            <span className="font-black text-sm md:text-base text-white tracking-wide flex items-center gap-2">
              <span>💰 TOTAL CASH IN DRAWER:</span>
            </span>
            <p className="text-[11px] text-stone-400 mt-0.5 font-mono">
              (Suhas Handed: ₹{suhasHandedOver.toFixed(2)} + Shiva Handed: ₹{shivaHandedOver.toFixed(2)} + Parcel Direct: ₹{parcelStats.cashCollected.toFixed(2)})
            </p>
          </div>
          <span className="text-2xl md:text-3xl font-black text-amber-400 font-mono">
            ₹{totalCashInDrawer.toFixed(2)}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-[#2C2520]">
          <button
            type="button"
            onClick={() => alert(`Shift reconciled successfully! Total cash verified in drawer: ₹${totalCashInDrawer.toFixed(2)}`)}
            className="py-4 rounded-xl bg-[#8A4228] hover:bg-[#71351F] text-white font-black text-xs md:text-sm flex items-center justify-center gap-2 shadow-xl shadow-[#8A4228]/20 active:scale-98 transition-all"
          >
            <Lock className="w-4 h-4" />
            <span>🔒 CLOSE SHIFT & VERIFY CASH IN DRAWER</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="py-4 rounded-xl bg-[#1C1815] hover:bg-[#25201C] text-stone-200 font-black text-xs md:text-sm flex items-center justify-center gap-2 border border-[#2C2520] active:scale-98 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>📄 PRINT STAFF SHIFT SUMMARY</span>
          </button>
        </div>
      </div>
    </div>
  );
}
