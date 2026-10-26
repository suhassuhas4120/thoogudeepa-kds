'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  Calendar,
  ChevronDown,
  Download,
  Search,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import ManagerTopNav from '@/components/ManagerTopNav';

interface TransactionRow {
  billNumber: string;
  date: string;
  orderType: string;
  seatNumberOrToken: string;
  customerName: string;
  serverName: string;
  itemsSummary: string;
  placedAt: string;
  settledAt: string;
  subtotal: number;
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

const DEFAULT_ITEM_PERFORMANCE: ItemPerformanceRow[] = [
  { dishName: 'Chicken Donne Biryani', category: 'Donne Biryani', qtySold: 48, unitPrice: 220, totalRevenue: 10560, contributionPercent: 38.0 },
  { dishName: 'Mutton Donne Biryani', category: 'Donne Biryani', qtySold: 22, unitPrice: 310, totalRevenue: 6820, contributionPercent: 24.5 },
  { dishName: 'Guntur Chicken Fry', category: 'Starters', qtySold: 31, unitPrice: 180, totalRevenue: 5580, contributionPercent: 20.1 },
  { dishName: 'Chilli Chicken', category: 'Starters', qtySold: 14, unitPrice: 190, totalRevenue: 2660, contributionPercent: 9.6 },
  { dishName: 'Parotta', category: 'Breads', qtySold: 45, unitPrice: 35, totalRevenue: 1575, contributionPercent: 5.7 },
  { dishName: 'Thums Up 250ml', category: 'Beverages', qtySold: 32, unitPrice: 40, totalRevenue: 1280, contributionPercent: 4.6 },
];

const DEFAULT_TRANSACTIONS: TransactionRow[] = [
  {
    billNumber: 'INV-101',
    date: '25-10-2026',
    orderType: 'Dine-in',
    seatNumberOrToken: 'S1',
    customerName: 'Rahul',
    serverName: 'Suhas',
    itemsSummary: '1x Biryani, 2x Kabab',
    placedAt: '12:20 PM',
    settledAt: '12:48 PM',
    subtotal: 552.0,
    gst5Percent: 28.0,
    grandTotal: 580.0,
    paymentMode: 'Cash',
    paymentStatus: 'PAID',
  },
  {
    billNumber: 'INV-102',
    date: '25-10-2026',
    orderType: 'Dine-in',
    seatNumberOrToken: 'S3',
    customerName: 'Priya',
    serverName: 'Suhas',
    itemsSummary: '1x Biryani, 1x Fry, 2x P',
    placedAt: '12:15 PM',
    settledAt: '12:44 PM',
    subtotal: 520.0,
    gst5Percent: 26.0,
    grandTotal: 546.0,
    paymentMode: 'UPI',
    paymentStatus: 'PAID',
  },
  {
    billNumber: 'INV-103',
    date: '25-10-2026',
    orderType: 'Takeaway',
    seatNumberOrToken: 'P-48',
    customerName: 'Ramesh',
    serverName: 'Manager',
    itemsSummary: '2x Biryani, 1x Chilli',
    placedAt: '12:35 PM',
    settledAt: '12:41 PM',
    subtotal: 680.0,
    gst5Percent: 34.0,
    grandTotal: 714.0,
    paymentMode: 'Cash',
    paymentStatus: 'PAID',
  },
  {
    billNumber: 'INV-104',
    date: '25-10-2026',
    orderType: 'Dine-in',
    seatNumberOrToken: 'S10',
    customerName: 'Arun',
    serverName: 'Shiva',
    itemsSummary: '1x Biryani, 1x Chops',
    placedAt: '12:22 PM',
    settledAt: '12:50 PM',
    subtotal: 590.0,
    gst5Percent: 30.0,
    grandTotal: 620.0,
    paymentMode: 'UPI',
    paymentStatus: 'PAID',
  },
  {
    billNumber: 'INV-105',
    date: '25-10-2026',
    orderType: 'Takeaway',
    seatNumberOrToken: 'P-49',
    customerName: 'Sneha',
    serverName: 'Manager',
    itemsSummary: '1x Mutton Biryani',
    placedAt: '12:40 PM',
    settledAt: '12:45 PM',
    subtotal: 310.0,
    gst5Percent: 15.5,
    grandTotal: 325.5,
    paymentMode: 'UPI',
    paymentStatus: 'PAID',
  },
];

export default function MasterSalesReportPage() {
  const [selectedDate, setSelectedDate] = useState('25-Oct-2026');
  const [transactions, setTransactions] = useState<TransactionRow[]>(DEFAULT_TRANSACTIONS);
  const [itemPerformance, setItemPerformance] = useState<ItemPerformanceRow[]>(DEFAULT_ITEM_PERFORMANCE);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch live from server API
  useEffect(() => {
    fetch('/api/reports/master-sales?date=25-10-2026')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.records && data.data.records.length > 0) {
          const mapped: TransactionRow[] = data.data.records.map((r: any) => ({
            billNumber: r.billNumber,
            date: r.date || '25-10-2026',
            orderType: r.orderType,
            seatNumberOrToken: r.seatNumberOrToken || (r.seatId ? `S${r.seatId}` : 'P-Desk'),
            customerName: r.customerName || '-',
            serverName: r.serverName || 'Staff',
            itemsSummary: r.itemsSummary || 'Food items',
            placedAt: r.placedAt || '12:00 PM',
            settledAt: r.settledAt || '12:30 PM',
            subtotal: r.subtotal,
            gst5Percent: r.gst5Percent,
            grandTotal: r.grandTotal,
            paymentMode: r.paymentMode,
            paymentStatus: r.paymentStatus || 'PAID',
          }));
          setTransactions(mapped);
        }
      })
      .catch(console.error);

