import Link from 'next/link';
import { Utensils, ChefHat, Smartphone, Tablet, ShieldCheck, QrCode } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-900 text-white p-6 max-w-5xl mx-auto flex flex-col justify-center">
      <div className="text-center mb-10">
        <div className="w-24 h-24 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center mx-auto mb-4 text-3xl font-bold text-amber-400 shadow-lg shadow-amber-500/20">
          LOGO
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-amber-400">
          THOOGUDEEPA DONNE BIRYANI MANE
        </h1>
        <p className="mt-2 text-slate-400 text-sm sm:text-base">
          16-Seat Complete QR Dining, Kitchen KDS, Waiter Mobility & Executive Manager Operations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Customer Portal */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 hover:border-amber-500/50 transition">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center mb-3">
            <QrCode className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-lg text-white">Customer Seats</h2>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            Seats 1 to 16. Scan QR, browse menu, combos, cart, live tracking & bill.
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: 16 }, (_, i) => i + 1).map((seat) => (
              <Link
                key={seat}
                href={`/seat/${seat}`}
                className="py-1.5 text-center text-xs font-semibold bg-slate-700/60 hover:bg-amber-600 text-white rounded-lg transition"
              >
                S{seat}
              </Link>
            ))}
          </div>
        </div>

        {/* Kitchen KDS */}
        <Link
          href="/kitchen"
          className="bg-slate-800 border border-slate-700 rounded-2xl p-5 hover:border-emerald-500/50 transition flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
              <ChefHat className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-lg text-white">Kitchen Display (KDS)</h2>
            <p className="text-xs text-slate-400 mt-1">
              3-Column Board (Received, Cooking, Ready) with exact Order Placed Time & audio chimes.
            </p>
          </div>
          <span className="mt-6 inline-flex items-center text-xs font-bold text-emerald-400">
            Open Kitchen KDS →
          </span>
        </Link>

        {/* Waiters */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 hover:border-blue-500/50 transition flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
              <Smartphone className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-lg text-white">Waiter Terminals</h2>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Strict zone isolation with audio/vibration alerts.
            </p>
            <div className="space-y-2">
              <Link
                href="/waiter/suhas"
                className="block p-2.5 bg-slate-700/60 hover:bg-blue-600 rounded-xl text-xs font-semibold transition"
              >
                🤵 Suhas Mobile (Seats 1 – 8)
              </Link>
              <Link
                href="/waiter/shiva"
                className="block p-2.5 bg-slate-700/60 hover:bg-cyan-600 rounded-xl text-xs font-semibold transition"
              >
                📟 Shiva Tablet (Seats 9 – 16)
              </Link>
            </div>
          </div>
        </div>

        {/* Manager Portal */}
        <Link
          href="/manager"
          className="bg-slate-800 border border-slate-700 rounded-2xl p-5 hover:border-purple-500/50 transition flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-lg text-white">Executive Manager</h2>
            <p className="text-xs text-slate-400 mt-1">
              Executive Floor Map, Right-Side Vacate, Parcel Billing Desk, Shift Audit, Sales Reports & Promos.
            </p>
          </div>
          <span className="mt-6 inline-flex items-center text-xs font-bold text-purple-400">
            Enter Manager Portal →
          </span>
        </Link>
      </div>

      <div className="mt-12 text-center text-xs text-slate-500 border-t border-slate-800 pt-6">
        THOOGUDEEPA DONNE BIRYANI MANE • Master Operations System • SQLite WAL Mode Active
      </div>
    </main>
  );
}
