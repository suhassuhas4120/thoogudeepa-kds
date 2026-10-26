'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Download, ArrowLeft } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useCustomerTheme } from '@/lib/useCustomerTheme';
import { ThemeToggle } from '@/components/ThemeToggle';
import CustomerBottomNav from '@/components/CustomerBottomNav';

interface OrderItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
}

export default function CustomerScreen7({ params }: { params: { seatId: string } }) {
  const seatId = parseInt(params.seatId, 10);
  const { theme, toggleTheme } = useCustomerTheme();
  const isOrange = theme === 'burnt-orange';

  const [customerName, setCustomerName] = useState('-');
  const [billNumber, setBillNumber] = useState('INV-101');
  const [dateStr, setDateStr] = useState('25-10-2026');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [gst, setGst] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);

  useEffect(() => {
    fetch(`/api/seats/${seatId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const sess = data.data.activeSession;
          if (sess) {
            setCustomerName(sess.customerName || '-');
            setSubtotal(sess.subtotal || 0);
            setDiscount(sess.discountAmount || 0);
            setGst(sess.gstAmount || 0);
            setGrandTotal(sess.grandTotal || 0);

            const allItems: OrderItem[] = [];
            sess.orderTickets?.forEach((t: { items: OrderItem[] }) => {
              t.items.forEach((it) => allItems.push(it));
            });
            setItems(allItems);
          }
        }
      });

    const now = new Date();
    setDateStr(now.toLocaleDateString('en-GB').replace(/\//g, '-'));
    setBillNumber(`INV-${100 + seatId}`);
  }, [seatId]);

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF({
        unit: 'mm',
        format: [80, 160],
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('THOOGUDEEPA', 40, 12, { align: 'center' });
      doc.setFontSize(8);
      doc.text('DONNE BIRYANI MANE', 40, 16, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.text('------------------------------------------------', 40, 20, { align: 'center' });

      doc.setFontSize(8);
      doc.text(`TAX INVOICE - SEAT ${seatId}`, 40, 24, { align: 'center' });
      doc.text(`Bill: ${billNumber}  |  Date: ${dateStr}`, 40, 28, { align: 'center' });
      doc.text(`Guest: ${customerName}`, 40, 32, { align: 'center' });
      doc.text('------------------------------------------------', 40, 35, { align: 'center' });

      let y = 40;
      doc.setFont('helvetica', 'bold');
      doc.text('ITEM', 8, y);
      doc.text('QTY', 52, y);
      doc.text('TOTAL', 72, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      y += 4;

      items.forEach((it) => {
        const itemTotal = (it.unitPrice * it.quantity).toFixed(0);
        doc.text(`${it.itemName.substring(0, 18)}`, 8, y);
        doc.text(`${it.quantity}`, 54, y);
        doc.text(`Rs.${itemTotal}`, 72, y, { align: 'right' });
        y += 4;
      });

      y += 2;
      doc.text('------------------------------------------------', 40, y, { align: 'center' });
      y += 5;

      doc.text('Subtotal:', 8, y);
      doc.text(`Rs.${subtotal.toFixed(2)}`, 72, y, { align: 'right' });
      y += 4;

      if (discount > 0) {
        doc.text('Promo Discount:', 8, y);
        doc.text(`-Rs.${discount.toFixed(2)}`, 72, y, { align: 'right' });
        y += 4;
      }

      doc.text('GST (5%):', 8, y);
      doc.text(`Rs.${gst.toFixed(2)}`, 72, y, { align: 'right' });
      y += 5;

      doc.setFont('helvetica', 'bold');
      doc.text('GRAND TOTAL:', 8, y);
      doc.text(`Rs.${grandTotal.toFixed(2)}`, 72, y, { align: 'right' });
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.text('Thank You, Visit Again!', 40, y, { align: 'center' });
      y += 4;
      doc.text('Thoogudeepa Donne Biryani Mane', 40, y, { align: 'center' });

      doc.save(`Thoogudeepa_Seat${seatId}_Bill.pdf`);
    } catch (e) {
      console.error(e);
      window.print();
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between p-4 pb-24 max-w-md mx-auto font-sans select-none relative transition-colors duration-300 ${
        isOrange ? 'bg-[#FFFCF7] text-[#5B5049]' : 'bg-gradient-to-b from-[#04120d] via-[#081e16] to-[#04110c] text-white'
      }`}
    >
      {/* Top Header */}
      <div>
        <header
          className={`flex items-center justify-between pb-3 border-b ${
            isOrange ? 'border-[#E8D5C3]' : 'border-emerald-500/20'
          }`}
        >
          <Link
            href={`/seat/${seatId}/menu`}
            className={`flex items-center gap-1.5 text-xs font-black transition ${
              isOrange ? 'text-[#8A4228] hover:text-[#71351F]' : 'text-amber-400 hover:text-amber-300'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Menu</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
            <div className="text-right">
              <span className={`text-xs font-black ${isOrange ? 'text-[#8A4228]' : 'text-amber-400'}`}>
                SEAT {String(seatId).padStart(2, '0')}
              </span>
              <p className={`text-[9px] ${isOrange ? 'text-[#5B5049]/70' : 'text-emerald-300'}`}>Official Receipt</p>
            </div>
          </div>
        </header>

        {/* Paper Bill Card */}
        <div
          className={`mt-4 rounded-3xl p-6 shadow-xl relative overflow-hidden border ${
            isOrange
              ? 'bg-[#FFFCF7] text-[#5B5049] border-[#E8D5C3]'
              : 'bg-[#fcfdfa] text-slate-900 border-amber-400/40'
          }`}
        >
          {/* Top Ribbon */}
          <div
            className={`absolute top-0 left-0 right-0 h-1.5 ${
              isOrange
                ? 'bg-gradient-to-r from-[#D08A52] via-[#8A4228] to-[#D08A52]'
                : 'bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500'
            }`}
          />

          {/* Top Receipt Details */}
          <div className="text-center pb-4 border-b border-dashed border-[#E8D5C3] pt-1">
            <h2
              className={`font-black text-xl tracking-wider ${
                isOrange ? 'text-[#8A4228]' : 'text-slate-950'
              }`}
            >
              THOOGUDEEPA
            </h2>
            <p
              className={`text-[10px] font-black uppercase tracking-widest ${
                isOrange ? 'text-[#D08A52]' : 'text-emerald-800'
              }`}
            >
              DONNE BIRYANI MANE
            </p>
            <p className="text-[9px] text-[#5B5049]/70 font-medium">ತೂಗುದೀಪ ದೊನ್ನೆ ಬಿರಿಯಾನಿ ಮನೆ</p>
            <div className="mt-2 text-xs font-bold text-[#5B5049]">
              TAX INVOICE • SEAT {seatId} • {billNumber}
            </div>
            <div className="text-[11px] text-[#5B5049]/70 mt-0.5">
              Date: {dateStr} • Guest: {customerName}
            </div>
          </div>

          {/* Itemized Table */}
          <div className="py-4 space-y-2 border-b border-dashed border-[#E8D5C3] font-mono">
            {items.length === 0 ? (
              <div className="py-2 text-center text-xs text-[#5B5049]/40 font-sans">No items on record</div>
            ) : (
              items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#5B5049]">
                    {it.quantity}x {it.itemName}
                  </span>
                  <span className={`font-black ${isOrange ? 'text-[#D92D20]' : 'text-slate-950'}`}>
                    ₹{(it.unitPrice * it.quantity).toFixed(0)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Calculations */}
          <div className="py-3 space-y-1.5 text-xs text-[#5B5049]/80 border-b border-dashed border-[#E8D5C3]">
            <div className="flex justify-between">
              <span>Food Subtotal:</span>
              <span className="font-bold text-[#5B5049]">₹{subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-[#198754] font-bold">
                <span>Promo Discount:</span>
                <span>-₹{discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>CGST (2.5%) + SGST (2.5%):</span>
              <span className="font-bold text-[#5B5049]">₹{gst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-black pt-2 border-t border-[#E8D5C3]">
              <span className={isOrange ? 'text-[#5B5049]' : 'text-slate-950'}>Grand Total:</span>
              <span className={`text-lg font-black ${isOrange ? 'text-[#8A4228]' : 'text-emerald-900'}`}>
                ₹{grandTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Footer Note */}
          <div className="pt-4 text-center">
            <div className={`text-sm font-black ${isOrange ? 'text-[#8A4228]' : 'text-slate-950'}`}>
              Thank You, Visit Again!
            </div>
            <p className="text-[10px] text-[#5B5049]/70 mt-0.5 font-sans">
              ಧನ್ಯವಾದಗಳು ಮತ್ತೊಮ್ಮೆ ಭೇಟಿ ನೀಡಿ
            </p>
          </div>
        </div>
      </div>

      {/* Download Bill Option */}
      <div className="pt-5 pb-2">
        <button
          type="button"
          onClick={handleDownloadPDF}
          className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl transition active:scale-98 select-none ${
            isOrange
              ? 'bg-[#8A4228] hover:bg-[#71351F] text-[#FFFCF7]'
              : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 border border-white/20'
          }`}
        >
          <Download className="w-4 h-4 stroke-[2.5]" />
          <span>DOWNLOAD BILL (PDF)</span>
        </button>
      </div>

      {/* Customer Persistent Bottom Navigation Dock */}
      <CustomerBottomNav seatId={seatId} activeTab="bill" />
    </div>
  );
}
