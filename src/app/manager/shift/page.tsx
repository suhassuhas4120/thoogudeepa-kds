'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, DollarSign, CheckCircle2, AlertCircle, Printer, Lock } from 'lucide-react';

interface StaffRow {
  name: string;
  zone: string;
  tablesCount: number;
  totalBilled: number;
  upiCollected: number;
  cashCollected: number;
  handedOver: string;
}

export default function ManagerShiftAuditScreen() {
  const [dateStr, setDateStr] = useState('25-10-2026');
  const [suhasHandedOver, setSuhasHandedOver] = useState('3450');
  const [shivaHandedOver, setShivaHandedOver] = useState('2800');
  const [parcelHandedOver, setParcelHandedOver] = useState('4200');

  // Hardcoded initial verified records or fetched from MasterSalesRecord
  const [suhasStats, setSuhasStats] = useState({
    tablesCount: 22,
    totalBilled: 10240,
    upiCollected: 6790,
    cashCollected: 3450,
  });

  const [shivaStats, setShivaStats] = useState({
    tablesCount: 20,
    totalBilled: 9130,
    upiCollected: 6330,
    cashCollected: 2800,
  });

  const [parcelStats, setParcelStats] = useState({
    tablesCount: 18,
    totalBilled: 8420,
    upiCollected: 4220,
    cashCollected: 4200,
  });

  useEffect(() => {
    const now = new Date();
    setDateStr(now.toLocaleDateString('en-GB').replace(/\//g, '-'));

    // Fetch live totals from /api/reports/master-sales
    fetch('/api/reports/master-sales')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.records) {
          const records = data.data.records;
          let sTables = 0, sBilled = 0, sUpi = 0, sCash = 0;
          let shTables = 0, shBilled = 0, shUpi = 0, shCash = 0;
          let pTables = 0, pBilled = 0, pUpi = 0, pCash = 0;

          records.forEach((r: any) => {
            if (r.orderType === 'Takeaway') {
              pTables++;
              pBilled += r.grandTotal;
              if (r.paymentMode === 'CASH') pCash += r.grandTotal;
              else pUpi += r.grandTotal;
            } else if (r.serverName === 'Suhas') {
              sTables++;
              sBilled += r.grandTotal;
              if (r.paymentMode === 'CASH') sCash += r.grandTotal;
              else sUpi += r.grandTotal;
            } else if (r.serverName === 'Shiva') {
              shTables++;
              shBilled += r.grandTotal;
              if (r.paymentMode === 'CASH') shCash += r.grandTotal;
              else shUpi += r.grandTotal;
            }
          });

          if (records.length > 0) {
            setSuhasStats({ tablesCount: sTables, totalBilled: sBilled, upiCollected: sUpi, cashCollected: sCash });
            setShivaStats({ tablesCount: shTables, totalBilled: shBilled, upiCollected: shUpi, cashCollected: shCash });
            setParcelStats({ tablesCount: pTables, totalBilled: pBilled, upiCollected: pUpi, cashCollected: pCash });
            setSuhasHandedOver(String(sCash));
            setShivaHandedOver(String(shCash));
            setParcelHandedOver(String(pCash));
          }
        }
      })
      .catch(console.error);
  }, []);

  // Balance Math
  const suhasBalance = suhasStats.cashCollected - (parseFloat(suhasHandedOver) || 0);
  const shivaBalance = shivaStats.cashCollected - (parseFloat(shivaHandedOver) || 0);
  const parcelBalance = parcelStats.cashCollected - (parseFloat(parcelHandedOver) || 0);

  const totalCashCollected = suhasStats.cashCollected + shivaStats.cashCollected + parcelStats.cashCollected;
  const totalHandedOver =
    (parseFloat(suhasHandedOver) || 0) +
    (parseFloat(shivaHandedOver) || 0) +
    (parseFloat(parcelHandedOver) || 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none p-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <header className="flex items-center justify-between pb-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href="/manager/floor"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Floor</span>
          </Link>
          <div className="h-4 w-px bg-slate-700" />
          <h1 className="text-sm font-black text-white uppercase tracking-wider">
            STAFF SHIFT AUDIT & CASH RECONCILIATION
          </h1>
        </div>

        <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-amber-400">
          Date: {dateStr}
        </span>
      </header>

      {/* Main Audit Sections */}
      <div className="py-6 space-y-6 flex-1">
        {/* 1. SUHAS SECTION */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-3">
            <h2 className="font-black text-sm text-blue-400 uppercase tracking-wider">
              🤵 WAITER 1: SUHAS (Zone A: Seats 1 - 8)
            </h2>
            <span className="text-xs text-slate-400">
              Tables Served: <strong className="text-white">{suhasStats.tablesCount}</strong>
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300 mb-3">
            <span>Total Billed: <strong>₹{suhasStats.totalBilled.toFixed(2)}</strong></span>
            <span>📱 UPI / Online: <strong>₹{suhasStats.upiCollected.toFixed(2)}</strong></span>
          </div>

          {/* Inline Cash Row (As specifically requested in update 4!) */}
          <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">💵 Cash Collected:</span>
              <span className="font-black text-amber-400 text-sm">₹{suhasStats.cashCollected.toFixed(2)}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Handed Over:</span>
              <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1">
                <span className="text-slate-500 mr-1">₹</span>
                <input
                  type="number"
                  value={suhasHandedOver}
                  onChange={(e) => setSuhasHandedOver(e.target.value)}
                  className="w-20 bg-transparent text-white font-bold focus:outline-none text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Remaining Balance:</span>
              <span
                className={`font-black px-2 py-0.5 rounded-md text-xs ${
                  suhasBalance === 0
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                ₹{Math.abs(suhasBalance).toFixed(2)} {suhasBalance === 0 ? '(Balanced)' : '(Due)'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. SHIVA SECTION */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-3">
            <h2 className="font-black text-sm text-cyan-400 uppercase tracking-wider">
              🤵 WAITER 2: SHIVA (Zone B: Seats 9 - 16)
            </h2>
            <span className="text-xs text-slate-400">
              Tables Served: <strong className="text-white">{shivaStats.tablesCount}</strong>
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300 mb-3">
            <span>Total Billed: <strong>₹{shivaStats.totalBilled.toFixed(2)}</strong></span>
            <span>📱 UPI / Online: <strong>₹{shivaStats.upiCollected.toFixed(2)}</strong></span>
          </div>

          {/* Inline Cash Row */}
          <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">💵 Cash Collected:</span>
              <span className="font-black text-amber-400 text-sm">₹{shivaStats.cashCollected.toFixed(2)}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Handed Over:</span>
              <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1">
                <span className="text-slate-500 mr-1">₹</span>
                <input
                  type="number"
                  value={shivaHandedOver}
                  onChange={(e) => setShivaHandedOver(e.target.value)}
                  className="w-20 bg-transparent text-white font-bold focus:outline-none text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Remaining Balance:</span>
              <span
                className={`font-black px-2 py-0.5 rounded-md text-xs ${
                  shivaBalance === 0
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                ₹{Math.abs(shivaBalance).toFixed(2)} {shivaBalance === 0 ? '(Balanced)' : '(Due)'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. PARCEL DESK SECTION */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-3">
            <h2 className="font-black text-sm text-amber-400 uppercase tracking-wider">
              📦 PARCEL / TAKEAWAY DESK (Manager Counter)
            </h2>
            <span className="text-xs text-slate-400">
              Orders: <strong className="text-white">{parcelStats.tablesCount}</strong>
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300 mb-3">
            <span>Total Billed: <strong>₹{parcelStats.totalBilled.toFixed(2)}</strong></span>
            <span>📱 UPI / Online: <strong>₹{parcelStats.upiCollected.toFixed(2)}</strong></span>
          </div>

          {/* Inline Cash Row */}
          <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">💵 Cash Collected:</span>
              <span className="font-black text-amber-400 text-sm">₹{parcelStats.cashCollected.toFixed(2)}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Handed Over:</span>
              <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1">
                <span className="text-slate-500 mr-1">₹</span>
                <input
                  type="number"
                  value={parcelHandedOver}
                  onChange={(e) => setParcelHandedOver(e.target.value)}
                  className="w-20 bg-transparent text-white font-bold focus:outline-none text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Remaining Balance:</span>
              <span
                className={`font-black px-2 py-0.5 rounded-md text-xs ${
                  parcelBalance === 0
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                ₹{Math.abs(parcelBalance).toFixed(2)} {parcelBalance === 0 ? '(Balanced)' : '(Due)'}
              </span>
            </div>
          </div>
        </div>

        {/* Total Cash In Drawer Bar */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex justify-between items-center">
          <span className="font-black text-sm text-white">💰 TOTAL CASH IN DRAWER:</span>
          <span className="text-xl font-black text-amber-400">₹{totalHandedOver.toFixed(2)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-4 grid grid-cols-2 gap-4 border-t border-slate-800">
        <button
          type="button"
          onClick={() => alert(`Shift reconciled successfully! Total cash recorded: ₹${totalHandedOver.toFixed(2)}`)}
          className="py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/20 active:scale-98"
        >
          <Lock className="w-4 h-4" />
          <span>CLOSE SHIFT & VERIFY CASH IN DRAWER</span>
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          className="py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs flex items-center justify-center gap-2 border border-slate-700 active:scale-98"
        >
          <Printer className="w-4 h-4" />
          <span>PRINT STAFF SHIFT SUMMARY</span>
        </button>
      </div>
    </div>
  );
}
