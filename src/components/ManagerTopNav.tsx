'use client';

import React from 'react';
import Link from 'next/link';

export type ManagerTab =
  | 'floor'
  | 'orders'
  | 'parcel'
  | 'menu'
  | 'qrs'
  | 'shift'
  | 'reports'
  | 'promos';

interface ManagerTopNavProps {
  activeTab: ManagerTab;
  extraRightActions?: React.ReactNode;
}

export default function ManagerTopNav({ activeTab, extraRightActions }: ManagerTopNavProps) {
  const tabs = [
    { id: 'floor', label: 'Live Floor', href: '/manager/floor' },
    { id: 'orders', label: 'Orders', href: '/manager/kitchen' },
    { id: 'parcel', label: 'Parcel', href: '/manager/parcel' },
    { id: 'menu', label: 'Menu', href: '/manager/menu' },
    { id: 'qrs', label: 'QRs', href: '/manager/qrs' },
    { id: 'shift', label: 'Shift', href: '/manager/shift' },
    { id: 'reports', label: 'Sales Report', href: '/manager/reports' },
    { id: 'promos', label: 'Promos', href: '/manager/promos' },
  ];

  return (
    <header className="h-14 bg-[#181513] border-b border-[#2C2520] px-6 flex items-center justify-between shrink-0 select-none">
      {/* Brand Badge */}
      <Link href="/manager/floor" className="flex items-center gap-2 group">
        <span className="text-base">🏨</span>
        <span className="font-black text-sm tracking-widest text-[#D08A52] uppercase group-hover:text-amber-400 transition-colors">
          THOOGUDEEPA
        </span>
      </Link>

      {/* Navigation Tabs matching exact ASCII & Floor specification */}
      <nav className="flex items-center gap-1.5 bg-[#100E0C] p-1 rounded-xl border border-[#2C2520] text-xs font-bold">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                isActive
                  ? 'bg-[#8A4228] text-white shadow-sm font-black'
                  : 'text-stone-400 hover:text-white hover:bg-[#181513]'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Right side status & actions */}
      <div className="flex items-center gap-3">
        {extraRightActions}
        <span
          className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50"
          title="Live WebSocket & Cloud DB Connected"
        />
        <Link
          href="/manager"
          className="text-xs text-stone-400 hover:text-rose-400 transition-colors font-medium flex items-center gap-1"
        >
          Logout
        </Link>
      </div>
    </header>
  );
}
