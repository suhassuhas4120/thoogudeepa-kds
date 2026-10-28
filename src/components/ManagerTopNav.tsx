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
    <header className="h-14 bg-white border-b border-stone-200 px-6 flex items-center justify-between shrink-0 select-none">
      {/* Brand Badge */}
      <Link href="/manager/floor" className="flex items-center gap-2 group">
        <div className="w-8 h-8 rounded-full border border-stone-200 overflow-hidden flex items-center justify-center p-0.5 bg-stone-50 shadow-xs">
          <img
            src="/logo.jpg"
            alt="Thoogudeepa"
            className="w-full h-full object-cover rounded-full"
            onError={(e) => {
              const target = e.target as HTMLElement;
              target.style.display = 'none';
            }}
          />
        </div>
        <span className="font-bold text-xs tracking-wider text-[#8A4228] uppercase">
          MANAGER
        </span>
      </Link>

      {/* Navigation Tabs matching exact thoogudeepa-v2 specification */}
      <nav className="flex items-center gap-2 text-xs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-[#8A4228] text-white shadow-xs'
                  : 'bg-white border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50'
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
          className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"
          title="Live WebSocket & Cloud DB Connected"
        />
        <Link
          href="/manager"
          className="text-xs text-stone-500 hover:text-rose-600 transition-colors font-medium flex items-center gap-1"
        >
          Logout
        </Link>
      </div>
    </header>
  );
}
