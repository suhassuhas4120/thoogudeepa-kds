'use client';

import React from 'react';
import { Palette } from 'lucide-react';
import { CustomerTheme } from '@/lib/useCustomerTheme';

interface ThemeToggleProps {
  theme: CustomerTheme;
  toggleTheme: () => void;
}

export function ThemeToggle({ theme, toggleTheme }: ThemeToggleProps) {
  const isOrange = theme === 'burnt-orange';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={`Switch to ${isOrange ? 'Royal Emerald' : 'Burnt Orange & Cream'} Theme`}
      className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black border transition active:scale-95 shadow-sm ${
        isOrange
          ? 'bg-[#F3DFCC] border-[#D08A52]/50 text-[#8A4228] hover:bg-[#ebd3bd]'
          : 'bg-[#082218] border-emerald-500/40 text-amber-300 hover:bg-[#0c3124]'
      }`}
    >
      <Palette className="w-3 h-3 flex-shrink-0" />
      <span>{isOrange ? 'Cream' : 'Emerald'}</span>
    </button>
  );
}