    // Fetch live items if available
    fetch('/api/reports/item-wise')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.report && data.data.report.length > 0) {
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
  }, []);

  // Filtered transactions
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

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Financial Summary
    const summaryData = [
      ['THOOGUDEEPA DONNE BIRYANI MANE - MASTER FINANCIAL REPORT'],
      ['Date:', selectedDate],
      [],
      ['Metric', 'Amount (₹) / Details'],
      ['Gross Food Sales', '₹26,450.00'],
      ['Total GST (5%)', '₹1,322.50'],
      ['Net Day Revenue', '₹27,790.00'],
      ['Dine-in Sales (16 Seats)', '₹19,370.00'],
      ['Takeaway / Parcel Sales', '₹8,420.00'],
      ['Total Orders Completed', '60 (42 Dine-in, 18 Parcel)'],
      ['Payment Split - Cash', '₹10,450 (37.6%)'],
      ['Payment Split - UPI', '₹15,240 (54.8%)'],
      ['Payment Split - Card POS', '₹2,100 (7.6%)'],
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
        'TYPE',
        'SEAT',
        'CUSTOMER NAME',
        'SERVER',
        'ITEMS SUMMARY',
        'PLACED',
        'SETTLED',
        'SUBTOT (₹)',
        'GST 5% (₹)',
        'GRAND TOT (₹)',
        'MODE',
        'STATUS',
      ],
      ...transactions.map((t) => [
        t.billNumber,
        t.date,
        t.orderType,
        t.seatNumberOrToken,
        t.customerName,
        t.serverName,
        t.itemsSummary,
        t.placedAt,
        t.settledAt,
        t.subtotal,
        t.gst5Percent,
        t.grandTotal,
        t.paymentMode,
        t.paymentStatus,
      ]),
    ];
    const wsTx = XLSX.utils.aoa_to_sheet(txData);
    XLSX.utils.book_append_sheet(wb, wsTx, 'Transaction Audit');

    XLSX.writeFile(wb, `Thoogudeepa_Master_Sales_Report_${selectedDate}.xlsx`);
  };

  // Export to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('THOOGUDEEPA DONNE BIRYANI MANE', 14, 15);
    doc.setFontSize(10);
    doc.text(`MASTER FINANCIAL & DETAILED SALES REPORT — ${selectedDate}`, 14, 21);

    // 1. Summary Box
    doc.setDrawColor(70, 70, 70);
    doc.setFillColor(240, 240, 240);
    doc.rect(14, 25, 269, 22, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Gross Food Sales: Rs. 26,450.00   |   Total GST (5%): Rs. 1,322.50   |   Net Day Revenue: Rs. 27,790.00', 18, 31);
    doc.text('Dine-in Sales (16 Seats): Rs. 19,370.00   |   Takeaway / Parcel Sales: Rs. 8,420.00   |   Total Orders: 60', 18, 37);
    doc.text('Payment Split: Cash Rs. 10,450 (37.6%)  *  UPI Rs. 15,240 (54.8%)  *  Card POS Rs. 2,100 (7.6%)', 18, 43);

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

    itemPerformance.forEach((i) => {
      doc.text(i.dishName, 16, y + 4.5);
      doc.text(i.category, 80, y + 4.5);
      doc.text(String(i.qtySold), 140, y + 4.5);
      doc.text(`Rs. ${i.unitPrice.toFixed(2)}`, 175, y + 4.5);
      doc.text(`Rs. ${i.totalRevenue.toFixed(2)}`, 215, y + 4.5);
      doc.text(`${i.contributionPercent}%`, 255, y + 4.5);
      y += 5.5;
    });

    // 3. Transactions Table
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('3. MASTER DETAILED TRANSACTION AUDIT (MAXIMUM COLUMNS)', 14, y);

    y += 4;
    doc.setFontSize(6.5);
    doc.setFillColor(40, 40, 40);
    doc.rect(14, y, 269, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('BILL #', 16, y + 4.2);
    doc.text('DATE', 32, y + 4.2);
    doc.text('TYPE', 48, y + 4.2);
    doc.text('SEAT', 62, y + 4.2);
    doc.text('CUSTOMER NAME', 74, y + 4.2);
    doc.text('SERVER', 106, y + 4.2);
    doc.text('ITEMS SUMMARY', 122, y + 4.2);
    doc.text('PLACED', 180, y + 4.2);
    doc.text('SETTLED', 195, y + 4.2);
    doc.text('SUBTOT', 210, y + 4.2);
    doc.text('GST 5%', 225, y + 4.2);
    doc.text('GRAND TOT', 242, y + 4.2);
    doc.text('MODE', 260, y + 4.2);
    doc.text('STATUS', 272, y + 4.2);

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    y += 6;

    transactions.forEach((t) => {
      doc.text(t.billNumber, 16, y + 4.2);
      doc.text(t.date, 32, y + 4.2);
      doc.text(t.orderType, 48, y + 4.2);
      doc.text(t.seatNumberOrToken, 62, y + 4.2);
      doc.text(t.customerName, 74, y + 4.2);
      doc.text(t.serverName, 106, y + 4.2);
      doc.text(t.itemsSummary.substring(0, 30), 122, y + 4.2);
      doc.text(t.placedAt, 180, y + 4.2);
      doc.text(t.settledAt, 195, y + 4.2);
      doc.text(`Rs. ${t.subtotal.toFixed(0)}`, 210, y + 4.2);
      doc.text(`Rs. ${t.gst5Percent.toFixed(0)}`, 225, y + 4.2);
      doc.text(`Rs. ${t.grandTotal.toFixed(0)}`, 242, y + 4.2);
      doc.text(t.paymentMode, 260, y + 4.2);
      doc.text(t.paymentStatus, 272, y + 4.2);
      y += 5;
    });

    doc.save(`Thoogudeepa_Master_Sales_Report_${selectedDate}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#100E0C] text-stone-100 flex flex-col font-mono text-xs select-none">
      {/* Shared Manager Top Navigation */}
      <ManagerTopNav activeTab="reports" />

      {/* Subheader Bar with Title & Export Actions */}
      <div className="bg-[#141210] border-b border-[#2C2520] px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xs md:text-sm font-black text-[#D08A52] uppercase tracking-wider font-sans">
          MASTER FINANCIAL & DETAILED SALES REPORT
        </h1>

        {/* Filter & Export Buttons */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#181513] border border-[#2C2520] rounded-lg text-amber-400 font-bold text-xs">
            <span>Filter:</span>
            <span className="text-white bg-[#100E0C] px-2 py-0.5 rounded border border-[#2C2520]">
              Today: {selectedDate} ▾
            </span>
          </div>

          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-xs transition shadow active:scale-95"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>📥 Download as PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs transition shadow active:scale-95"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>📊 Download as Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="p-6 space-y-6 flex-1 max-w-[1600px] w-full mx-auto">
        {/* 1. COMPLETE FINANCIAL SUMMARY BREAKDOWN */}
        <section className="bg-[#181513] border border-[#2C2520] rounded-xl overflow-hidden shadow-xl">
          <div className="bg-[#1C1815] px-4 py-2.5 border-b border-[#2C2520] font-bold text-amber-400 uppercase tracking-wider text-xs">
            1. COMPLETE FINANCIAL SUMMARY BREAKDOWN
          </div>
          <div className="p-4 space-y-3 font-sans text-xs">
            {/* Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-3 border-b border-[#2C2520]">
              <div>
                <span className="text-stone-400">Gross Food Sales:</span>{' '}
                <strong className="text-white text-sm font-mono">₹26,450.00</strong>
              </div>
              <div>
                <span className="text-stone-400">Total GST (5%):</span>{' '}
                <strong className="text-sky-400 text-sm font-mono">₹1,322.50</strong>
              </div>
              <div>
                <span className="text-stone-400">Net Day Revenue:</span>{' '}
                <strong className="text-emerald-400 text-sm font-mono">₹27,790.00</strong>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-3 border-b border-[#2C2520]">
              <div>
                <span className="text-stone-400">Dine-in Sales (16 Seats):</span>{' '}
                <strong className="text-white text-sm font-mono">₹19,370.00</strong>
              </div>
              <div>
                <span className="text-stone-400">Takeaway / Parcel Sales:</span>{' '}
                <strong className="text-amber-400 text-sm font-mono">₹8,420.00</strong>
              </div>
              <div>
                <span className="text-stone-400">Total Orders Completed:</span>{' '}
                <strong className="text-white text-sm font-mono">60</strong>{' '}
                <span className="text-stone-400 text-[11px]">(42 Dine-in, 18 Parcel)</span>
              </div>
            </div>

            {/* Row 3 */}
            <div className="text-xs text-stone-300 flex flex-wrap items-center gap-2">
              <span className="text-stone-400 font-bold">Payment Split:</span>
              <span className="bg-[#1C1815] px-2.5 py-1 rounded border border-[#2C2520]">
                💵 Cash: <strong className="text-amber-400">₹10,450 (37.6%)</strong>
              </span>
              <span>•</span>
              <span className="bg-[#1C1815] px-2.5 py-1 rounded border border-[#2C2520]">
                📱 UPI: <strong className="text-cyan-400">₹15,240 (54.8%)</strong>
              </span>
              <span>•</span>
              <span className="bg-[#1C1815] px-2.5 py-1 rounded border border-[#2C2520]">
                💳 Card POS: <strong className="text-purple-400">₹2,100 (7.6%)</strong>
              </span>
            </div>
          </div>
        </section>

        {/* 2. ITEM-WISE SALES PERFORMANCE */}
        <section className="bg-[#181513] border border-[#2C2520] rounded-xl overflow-hidden shadow-xl">
          <div className="bg-[#1C1815] px-4 py-2.5 border-b border-[#2C2520] font-bold text-cyan-400 uppercase tracking-wider text-xs flex justify-between items-center">
            <span>2. ITEM-WISE SALES PERFORMANCE</span>
            <span className="text-[11px] text-stone-400 font-normal">Top Revenue Contributors</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead className="bg-[#100E0C] text-stone-400 border-b border-[#2C2520] font-bold uppercase text-[11px]">
                <tr>
                  <th className="p-3 border-r border-[#2C2520]">DISH NAME</th>
                  <th className="p-3 border-r border-[#2C2520]">CATEGORY</th>
                  <th className="p-3 border-r border-[#2C2520] text-right">QTY SOLD</th>
                  <th className="p-3 border-r border-[#2C2520] text-right">UNIT PRICE</th>
                  <th className="p-3 border-r border-[#2C2520] text-right">TOTAL REVENUE (₹)</th>
                  <th className="p-3 text-right">CONTRIBUTION %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2C2520] font-mono text-xs">
                {itemPerformance.map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#201B18] transition-colors">
                    <td className="p-3 font-sans font-bold text-white border-r border-[#2C2520]">
                      {row.dishName}
                    </td>
                    <td className="p-3 font-sans text-stone-300 border-r border-[#2C2520]">
                      {row.category}
                    </td>
                    <td className="p-3 text-right text-white font-bold border-r border-[#2C2520]">
                      {row.qtySold}
                    </td>
                    <td className="p-3 text-right text-stone-300 border-r border-[#2C2520]">
                      ₹{row.unitPrice.toFixed(2)}
                    </td>
                    <td className="p-3 text-right text-emerald-400 font-bold border-r border-[#2C2520]">
                      ₹{row.totalRevenue.toFixed(2)}
                    </td>
                    <td className="p-3 text-right text-amber-400 font-bold">
                      {row.contributionPercent.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. MASTER DETAILED TRANSACTION AUDIT (MAXIMUM COLUMNS) */}
        <section className="bg-[#181513] border border-[#2C2520] rounded-xl overflow-hidden shadow-xl">
          <div className="bg-[#1C1815] px-4 py-2.5 border-b border-[#2C2520] flex flex-wrap items-center justify-between gap-3">
            <span className="font-bold text-emerald-400 uppercase tracking-wider text-xs">
              3. MASTER DETAILED TRANSACTION AUDIT (MAXIMUM COLUMNS)
            </span>
            <div className="relative w-72">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Bill #, Guest, Server or Mode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#100E0C] border border-[#2C2520] rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#8A4228] font-sans"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#100E0C] text-stone-400 border-b border-[#2C2520] font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5 border-r border-[#2C2520]">BILL #</th>
                  <th className="p-2.5 border-r border-[#2C2520]">DATE</th>
                  <th className="p-2.5 border-r border-[#2C2520]">TYPE</th>
                  <th className="p-2.5 border-r border-[#2C2520]">SEAT</th>
                  <th className="p-2.5 border-r border-[#2C2520]">CUSTOMER NAME</th>
                  <th className="p-2.5 border-r border-[#2C2520]">SERVER</th>
                  <th className="p-2.5 border-r border-[#2C2520]">ITEMS SUMMARY</th>
                  <th className="p-2.5 border-r border-[#2C2520]">PLACED</th>
                  <th className="p-2.5 border-r border-[#2C2520]">SETTLED</th>
                  <th className="p-2.5 border-r border-[#2C2520] text-right">SUBTOT</th>
                  <th className="p-2.5 border-r border-[#2C2520] text-right">GST 5%</th>
                  <th className="p-2.5 border-r border-[#2C2520] text-right">GRAND TOT</th>
                  <th className="p-2.5 border-r border-[#2C2520] text-center">MODE</th>
                  <th className="p-2.5 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2C2520] font-mono text-[11px]">
                {filtered.map((t, idx) => (
                  <tr key={idx} className="hover:bg-[#201B18] transition-colors">
                    <td className="p-2.5 font-bold text-amber-400 border-r border-[#2C2520] whitespace-nowrap">
                      {t.billNumber}
                    </td>
                    <td className="p-2.5 text-stone-400 border-r border-[#2C2520] whitespace-nowrap">
                      {t.date}
                    </td>
                    <td className="p-2.5 font-sans border-r border-[#2C2520]">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          t.orderType.toLowerCase().includes('dine')
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {t.orderType}
                      </span>
                    </td>
                    <td className="p-2.5 font-bold text-white border-r border-[#2C2520]">
                      {t.seatNumberOrToken}
                    </td>
                    <td className="p-2.5 font-sans font-bold text-stone-100 border-r border-[#2C2520] whitespace-nowrap">
                      {t.customerName}
                    </td>
                    <td className="p-2.5 font-sans text-stone-300 border-r border-[#2C2520]">
                      {t.serverName}
                    </td>
                    <td className="p-2.5 font-sans text-stone-300 border-r border-[#2C2520] max-w-xs truncate">
                      {t.itemsSummary}
                    </td>
                    <td className="p-2.5 text-stone-400 border-r border-[#2C2520]">
                      {t.placedAt}
                    </td>
                    <td className="p-2.5 text-stone-300 border-r border-[#2C2520]">
                      {t.settledAt}
                    </td>
                    <td className="p-2.5 text-right text-stone-300 border-r border-[#2C2520]">
                      ₹{t.subtotal.toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right text-sky-400 border-r border-[#2C2520]">
                      ₹{t.gst5Percent.toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right font-black text-emerald-400 border-r border-[#2C2520]">
                      ₹{t.grandTotal.toFixed(2)}
                    </td>
                    <td className="p-2.5 text-center font-sans border-r border-[#2C2520]">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          t.paymentMode.toLowerCase() === 'upi'
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : t.paymentMode.toLowerCase() === 'cash'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-purple-500/20 text-purple-400'
                        }`}
                      >
                        {t.paymentMode}
                      </span>
                    </td>
                    <td className="p-2.5 text-center font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {t.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}