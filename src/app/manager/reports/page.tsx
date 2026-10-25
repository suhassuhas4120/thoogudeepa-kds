'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Download,
  Calendar,
  FileSpreadsheet,
  FileText,
  DollarSign,
  TrendingUp,
  Receipt,
  LogOut,
  Search
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

interface SalesRecord {
  id: string;
  billNumber: string;
  date: string;
  time: string;
  orderType: string;
  seatId?: number | null;
  customerName: string;
  subtotal: number;
  discountAmount: number;
  gst5Percent: number;
  grandTotal: number;
  paymentMode: string;
  settledBy: string;
  itemBreakdown?: string;
  createdAt: string;
}

interface FinancialSummary {
  grossFoodSales: number;
  totalGst: number;
  netDayRevenue: number;
  dineInSales: number;
  takeawaySales: number;
  totalOrders: number;
  dineInCount: number;
  takeawayCount: number;
  paymentSplit: {
    cash: number;
    upi: number;
    card: number;
  };
}

export default function ManagerReportsScreen() {
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>({
    grossFoodSales: 0,
    totalGst: 0,
    netDayRevenue: 0,
    dineInSales: 0,
    takeawaySales: 0,
    totalOrders: 0,
    dineInCount: 0,
    takeawayCount: 0,
    paymentSplit: { cash: 0, upi: 0, card: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchSalesData = async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/master-sales?date=${date}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.data.records);
        setSummary(data.data.summary);
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesData(selectedDate);
  }, [selectedDate]);

  // Download Excel (.xlsx)
  const handleExportExcel = () => {
    if (records.length === 0) {
      alert('No sales records to export for this date.');
      return;
    }

    const exportRows = records.map((r) => ({
      'Bill Number': r.billNumber,
      Date: r.date,
      Time: r.time,
      'Order Type': r.orderType,
      'Seat Number': r.seatId ? `Seat ${r.seatId}` : 'Parcel Takeaway',
      'Guest Name': r.customerName || '(-)',
      'Subtotal (₹)': r.subtotal.toFixed(2),
      'GST 5% (₹)': r.gst5Percent.toFixed(2),
      'Discount (₹)': r.discountAmount.toFixed(2),
      'Grand Total (₹)': r.grandTotal.toFixed(2),
      'Payment Mode': r.paymentMode,
      'Settled By': r.settledBy,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Sales Report');
    XLSX.writeFile(workbook, `Thoogudeepa_Sales_Report_${selectedDate}.xlsx`);
  };

  // Download PDF Report
  const handleExportPDF = () => {
    if (records.length === 0) {
      alert('No sales records to export for this date.');
      return;
    }

    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('THOOGUDEEPA DONNE BIRYANI MANE', 14, 18);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Official Master Sales Report - Date: ${selectedDate}`, 14, 25);
    doc.text(`Generated at: ${new Date().toLocaleTimeString()}`, 14, 30);

    // Summary Box
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(245, 245, 245);
    doc.rect(14, 34, 182, 24, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.text(`Gross Revenue: INR ${summary.netDayRevenue.toFixed(2)}`, 20, 42);
    doc.text(`GST (5%): INR ${summary.totalGst.toFixed(2)}`, 20, 50);
    doc.text(`Total Orders: ${summary.totalOrders}`, 110, 42);
    doc.text(`Cash: INR ${summary.paymentSplit.cash.toFixed(2)} | UPI: INR ${summary.paymentSplit.upi.toFixed(2)}`, 110, 50);

    // Table Header
    let y = 66;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Bill #', 14, y);
    doc.text('Time', 38, y);
    doc.text('Type', 58, y);
    doc.text('Seat/Cust', 82, y);
    doc.text('Mode', 125, y);
    doc.text('GST (5%)', 148, y);
    doc.text('Total (INR)', 175, y);

    doc.setDrawColor(180, 180, 180);
    doc.line(14, y + 2, 196, y + 2);
    y += 8;

    doc.setFont('helvetica', 'normal');
    records.slice(0, 30).forEach((r) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(r.billNumber, 14, y);
      doc.text(r.time, 38, y);
      doc.text(r.orderType === 'Dine-in' ? 'Dine-In' : 'Parcel', 58, y);
      doc.text(
        r.seatId ? `S${r.seatId} (${r.customerName || '-'})` : `P (${r.customerName || '-'})`,
        82,
        y
      );
      doc.text(r.paymentMode, 125, y);
      doc.text(r.gst5Percent.toFixed(2), 148, y);
      doc.text(r.grandTotal.toFixed(2), 175, y);
      y += 6.5;
    });

    doc.save(`Thoogudeepa_Sales_Report_${selectedDate}.pdf`);
  };

  const filteredRecords = records.filter((r) => {
    const q = searchTerm.toLowerCase();
    return (
      r.billNumber.toLowerCase().includes(q) ||
      (r.customerName && r.customerName.toLowerCase().includes(q)) ||
      r.paymentMode.toLowerCase().includes(q) ||
      (r.seatId && `seat ${r.seatId}`.includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none">
      {/* Executive Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white uppercase tracking-wider">
              THOOGUDEEPA DONNE BIRYANI
            </h1>
            <p className="text-[11px] text-purple-400 font-medium">Master Financial & Sales Reports</p>
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
          <Link href="/manager/qrs" className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white">
            QR Stands
          </Link>
          <Link href="/manager/shift" className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white">
            Shift Audit
          </Link>
          <Link href="/manager/parcel" className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white">
            Parcel Desk
          </Link>
          <Link href="/manager/reports" className="px-3 py-1.5 rounded-xl bg-purple-500 text-white shadow-sm">
            Reports
          </Link>
          <Link href="/manager/promos" className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white">
            Offers & Promos
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel (.xlsx)</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition shadow"
          >
            <FileText className="w-4 h-4" />
            <span>PDF Report</span>
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

      {/* Date Filter & KPI Ribbon */}
      <div className="p-6 pb-2 space-y-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
              <Calendar className="w-4 h-4 text-purple-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs text-white font-bold focus:outline-none"
              />
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Showing settled bills for {selectedDate}
            </span>
          </div>

          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Bill #, Guest or Mode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* 4 Financial Metric Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Gross Collection</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400">
              ₹{summary.netDayRevenue.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {summary.totalOrders} Settled Orders
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>GST 5% Liability</span>
              <Receipt className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-blue-400">
              ₹{summary.totalGst.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Food Subtotal: ₹{summary.grossFoodSales.toFixed(2)}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Payment Mode Split</span>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-sm font-black text-white space-y-0.5">
              <div className="flex justify-between">
                <span className="text-amber-400">UPI:</span>
                <span>₹{summary.paymentSplit.upi.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-400">Cash:</span>
                <span>₹{summary.paymentSplit.cash.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
              Channel Distribution
            </div>
            <div className="text-sm font-black text-white space-y-0.5">
              <div className="flex justify-between">
                <span className="text-purple-400">Dine-In (S1-S16):</span>
                <span>
                  {summary.dineInCount} (₹{summary.dineInSales.toFixed(0)})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-cyan-400">Parcel Desk:</span>
                <span>
                  {summary.takeawayCount} (₹{summary.takeawaySales.toFixed(0)})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Sales Records Table */}
      <div className="flex-1 p-6 pt-3 overflow-hidden flex flex-col">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-xl">
          <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
              Tax Invoices & Transaction Log ({filteredRecords.length})
            </h3>
            <span className="text-[11px] text-slate-500">
              All transactions locked with WAL persistence
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950/80 text-slate-400 sticky top-0 border-b border-slate-800">
                <tr>
                  <th className="p-3 font-bold">Bill #</th>
                  <th className="p-3 font-bold">Time</th>
                  <th className="p-3 font-bold">Channel</th>
                  <th className="p-3 font-bold">Seat / Guest</th>
                  <th className="p-3 font-bold">Mode</th>
                  <th className="p-3 font-bold text-right">Subtotal</th>
                  <th className="p-3 font-bold text-right">GST (5%)</th>
                  <th className="p-3 font-bold text-right">Discount</th>
                  <th className="p-3 font-bold text-right">Grand Total</th>
                  <th className="p-3 font-bold">Settled By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-500 font-sans">
                      No settled sales recorded for this date.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3 font-bold text-purple-400">{r.billNumber}</td>
                      <td className="p-3 text-slate-300">{r.time}</td>
                      <td className="p-3 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.orderType === 'Dine-in'
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-cyan-500/20 text-cyan-300'
                          }`}
                        >
                          {r.orderType}
                        </span>
                      </td>
                      <td className="p-3 font-sans text-white">
                        {r.seatId ? `Seat ${r.seatId}` : 'Parcel'} • {r.customerName || '(-)'}
                      </td>
                      <td className="p-3 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.paymentMode === 'UPI'
                              ? 'bg-blue-500/20 text-blue-300'
                              : r.paymentMode === 'CASH'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {r.paymentMode}
                        </span>
                      </td>
                      <td className="p-3 text-right text-slate-400">₹{r.subtotal.toFixed(2)}</td>
                      <td className="p-3 text-right text-blue-400">₹{r.gst5Percent.toFixed(2)}</td>
                      <td className="p-3 text-right text-amber-400">
                        {r.discountAmount > 0 ? `-₹${r.discountAmount.toFixed(2)}` : '₹0.00'}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-400 text-sm">
                        ₹{r.grandTotal.toFixed(2)}
                      </td>
                      <td className="p-3 font-sans text-slate-400">{r.settledBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
