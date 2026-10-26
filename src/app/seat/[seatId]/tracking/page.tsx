'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, PlusCircle, Lock, ChefHat } from 'lucide-react';
import { useSocketRoom } from '@/lib/useSocket';
import { playSuccessChime } from '@/lib/audio-synth';
import { useCustomerTheme } from '@/lib/useCustomerTheme';
import { ThemeToggle } from '@/components/ThemeToggle';
import CustomerBottomNav from '@/components/CustomerBottomNav';
import { getDeviceHeaders } from '@/lib/client-device';
import SeatLockScreen from '@/components/SeatLockScreen';

interface OrderItem {
  id: string;
  itemName: string;
  quantity: number;
  status: 'placed' | 'preparing' | 'ready' | 'served' | 'cancelled';
}

interface OrderTicket {
  id: string;
  ticketNumber: string;
  placedAt: string;
  items: OrderItem[];
}

interface ActiveSession {
  id: string;
  customerName: string;
  subtotal: number;
  grandTotal: number;
  paymentLockState: 'UNLOCKED' | 'LOCKED_WAITER' | 'LOCKED_SELF';
  orderTickets: OrderTicket[];
}

export default function CustomerScreen4({ params }: { params: { seatId: string } }) {
  const router = useRouter();
  const seatId = parseInt(params.seatId, 10);
  const socket = useSocketRoom(`room:seat:${seatId}`);
  const { theme, toggleTheme } = useCustomerTheme();
  const isOrange = theme === 'burnt-orange';

  const [session, setSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [seatLockState, setSeatLockState] = useState<{
    type: 'OCCUPIED' | 'ACTIVE_ELSEWHERE';
    seatNumber?: number;
    activeSeatNumber?: number;
    activeSeatId?: number;
    message?: string;
  } | null>(null);

  const fetchState = () => {
    fetch(`/api/seats/${seatId}`, { headers: getDeviceHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          if (data.error === 'SEAT_OCCUPIED') {
            setSeatLockState({
              type: 'OCCUPIED',
              seatNumber: data.seatNumber || seatId,
            });
            setLoading(false);
            return;
          }
          if (data.error === 'ACTIVE_ORDER_ELSEWHERE') {
            setSeatLockState({
              type: 'ACTIVE_ELSEWHERE',
              activeSeatNumber: data.activeSeatNumber,
              activeSeatId: data.activeSeatId,
              message: data.message,
            });
            setLoading(false);
            return;
          }
        }
        if (data.success && data.data?.activeSession) {
          setSession(data.data.activeSession);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchState();
    // Relaxed 5s fallback polling because WebSockets handle all updates in 0ms
    const interval = setInterval(fetchState, 5000);
    const handleFocus = () => fetchState();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
    };
  }, [seatId]);

  useEffect(() => {
    if (!socket) return;

    let syncTimeout: NodeJS.Timeout;
    const debouncedSync = () => {
      clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        fetchState();
      }, 800);
    };

    const handleItemStatus = (data: any) => {
      if (!data) return;
      // Instant in-memory stage progression with 0ms delay!
      setSession((prev) => {
        if (!prev) return prev;
        let chimePlayed = false;

        const newTickets = (prev.orderTickets || []).map((t) => {
          // 1. If batch update matches ticket
          if (data.ticketId && t.id === data.ticketId) {
            if (data.status === 'ready' || data.status === 'served') {
              chimePlayed = true;
            }
            if (Array.isArray(data.items) && data.items.length > 0) {
              const statusMap = new Map(data.items.map((it: any) => [it.id, it.status]));
              return {
                ...t,
                items: t.items.map((it) =>
                  statusMap.has(it.id) ? { ...it, status: statusMap.get(it.id) as any } : it
                ),
              };
            }
            return {
              ...t,
              items: t.items.map((it) => ({
                ...it,
                status: data.status === 'preparing'
                  ? (it.status === 'placed' ? 'preparing' : it.status)
                  : (it.status !== 'cancelled' ? data.status : it.status),
              })),
            };
          }

          // 2. If single item update matches item
          if (data.orderItemId && t.items.some((it) => it.id === data.orderItemId)) {
            if (data.status === 'ready' || data.status === 'served') {
              chimePlayed = true;
            }
            return {
              ...t,
              items: t.items.map((it) =>
                it.id === data.orderItemId ? { ...it, status: data.status } : it
              ),
            };
          }

          return t;
        });

        if (chimePlayed) {
          playSuccessChime();
        }

        return { ...prev, orderTickets: newTickets };
      });

      debouncedSync();
    };

    const handleNewOrder = (data: any) => {
      if (data?.orderTicket) {
        setSession((prev) => {
          if (!prev) return prev;
          const existing = prev.orderTickets || [];
          if (existing.some((t) => t.id === data.orderTicket.id)) return prev;
          return {
            ...prev,
            orderTickets: [...existing, data.orderTicket],
            grandTotal: data.sessionTotal || prev.grandTotal,
          };
        });
      }
      debouncedSync();
    };

    const handlePaymentLock = (data: { lockMode: 'UNLOCKED' | 'LOCKED_WAITER' | 'LOCKED_SELF' }) => {
      setSession((prev) => (prev ? { ...prev, paymentLockState: data.lockMode } : prev));
    };

    const handleVacate = () => {
      router.push(`/seat/${seatId}/bill`);
    };

    socket.on('order:item_status_changed', handleItemStatus);
    socket.on('order:placed', handleNewOrder);
    socket.on('payment:lock_changed', handlePaymentLock);
    socket.on('seat:vacated', handleVacate);
    socket.on('payment:completed', handleVacate);

    return () => {
      clearTimeout(syncTimeout);
      socket.off('order:item_status_changed', handleItemStatus);
      socket.off('order:placed', handleNewOrder);
      socket.off('payment:lock_changed', handlePaymentLock);
      socket.off('seat:vacated', handleVacate);
      socket.off('payment:completed', handleVacate);
    };
  }, [socket, seatId, router]);

  const allItems: OrderItem[] = [];
  session?.orderTickets?.forEach((t) => {
    t.items.forEach((it) => {
      if (it.status !== 'cancelled') {
        allItems.push(it);
      }
    });
  });

  const lockState = session?.paymentLockState || 'UNLOCKED';

  const handleSelectPayMode = async (mode: 'LOCKED_WAITER' | 'LOCKED_SELF') => {
    try {
      await fetch('/api/billing/payment-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seatId,
          sessionId: session?.id,
          lockMode: mode,
        }),
      });

      if (mode === 'LOCKED_WAITER') {
        router.push(`/seat/${seatId}/settle-waiter`);
      } else {
        router.push(`/seat/${seatId}/settle-self`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getStepIndex = (status: OrderItem['status']) => {
    switch (status) {
      case 'placed':
        return 0;
      case 'preparing':
        return 1;
      case 'ready':
        return 2;
      case 'served':
        return 3;
      default:
        return 0;
    }
  };

  const getStatusLabel = (status: OrderItem['status']) => {
    switch (status) {
      case 'placed':
        return 'Placed';
      case 'preparing':
        return 'Cooking';
      case 'ready':
        return 'Ready';
      case 'served':
        return 'Served';
      default:
        return status;
    }
  };

  if (seatLockState) {
    return (
      <SeatLockScreen
        type={seatLockState.type}
        seatNumber={seatLockState.seatNumber}
        activeSeatNumber={seatLockState.activeSeatNumber}
        activeSeatId={seatLockState.activeSeatId}
        message={seatLockState.message}
        onRefresh={() => window.location.reload()}
      />
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col pb-44 max-w-md mx-auto font-sans select-none relative transition-colors duration-300 ${
        isOrange ? 'bg-[#FFFCF7] text-[#5B5049]' : 'bg-gradient-to-b from-[#04120d] via-[#081e16] to-[#04110c] text-white'
      }`}
    >
      {/* Top Bar */}
      <header
        className={`sticky top-0 z-30 px-4 py-3 flex items-center justify-between shadow-md transition-colors duration-300 ${
          isOrange
            ? 'bg-[#8A4228] text-[#FFFCF7] border-b border-[#71351F]'
            : 'bg-[#061c14]/95 backdrop-blur-md border-b border-emerald-500/20 text-white'
        }`}
      >
        <div className="flex items-center gap-2">
          <Link
            href={`/seat/${seatId}/menu`}
            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold transition ${
              isOrange
                ? 'bg-[#71351F] text-[#FFFCF7] hover:bg-[#5e2b19]'
                : 'bg-[#0b2d21] border border-emerald-500/30 text-amber-400 hover:bg-[#0f3d2d]'
            }`}
          >
            ‹
          </Link>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-black ${isOrange ? 'text-[#FFFCF7]' : 'text-amber-400'}`}>
                SEAT {String(seatId).padStart(2, '0')}
              </span>
              {session?.customerName && session.customerName !== '-' && (
                <span className={`text-[11px] font-bold ${isOrange ? 'text-[#F3DFCC]' : 'text-emerald-300'}`}>
                  ({session.customerName})
                </span>
              )}
            </div>
            <p className={`text-[9px] font-bold tracking-wider uppercase ${isOrange ? 'text-[#F3DFCC]/80' : 'text-emerald-400/80'}`}>
              Live Kitchen Line
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />

          {/* Call Waiter */}
          <Link
            href={`/seat/${seatId}/help`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black transition active:scale-95 shadow-sm ${
              isOrange
                ? 'bg-[#F3DFCC] text-[#8A4228] hover:bg-[#ebd5c0]'
                : 'bg-amber-500/15 border border-amber-400/40 text-amber-400 hover:bg-amber-500/25'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Waiter</span>
          </Link>
        </div>
      </header>

      {/* Main Tracking List */}
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="text-center py-16 text-xs font-bold animate-pulse">
            Connecting to Kitchen...
          </div>
        ) : allItems.length === 0 ? (
          <div className="text-center py-16">
            <ChefHat className={`w-10 h-10 mx-auto mb-3 ${isOrange ? 'text-[#8A4228]' : 'text-amber-400/60'}`} />
            <p className={`text-base font-black ${isOrange ? 'text-[#8A4228]' : 'text-white'}`}>No active orders</p>
            <p className={`text-xs mt-1 ${isOrange ? 'text-[#5B5049]/70' : 'text-emerald-400/70'}`}>
              Order from our menu to start preparation
            </p>
            <Link
              href={`/seat/${seatId}/menu`}
              className={`mt-5 inline-block px-6 py-3 rounded-2xl font-black text-xs shadow-md ${
                isOrange
                  ? 'bg-[#8A4228] hover:bg-[#71351F] text-[#FFFCF7]'
                  : 'bg-amber-400 text-slate-950 shadow-amber-500/20'
              }`}
            >
              Order Dishes
            </Link>
          </div>
        ) : (
          allItems.map((item) => {
            const currentStep = getStepIndex(item.status);
            const steps = [
              { key: 'placed', label: 'Placed' },
              { key: 'preparing', label: 'Cooking' },
              { key: 'ready', label: 'Ready' },
              { key: 'served', label: 'Served' },
            ];

            return (
              <div
                key={item.id}
                className={`border rounded-2xl p-4 shadow-sm flex flex-col justify-between transition ${
                  isOrange
                    ? 'bg-[#FFFCF7] border-[#E8D5C3]'
                    : 'bg-gradient-to-b from-[#0b291f] to-[#072017] border-emerald-500/25 text-white'
                }`}
              >
                <div className="flex justify-between items-center mb-3.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${
                        isOrange
                          ? 'bg-[#F3DFCC] text-[#8A4228]'
                          : 'bg-amber-400/20 text-amber-300'
                      }`}
                    >
                      {item.quantity}x
                    </span>
                    <h4 className={`font-extrabold text-sm ${isOrange ? 'text-[#5B5049]' : 'text-white'}`}>
                      {item.itemName}
                    </h4>
                  </div>

                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                      item.status === 'ready'
                        ? isOrange
                          ? 'bg-[#198754]/10 border-[#198754] text-[#198754] animate-pulse'
                          : 'bg-emerald-500/20 border-emerald-400 text-emerald-300 animate-pulse'
                        : item.status === 'preparing'
                        ? isOrange
                          ? 'bg-[#F59E0B]/10 border-[#F59E0B] text-[#D08A52]'
                          : 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : item.status === 'served'
                        ? isOrange
                          ? 'bg-[#F3DFCC] border-[#E8D5C3] text-[#5B5049]'
                          : 'bg-[#061c14] border-emerald-600/40 text-emerald-400'
                        : isOrange
                        ? 'bg-[#FFFCF7] border-[#E8D5C3] text-[#5B5049]'
                        : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                    }`}
                  >
                    {getStatusLabel(item.status)}
                  </span>
                </div>

                {/* Progress Stepper Bar */}
                <div className="relative flex items-center justify-between px-2 pt-2 pb-1">
                  {/* Connecting Line */}
                  <div
                    className={`absolute left-6 right-6 top-5 h-1 -z-0 rounded-full ${
                      isOrange ? 'bg-[#F3DFCC]' : 'bg-[#061c14]'
                    }`}
                  />
                  <div
                    className={`absolute left-6 top-5 h-1 transition-all duration-500 -z-0 rounded-full ${
                      isOrange
                        ? 'bg-gradient-to-r from-[#D08A52] to-[#8A4228]'
                        : 'bg-gradient-to-r from-emerald-400 to-amber-400'
                    }`}
                    style={{
                      width: `${(currentStep / (steps.length - 1)) * 82}%`,
                    }}
                  />

                  {steps.map((st, idx) => {
                    const isDone = idx <= currentStep;
                    const isCurrent = idx === currentStep;

                    return (
                      <div key={st.key} className="flex flex-col items-center z-10">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-all duration-300 ${
                            isDone
                              ? isOrange
                                ? 'bg-[#8A4228] border-[#8A4228] text-[#FFFCF7] shadow-sm'
                                : 'bg-amber-400 border-amber-300 text-slate-950 shadow-md shadow-amber-500/30'
                              : isOrange
                              ? 'bg-[#FFFCF7] border-[#E8D5C3] text-[#5B5049]/40'
                              : 'bg-[#061c14] border-emerald-800 text-emerald-700'
                          } ${isCurrent ? (isOrange ? 'ring-4 ring-[#8A4228]/20' : 'ring-4 ring-amber-400/30') : ''}`}
                        >
                          {idx + 1}
                        </div>
                        <span
                          className={`text-[9px] font-bold mt-1.5 uppercase tracking-wider ${
                            isDone
                              ? isOrange
                                ? 'text-[#8A4228] font-black'
                                : 'text-amber-300 font-black'
                              : isOrange
                              ? 'text-[#5B5049]/50'
                              : 'text-emerald-700'
                          }`}
                        >
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        {/* Add more dishes */}
        <Link
          href={`/seat/${seatId}/menu`}
          className={`w-full py-3.5 rounded-2xl border font-extrabold text-xs flex items-center justify-center gap-2 transition active:scale-98 shadow-sm ${
            isOrange
              ? 'bg-[#F3DFCC] hover:bg-[#ebd5c0] border-[#E8D5C3] text-[#8A4228]'
              : 'bg-[#09251c] hover:bg-[#0c3125] border-amber-400/30 text-amber-300'
          }`}
        >
          <PlusCircle className={`w-4 h-4 ${isOrange ? 'text-[#8A4228]' : 'text-amber-400'}`} />
          <span>Add More Dishes</span>
        </Link>
      </div>

      {/* Bottom Payment Actions with Mutual Exclusivity Lock (positioned above the dock) */}
      <div
        className={`fixed bottom-[68px] left-0 right-0 z-40 px-4 pb-1 max-w-md mx-auto transition ${
          isOrange
            ? 'bg-[#FFFCF7]/95 backdrop-blur-md'
            : 'bg-[#051a13]/95 backdrop-blur-md'
        }`}
      >
        <div className="grid grid-cols-2 gap-2.5">
          {/* 1. Pay via Waiter Button */}
          <button
            type="button"
            onClick={() => handleSelectPayMode('LOCKED_WAITER')}
            className={`py-3 px-3 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 select-none shadow-sm active:scale-98 ${
              lockState === 'LOCKED_WAITER'
                ? isOrange
                  ? 'bg-[#8A4228] text-[#FFFCF7] ring-2 ring-[#D08A52]'
                  : 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 ring-2 ring-amber-300'
                : isOrange
                ? 'bg-[#F3DFCC] hover:bg-[#ebd5c0] text-[#8A4228] border border-[#E8D5C3]'
                : 'bg-[#0a281e] hover:bg-[#0e3527] text-emerald-200 border border-emerald-500/30'
            }`}
          >
            <span>Pay via Waiter</span>
          </button>

          {/* 2. Self Pay Button */}
          <button
            type="button"
            onClick={() => handleSelectPayMode('LOCKED_SELF')}
            className={`py-3 px-3 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 select-none shadow-sm active:scale-98 ${
              lockState === 'LOCKED_SELF'
                ? isOrange
                  ? 'bg-[#8A4228] text-[#FFFCF7] ring-2 ring-[#D08A52]'
                  : 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 ring-2 ring-amber-300'
                : isOrange
                ? 'bg-[#8A4228] hover:bg-[#71351F] text-[#FFFCF7]'
                : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-amber-500/20'
            }`}
          >
            <span>Self Pay (UPI)</span>
          </button>
        </div>
      </div>

      {/* Customer Persistent Bottom Navigation Dock */}
      <CustomerBottomNav seatId={seatId} activeTab="tracking" hasActiveOrder={allItems.length > 0} />
    </div>
  );
}
