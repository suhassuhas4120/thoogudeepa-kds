'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { UtensilsCrossed, ShoppingCart, Clock, Receipt } from 'lucide-react';
import { useCustomerTheme } from '@/lib/useCustomerTheme';

interface CustomerBottomNavProps {
  seatId: number;
  activeTab: 'menu' | 'cart' | 'tracking' | 'bill';
  cartCountOverride?: number;
  hasActiveOrder?: boolean;
}

export default function CustomerBottomNav({
  seatId,
  activeTab,
  cartCountOverride,
  hasActiveOrder = false,
}: CustomerBottomNavProps) {
  const { theme } = useCustomerTheme();
  const isOrange = theme === 'burnt-orange';

  const [cartCount, setCartCount] = useState<number>(cartCountOverride ?? 0);
  const [activeOrderDetected, setActiveOrderDetected] = useState<boolean>(hasActiveOrder);

  // Sync cart count from localStorage if override is not explicitly passed
  useEffect(() => {
    if (cartCountOverride !== undefined) {
      setCartCount(cartCountOverride);
      return;
    }

    const readCart = () => {
      try {
        const saved = localStorage.getItem(`cart_seat_${seatId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          let total = 0;
          Object.values(parsed).forEach((qty) => {
            if (typeof qty === 'number') total += qty;
          });
          setCartCount(total);
        } else {
          setCartCount(0);
        }
      } catch (e) {
        setCartCount(0);
      }
    };

    readCart();
    window.addEventListener('storage', readCart);
    const interval = setInterval(readCart, 1500);

    return () => {
      window.removeEventListener('storage', readCart);
      clearInterval(interval);
    };
  }, [seatId, cartCountOverride]);

  // Check if seat has an active order in kitchen
  useEffect(() => {
    if (hasActiveOrder) {
      setActiveOrderDetected(true);
      return;
    }

    let isMounted = true;
    fetch(`/api/seats/${seatId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.data?.activeSession?.orderTickets?.length > 0) {
          const tickets = data.data.activeSession.orderTickets;
          const hasIncomplete = tickets.some((t: any) =>
            t.status !== 'COMPLETED' || t.items?.some((i: any) => i.status !== 'served' && i.status !== 'cancelled')
          );
          setActiveOrderDetected(hasIncomplete || tickets.length > 0);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [seatId, hasActiveOrder]);

  const navItems = [
    {
      id: 'menu' as const,
      label: 'Menu',
      href: `/seat/${seatId}/menu`,
      icon: UtensilsCrossed,
      badge: null,
    },
    {
      id: 'cart' as const,
      label: 'Cart',
      href: `/seat/${seatId}/cart`,
      icon: ShoppingCart,
      badge: cartCount > 0 ? cartCount : null,
    },
    {
      id: 'tracking' as const,
      label: 'Live Tracking',
      href: `/seat/${seatId}/tracking`,
      icon: Clock,
      badge: null,
      pulse: activeOrderDetected,
    },
    {
      id: 'bill' as const,
      label: 'Bill',
      href: `/seat/${seatId}/bill`,
      icon: Receipt,
      badge: null,
    },
  ];

  return (
    <nav
      aria-label="Customer Navigation Dock"
      className={`fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto transition-colors duration-200 ${
        isOrange
          ? 'bg-[#FFFCF7]/95 border-t border-[#E8D5C3] backdrop-blur-md shadow-[0_-4px_24px_rgba(138,66,40,0.12)]'
          : 'bg-[#051a13]/95 border-t border-emerald-500/25 backdrop-blur-md shadow-[0_-4px_24px_rgba(0,0,0,0.7)]'
      }`}
    >
      <div className="grid grid-cols-4 h-16 items-center px-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 relative rounded-xl transition-all duration-150 active:scale-90 ${
                isActive
                  ? isOrange
                    ? 'text-[#8A4228] font-black'
                    : 'text-amber-400 font-black'
                  : isOrange
                  ? 'text-[#5B5049]/60 hover:text-[#8A4228] font-bold'
                  : 'text-emerald-400/60 hover:text-emerald-300 font-bold'
              }`}
            >
              {/* Active Tab Glow Pill */}
              {isActive && (
                <span
                  className={`absolute inset-x-2 -top-1 h-0.5 rounded-full ${
                    isOrange ? 'bg-[#8A4228]' : 'bg-amber-400'
                  }`}
                />
              )}

              {/* Icon Container with Badge / Pulse */}
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-150 ${
                    isActive ? 'scale-110 stroke-[2.5]' : 'stroke-[1.8]'
                  }`}
                />

                {/* Cart Badge */}
                {item.badge !== null && (
                  <span
                    className={`absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 text-[10px] font-black rounded-full flex items-center justify-center shadow-md animate-in zoom-in-75 duration-150 ${
                      isOrange
                        ? 'bg-[#8A4228] text-[#FFFCF7]'
                        : 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                {/* Live Tracking Pulse Indicator */}
                {item.pulse && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isOrange ? 'bg-[#D08A52]' : 'bg-emerald-400'
                      }`}
                    />
                    <span
                      className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                        isOrange ? 'bg-[#8A4228]' : 'bg-emerald-500'
                      }`}
                    />
                  </span>
                )}
              </div>

              {/* Label */}
              <span className="text-[10px] mt-1 tracking-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
