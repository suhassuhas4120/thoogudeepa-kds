'use client';

import { useState, useEffect } from 'react';

export type CustomerTheme = 'burnt-orange' | 'royal-emerald';

export function useCustomerTheme() {
  const [theme, setTheme] = useState<CustomerTheme>('burnt-orange');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('customer_theme') as CustomerTheme | null;
    if (saved === 'burnt-orange' || saved === 'royal-emerald') {
      setTheme(saved);
    } else {
      setTheme('burnt-orange');
      localStorage.setItem('customer_theme', 'burnt-orange');
    }
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next: CustomerTheme = theme === 'burnt-orange' ? 'royal-emerald' : 'burnt-orange';
    setTheme(next);
    localStorage.setItem('customer_theme', next);
  };

  return { theme, toggleTheme, mounted };
}
