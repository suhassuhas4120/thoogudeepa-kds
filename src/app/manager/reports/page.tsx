'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  FileText,
  Calendar,
  ChevronDown,
  Download,
  Search,
  RefreshCw,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { useSocketRoom } from '@/lib/useSocket';
import ManagerTopNav from '@/components/ManagerTopNav';

interface TransactionRow {
  billNumber: string;
  date: string;
  orderType: string;
  seatNumberOrToken: string;
  customerName: string;
  customerPhone?: string;
  serverName: string;
  itemsSummary: string;
  placedAt: string;
  settledAt: string;
  subtotal: number;
  discountAmount: number;
  gst5Percent: number;
  grandTotal: number;
  paymentMode: string;
  paymentStatus: string;
}

interface ItemPerformanceRow {
  dishName: string;
  category: string;
  qtySold: number;
  unitPrice: number;
  totalRevenue: number;
  contributionPercent: number;
}

export default function MasterSalesReportPage() {
  const socket = useSocketRoom('room:manager');

  const now = new Date();
  const todayStr = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).replace(/\//g, '-'); // e.g. "27-10-2026"
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterdayDate.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).replace(/\//g, '-'); // e.g. "26-10-2026"

  const [selectedDate, setSelectedDate] = useState<string>(todayStr); // Default to today's live business
  const [availableDates, setAvailableDates] = useState<string[]>([todayStr, yesterdayStr, '25-10-2026']);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [itemPerformance, setItemPerformance] = useState<ItemPerformanceRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Auto-discover all available historical business dates from the database
  useEffect(() => {
    fetch('/api/reports/master-sales?date=ALL&t=' + Date.now())
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data?.records)) {
          const datesSet = new Set<string>([todayStr, yesterdayStr]);
          d.data.records.forEach((rec: any) => {
            if (rec.date && typeof rec.date === 'string') datesSet.add(rec.date);
          });
          const sorted = Array.from(datesSet).sort((a, b) => {
            const [da, ma, ya] = a.split('-').map(Number);
            const [db, mb, yb] = b.split('-').map(Number);
            return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
          });
          setAvailableDates(sorted);
        }
      })
      .catch(() => {});
  }, [todayStr, yesterdayStr]);

  // Fetch real-time live data from database
  const fetchReportsData = () => {
    const url = `/api/reports/master-sales?date=${selectedDate}&t=${Date.now()}`;
    fetch(url, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data?.records)) {
          const mapped: TransactionRow[] = data.data.records.map((r: any) => ({
            billNumber: r.billNumber,
            date: r.date || todayStr,
            orderType: r.orderType,
            seatNumberOrToken: r.seatNumberOrToken || (r.seatId ? `S${r.seatId}` : 'P-Desk'),
            customerName: r.customerName || '-',
            customerPhone: r.customerPhone,
            serverName: r.serverName || 'Staff',
            itemsSummary: r.itemsSummary || 'Food items',
            placedAt: r.placedAt || '—',
            settledAt: r.settledAt || '—',
            subtotal: Number(r.subtotal) || 0,
            discountAmount: Number(r.discountAmount) || 0,
            gst5Percent: Number(r.gst5Percent) || 0,
            grandTotal: Number(r.grandTotal) || 0,
            paymentMode: r.paymentMode || 'CASH',
            paymentStatus: r.paymentStatus || 'PAID',
          }));
          setTransactions(mapped);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching master sales report:', err);
        setLoading(false);
      });

    // Fetch live item-wise sales for the selected date
    fetch(`/api/reports/item-wise?date=${selectedDate}&t=${Date.now()}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data?.report)) {
          const mappedItems: ItemPerformanceRow[] = data.data.report.map((r: any) => ({
            dishName: r.name,
            category: r.categoryName,
            qtySold: r.qtySold,
            unitPrice: r.unitPrice,
            totalRevenue: r.revenue,
            contributionPercent: r.contributionPercent,
          }));
          setItemPerformance(mappedItems);
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchReportsData();
    const interval = setInterval(fetchReportsData, 3000);
    const handleFocus = () => fetchReportsData();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
    };
  }, [selectedDate]);

  // Real-time Socket sync
  useEffect(() => {
    if (!socket) return;
    socket.on('seat:vacated', fetchReportsData);
    socket.on('order:placed', fetchReportsData);
    socket.on('order:item_status_changed', fetchReportsData);
    socket.on('payment:lock_changed', fetchReportsData);

    return () => {
      socket.off('seat:vacated', fetchReportsData);
      socket.off('order:placed', fetchReportsData);
      socket.off('order:item_status_changed', fetchReportsData);
      socket.off('payment:lock_changed', fetchReportsData);
    };
  }, [socket, selectedDate]);

  // Real, dynamic, 100% accurate financial computations
  const grossFoodSales = transactions.reduce((acc, t) => acc + (t.subtotal || 0), 0);
  const totalDiscount = transactions.reduce((acc, t) => acc + (t.discountAmount || 0), 0);
  const totalGst = transactions.reduce((acc, t) => acc + (t.gst5Percent || 0), 0);
  const netDayRevenue = transactions.reduce((acc, t) => acc + (t.grandTotal || 0), 0);

  const dineInSales = transactions
    .filter((t) => (t.orderType || '').toLowerCase().includes('dine'))
    .reduce((acc, t) => acc + (t.grandTotal || 0), 0);

  const takeawaySales = transactions
    .filter((t) => !(t.orderType || '').toLowerCase().includes('dine'))
    .reduce((acc, t) => acc + (t.grandTotal || 0), 0);

  const totalOrdersCompleted = transactions.length;
  const dineInCount = transactions.filter((t) => (t.orderType || '').toLowerCase().includes('dine')).length;
  const takeawayCount = totalOrdersCompleted - dineInCount;

  const cashSales = transactions
    .filter((t) => (t.paymentMode || '').toUpperCase().includes('CASH'))
    .reduce((acc, t) => acc + (t.grandTotal || 0), 0);

  const upiSales = transactions
    .filter((t) => (t.paymentMode || '').toUpperCase().includes('UPI'))
    .reduce((acc, t) => acc + (t.grandTotal || 0), 0);

  const cardSales = transactions
    .filter((t) => (t.paymentMode || '').toUpperCase().includes('CARD'))
    .reduce((acc, t) => acc + (t.grandTotal || 0), 0);

  const cashPct = netDayRevenue > 0 ? ((cashSales / netDayRevenue) * 100).toFixed(1) : '0.0';
  const upiPct = netDayRevenue > 0 ? ((upiSales / netDayRevenue) * 100).toFixed(1) : '0.0';
  const cardPct = netDayRevenue > 0 ? ((cardSales / netDayRevenue) * 100).toFixed(1) : '0.0';

  // Search filter
  const filtered = transactions.filter((t) => {
    const q = searchTerm.toLowerCase();
    return (
      t.billNumber.toLowerCase().includes(q) ||
      t.customerName.toLowerCase().includes(q) ||
      t.serverName.toLowerCase().includes(q) ||
      t.seatNumberOrToken.toLowerCase().includes(q) ||
      t.paymentMode.toLowerCase().includes(q) ||
      t.itemsSummary.toLowerCase().includes(q)
    );
  });

  const displayFilterLabel =
    selectedDate === 'ALL'
      ? 'All Time (Cumulative)'
      : selectedDate === todayStr
      ? `Today (${todayStr})`
      : selectedDate === yesterdayStr
      ? `Yesterday (${yesterdayStr})`
      : selectedDate;

  // Export to Excel (.xlsx) using REAL calculated data
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Financial Summary
    const summaryData = [
      ['THOOGUDEEPA DONNE BIRYANI MANE - MASTER FINANCIAL REPORT'],
      ['Report Period / Date:', displayFilterLabel],
      [],
      ['Metric', 'Amount (₹) / Details'],
      ['Gross Food Sales', `₹${grossFoodSales.toFixed(2)}`],
      ['Total Discounts', `-₹${totalDiscount.toFixed(2)}`],
      ['Total GST (5%)', `₹${totalGst.toFixed(2)}`],
      ['Net Day Revenue', `₹${netDayRevenue.toFixed(2)}`],
      ['Dine-in Sales (16 Seats)', `₹${dineInSales.toFixed(2)}`],
      ['Takeaway / Parcel Sales', `₹${takeawaySales.toFixed(2)}`],
      ['Total Orders Completed', `${totalOrdersCompleted} (${dineInCount} Dine-in, ${takeawayCount} Parcel)`],
      ['Payment Split - Cash', `₹${cashSales.toFixed(2)} (${cashPct}%)`],
      ['Payment Split - UPI', `₹${upiSales.toFixed(2)} (${upiPct}%)`],
      ['Payment Split - Card POS', `₹${cardSales.toFixed(2)} (${cardPct}%)`],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Financial Summary');

    // Sheet 2: Item-Wise Sales
    const itemsData = [
      ['DISH NAME', 'CATEGORY', 'QTY SOLD', 'UNIT PRICE (₹)', 'TOTAL REVENUE (₹)', 'CONTRIBUTION %'],
      ...itemPerformance.map((i) => [
        i.dishName,
        i.category,
        i.qtySold,
        i.unitPrice,
        i.totalRevenue,
        `${i.contributionPercent}%`,
      ]),
    ];
    const wsItems = XLSX.utils.aoa_to_sheet(itemsData);
    XLSX.utils.book_append_sheet(wb, wsItems, 'Item-Wise Sales');

    // Sheet 3: Master Transactions
    const txData = [
      [
        'BILL #',
        'DATE',
        'ORDER TYPE',
        'SEAT / TOKEN',
        'CUSTOMER NAME',
        'PHONE',
        'SERVER / CASHIER',
        'ITEMS SUMMARY',
        'PLACED TIME',
        'SETTLED TIME',
        'SUBTOTAL (₹)',
        'DISCOUNT (₹)',
        'GST 5% (₹)',
        'GRAND TOTAL (₹)',
        'PAYMENT MODE',
        'STATUS',
      ],
      ...filtered.map((t) => [
        t.billNumber,
        t.date,
        t.orderType,
        t.seatNumberOrToken,
        t.customerName,
        t.customerPhone || '-',
        t.serverName,
        t.itemsSummary,
        t.placedAt,
        t.settledAt,
        t.subtotal,
        t.discountAmount,
        t.gst5Percent,
        t.grandTotal,
        t.paymentMode,
        t.paymentStatus,
      ]),
    ];
    const wsTx = XLSX.utils.aoa_to_sheet(txData);
    XLSX.utils.book_append_sheet(wb, wsTx, 'Detailed Audit');

    XLSX.writeFile(wb, `Thoogudeepa_Sales_Report_${selectedDate}.xlsx`);
  };

  // Export to PDF using REAL calculated data
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('THOOGUDEEPA DONNE BIRYANI MANE', 14, 15);
    doc.setFontSize(10);
    doc.text(`MASTER FINANCIAL & DETAILED SALES REPORT — ${displayFilterLabel}`, 14, 21);

    // 1. Summary Box
    doc.setDrawColor(70, 70, 70);
    doc.setFillColor(240, 240, 240);
    doc.rect(14, 25, 269, 22, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      `Gross Food Sales: Rs. ${grossFoodSales.toFixed(2)}  |  Total Discounts: -Rs. ${totalDiscount.toFixed(2)}  |  Total GST: Rs. ${totalGst.toFixed(2)}  |  Net Revenue: Rs. ${netDayRevenue.toFixed(2)}`,
      18,
      31
    );
    doc.text(
      `Dine-in Sales (16 Seats): Rs. ${dineInSales.toFixed(2)}   |   Takeaway / Parcel Sales: Rs. ${takeawaySales.toFixed(2)}   |   Total Orders: ${totalOrdersCompleted}`,
      18,
      37
    );
    doc.text(
      `Payment Split: Cash Rs. ${cashSales.toFixed(2)} (${cashPct}%)  *  UPI Rs. ${upiSales.toFixed(2)} (${upiPct}%)  *  Card POS Rs. ${cardSales.toFixed(2)} (${cardPct}%)`,
      18,
      43
    );

    // 2. Items Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('2. ITEM-WISE SALES PERFORMANCE', 14, 53);

    let y = 58;
    doc.setFontSize(7.5);
    doc.setFillColor(40, 40, 40);
    doc.rect(14, y, 269, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('DISH NAME', 16, y + 4.5);
    doc.text('CATEGORY', 80, y + 4.5);
    doc.text('QTY SOLD', 140, y + 4.5);
    doc.text('UNIT PRICE', 175, y + 4.5);
    doc.text('TOTAL REVENUE', 215, y + 4.5);
    doc.text('CONTRIBUTION %', 255, y + 4.5);

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    y += 6;

    itemPerformance.slice(0, 15).forEach((i) => {
      doc.text(i.dishName, 16, y + 4.5);
      doc.text(i.category, 80, y + 4.5);
      doc.text(String(i.qtySold), 140, y + 4.5);
      doc.text(`Rs. ${i.unitPrice.toFixed(2)}`, 175, y + 4.5);
      doc.text(`Rs. ${i.totalRevenue.toFixed(2)}`, 215, y + 4.5);
      doc.text(`${i.contributionPercent.toFixed(1)}%`, 255, y + 4.5);
      y += 5.5;
    });

    // 3. Transactions Table
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('3. MASTER DETAILED TRANSACTION AUDIT', 14, y);

    y += 4;
    doc.setFontSize(6.5);
    doc.setFillColor(40, 40, 40);
    doc.rect(14, y, 269, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('BILL #', 14, y + 4.2);
    doc.text('DATE', 28, y + 4.2);
    doc.text('TYPE', 44, y + 4.2);
    doc.text('SEAT', 58, y + 4.2);
    doc.text('CUSTOMER NAME', 68, y + 4.2);
    doc.text('SERVER', 96, y + 4.2);
    doc.text('ITEMS SUMMARY', 114, y + 4.2);
    doc.text('PLACED', 162, y + 4.2);
    doc.text('SETTLED', 176, y + 4.2);
    doc.text('SUBTOT', 190, y + 4.2);
    doc.text('DISC', 205, y + 4.2);
    doc.text('GST 5%', 220, y + 4.2);
    doc.text('GRAND', 236, y + 4.2);
    doc.text('MODE', 254, y + 4.2);
    doc.text('STATUS', 270, y + 4.2);

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    y += 6;

    filtered.slice(0, 20).forEach((t) => {
      doc.text(t.billNumber, 14, y + 4.2);
      doc.text(t.date, 28, y + 4.2);
      doc.text(t.orderType, 44, y + 4.2);
      doc.text(t.seatNumberOrToken, 58, y + 4.2);
      doc.text(t.customerName.substring(0, 12), 68, y + 4.2);
      doc.text(t.serverName.substring(0, 8), 96, y + 4.2);
      doc.text(t.itemsSummary.substring(0, 24), 114, y + 4.2);
      doc.text(t.placedAt, 162, y + 4.2);
      doc.text(t.settledAt, 176, y + 4.2);
      doc.text(`Rs.${t.subtotal.toFixed(0)}`, 190, y + 4.2);
      doc.text(t.discountAmount > 0 ? `-Rs.${t.discountAmount.toFixed(0)}` : 'Rs.0', 205, y + 4.2);
      doc.text(`Rs.${t.gst5Percent.toFixed(0)}`, 220, y + 4.2);
      doc.text(`Rs.${t.grandTotal.toFixed(0)}`, 236, y + 4.2);
      doc.text(t.paymentMode, 254, y + 4.2);
      doc.text(t.paymentStatus, 270, y + 4.2);
      y += 5;
    });

    doc.save(`Thoogudeepa_Master_Sales_Report_${selectedDate}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#FBF9F6] text-stone-900 flex flex-col font-mono text-xs select-none p-3">
      <div className="border border-[#8A4228] rounded-2xl bg-[#FBF9F6] min-h-[calc(100vh-1.5rem)] flex flex-col overflow-hidden">
      {/* Shared Manager Top Navigation */}
      <ManagerTopNav activeTab="reports" />

      {/* Subheader Bar with Title & Export Actions */}
      <div className="bg-white border-b border-stone-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xs md:text-sm font-black text-[#8A4228] uppercase tracking-wider font-sans">
            MASTER FINANCIAL & DETAILED SALES REPORT
          </h1>
          <p className="text-[11px] text-stone-400 font-sans mt-0.5">
            Real-time live audit • {transactions.length} total bills settled
          </p>
        </div>

        {/* Filter & Export Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Interactive Date Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 font-bold text-xs">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-stone-400 font-sans">Period:</span>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white text-stone-900 font-mono text-xs px-2 py-0.5 rounded border border-stone-200 focus:outline-none focus:border-[#8A4228] cursor-pointer"
            >
              <option value="ALL">All Time (Cumulative)</option>
              <option value={todayStr}>Today ({todayStr})</option>
              <option value={yesterdayStr}>Yesterday ({yesterdayStr})</option>
              {availableDates
                .filter((d) => d !== todayStr && d !== yesterdayStr && d !== 'ALL')
                .map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-stone-900 rounded-xl font-bold text-xs transition shadow active:scale-95"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-stone-900 rounded-xl font-bold text-xs transition shadow active:scale-95"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="p-6 space-y-6 flex-1 max-w-[1600px] w-full mx-auto">
        {/* 1. COMPLETE FINANCIAL SUMMARY BREAKDOWN */}
        <section className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="bg-stone-50 px-4 py-2.5 border-b border-stone-200 font-bold text-amber-400 uppercase tracking-wider text-xs flex justify-between items-center">
            <span>1. COMPLETE FINANCIAL SUMMARY BREAKDOWN ({displayFilterLabel})</span>
            <span className="text-[11px] text-emerald-400 font-mono font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Real-Time
            </span>
          </div>
          <div className="p-5 space-y-4 font-sans text-xs">
            {/* Row 1: Gross, Discounts, GST, Net */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-4 border-b border-stone-200">
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                <span className="text-stone-400 block text-[11px] uppercase font-bold tracking-wider">Gross Food Sales:</span>
                <strong className="text-stone-900 text-lg font-mono font-black mt-1 block">
                  ₹{grossFoodSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                <span className="text-stone-400 block text-[11px] uppercase font-bold tracking-wider">Total Discounts:</span>
                <strong className="text-emerald-400 text-lg font-mono font-black mt-1 block">
                  -₹{totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                <span className="text-stone-400 block text-[11px] uppercase font-bold tracking-wider">Total GST (5%):</span>
                <strong className="text-sky-400 text-lg font-mono font-black mt-1 block">
                  ₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                <span className="text-stone-400 block text-[11px] uppercase font-bold tracking-wider">Net Day Revenue:</span>
                <strong className="text-amber-400 text-lg font-mono font-black mt-1 block">
                  ₹{netDayRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
            </div>

            {/* Row 2: Dine-in, Takeaway, Total Orders */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-stone-200">
              <div>
                <span className="text-stone-400">Dine-in Sales (16 Seats):</span>{' '}
                <strong className="text-stone-900 text-sm font-mono font-bold">
                  ₹{dineInSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
              <div>
                <span className="text-stone-400">Takeaway / Parcel Sales:</span>{' '}
                <strong className="text-amber-400 text-sm font-mono font-bold">
                  ₹{takeawaySales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
              <div>
                <span className="text-stone-400">Total Orders Completed:</span>{' '}
                <strong className="text-stone-900 text-sm font-mono font-bold">{totalOrdersCompleted}</strong>{' '}
                <span className="text-stone-400 text-[11px]">({dineInCount} Dine-in, {takeawayCount} Parcel)</span>
              </div>
            </div>

            {/* Row 3: Payment Split */}
            <div className="text-xs text-stone-300 flex flex-wrap items-center gap-2">
              <span className="text-stone-400 font-bold">Payment Split:</span>
              <span className="bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200 text-stone-700">
                💵 Cash: <strong className="text-amber-400 font-mono">₹{cashSales.toFixed(2)} ({cashPct}%)</strong>
              </span>
              <span>•</span>
              <span className="bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200 text-stone-700">
                📱 UPI: <strong className="text-cyan-400 font-mono">₹{upiSales.toFixed(2)} ({upiPct}%)</strong>
              </span>
              <span>•</span>
              <span className="bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200 text-stone-700">
                💳 Card POS: <strong className="text-purple-400 font-mono">₹{cardSales.toFixed(2)} ({cardPct}%)</strong>
              </span>
            </div>
          </div>
        </section>

        {/* 2. ITEM-WISE SALES PERFORMANCE */}
        <section className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="bg-stone-50 px-4 py-2.5 border-b border-stone-200 font-bold text-cyan-400 uppercase tracking-wider text-xs flex justify-between items-center">
            <span>2. ITEM-WISE SALES PERFORMANCE ({itemPerformance.length} Items Sold)</span>
            <span className="text-[11px] text-stone-400 font-normal">Top Revenue Contributors</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead className="bg-stone-50 text-stone-600 border-b border-stone-200 font-bold uppercase text-[11px]">
                <tr>
                  <th className="p-3 border-r border-stone-200">DISH NAME</th>
                  <th className="p-3 border-r border-stone-200">CATEGORY</th>
                  <th className="p-3 border-r border-stone-200 text-right">QTY SOLD</th>
                  <th className="p-3 border-r border-stone-200 text-right">UNIT PRICE</th>
                  <th className="p-3 border-r border-stone-200 text-right">TOTAL REVENUE (₹)</th>
                  <th className="p-3 text-right">CONTRIBUTION %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-mono text-xs">
                {itemPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-stone-500 font-sans">
                      No dishes sold yet.
                    </td>
                  </tr>
                ) : (
                  itemPerformance.map((row, idx) => (
                    <tr key={idx} className="hover:bg-stone-50/70 transition-colors">
                      <td className="p-3 font-sans font-bold text-stone-900 border-r border-stone-200">
                        {row.dishName}
                      </td>
                      <td className="p-3 font-sans text-stone-300 border-r border-stone-200">
                        {row.category}
                      </td>
                      <td className="p-3 text-right text-stone-900 font-bold border-r border-stone-200">
                        {row.qtySold}
                      </td>
                      <td className="p-3 text-right text-stone-300 border-r border-stone-200">
                        ₹{row.unitPrice.toFixed(2)}
                      </td>
                      <td className="p-3 text-right text-emerald-400 font-bold border-r border-stone-200">
                        ₹{row.totalRevenue.toFixed(2)}
                      </td>
                      <td className="p-3 text-right text-amber-400 font-bold">
                        {row.contributionPercent.toFixed(1)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. MASTER DETAILED TRANSACTION AUDIT (MAXIMUM COLUMNS) */}
        <section className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="bg-stone-50 px-4 py-2.5 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
            <span className="font-bold text-emerald-400 uppercase tracking-wider text-xs">
              3. MASTER DETAILED TRANSACTION AUDIT ({filtered.length} Invoices)
            </span>
            <div className="relative w-72">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Bill #, Guest, Server or Mode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-lg pl-8 pr-3 py-1 text-xs text-stone-900 placeholder-stone-500 focus:outline-none focus:border-[#8A4228] font-sans"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-stone-50 text-stone-600 border-b border-stone-200 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5 border-r border-stone-200">BILL #</th>
                  <th className="p-2.5 border-r border-stone-200">DATE</th>
                  <th className="p-2.5 border-r border-stone-200">TYPE</th>
                  <th className="p-2.5 border-r border-stone-200">SEAT</th>
                  <th className="p-2.5 border-r border-stone-200">CUSTOMER NAME</th>
                  <th className="p-2.5 border-r border-stone-200">SERVER</th>
                  <th className="p-2.5 border-r border-stone-200">ITEMS SUMMARY</th>
                  <th className="p-2.5 border-r border-stone-200">PLACED</th>
                  <th className="p-2.5 border-r border-stone-200">SETTLED</th>
                  <th className="p-2.5 border-r border-stone-200 text-right">SUBTOT</th>
                  <th className="p-2.5 border-r border-stone-200 text-right">DISCOUNT</th>
                  <th className="p-2.5 border-r border-stone-200 text-right">GST 5%</th>
                  <th className="p-2.5 border-r border-stone-200 text-right">GRAND TOT</th>
                  <th className="p-2.5 border-r border-stone-200">MODE</th>
                  <th className="p-2.5 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#26201B]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="p-8 text-center text-stone-500 font-sans">
                      {loading ? 'Loading real-time records...' : 'No settled transactions found matching this search or date filter.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => (
                    <tr key={t.billNumber} className="hover:bg-stone-50/70 transition-colors">
                      <td className="p-2.5 font-bold text-amber-400 border-r border-stone-200">
                        {t.billNumber}
                      </td>
                      <td className="p-2.5 text-stone-300 border-r border-stone-200">
                        {t.date}
                      </td>
                      <td className="p-2.5 border-r border-stone-200">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            t.orderType.toLowerCase().includes('take') || t.orderType.toLowerCase().includes('parcel')
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                              : 'bg-stone-800 text-stone-300'
                          }`}
                        >
                          {t.orderType}
                        </span>
                      </td>
                      <td className="p-2.5 font-bold text-stone-900 border-r border-stone-200">
                        {t.seatNumberOrToken}
                      </td>
                      <td className="p-2.5 text-stone-200 border-r border-stone-200">
                        {t.customerName}
                      </td>
                      <td className="p-2.5 text-stone-300 border-r border-stone-200">
                        {t.serverName}
                      </td>
                      <td className="p-2.5 text-stone-200 max-w-xs truncate border-r border-stone-200" title={t.itemsSummary}>
                        {t.itemsSummary}
                      </td>
                      <td className="p-2.5 text-stone-300 border-r border-stone-200">
                        {t.placedAt}
                      </td>
                      <td className="p-2.5 text-stone-300 border-r border-stone-200">
                        {t.settledAt}
                      </td>
                      <td className="p-2.5 text-right font-mono text-stone-300 border-r border-stone-200">
                        ₹{t.subtotal.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-emerald-400 font-bold border-r border-stone-200">
                        {t.discountAmount > 0 ? `-₹${t.discountAmount.toFixed(2)}` : '₹0.00'}
                      </td>
                      <td className="p-2.5 text-right font-mono text-stone-400 border-r border-stone-200">
                        ₹{t.gst5Percent.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-amber-400 border-r border-stone-200">
                        ₹{t.grandTotal.toFixed(2)}
                      </td>
                      <td className="p-2.5 border-r border-stone-200">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            t.paymentMode.toUpperCase().includes('UPI')
                              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/30'
                              : t.paymentMode.toUpperCase().includes('CASH')
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                              : 'bg-purple-950/80 text-purple-300 border border-purple-500/30'
                          }`}
                        >
                          {t.paymentMode}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                          {t.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      </div>
    </div>
  );
}
