'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, User, Clock, Utensils, AlertCircle } from 'lucide-react';
import { useSocketRoom } from '@/lib/useSocket';
import { playWaiterAlert, unlockAudio } from '@/lib/audio-synth';
import AudioShield from '@/components/AudioShield';

interface SeatData {
  id: number;
  seatNumber: number;
  zone: string;
  assignedWaiter: string;
  status: 'VACANT' | 'OCCUPIED' | 'BILL_REQUESTED';
  currentGuestName: string;
  activeSession?: {
    id: string;
    grandTotal: number;
    paymentLockState: string;
    orderTickets: {
      items: { status: string }[];
    }[];
    serviceRequests: { id: string; requestType: string; status: string }[];
  } | null;
}

export default function WaiterSuhasFloorScreen() {
  const socket = useSocketRoom('room:waiter:zoneA');
  const [seats, setSeats] = useState<SeatData[]>([]);
  const [unreadAlerts, setUnreadAlerts] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Fetch Seats 1 to 8 (Zone A) in 1 single fast query
  const fetchFloor = async () => {
    try {
      const res = await fetch(`/api/seats?zone=ZONE_A&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setSeats(json.data);

        // Count unread alerts (pending food ready or service requests)
        let alerts = 0;
        json.data.forEach((s: SeatData) => {
          if (s.activeSession?.serviceRequests?.some((sr) => sr.status === 'PENDING')) alerts++;
          if (s.activeSession?.orderTickets?.some((t) => t.items?.some((i) => i.status === 'ready'))) alerts++;
        });
        setUnreadAlerts(alerts);
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    unlockAudio();
    fetchFloor();
    // 5-second relaxed fallback polling
    const interval = setInterval(fetchFloor, 5000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchFloor();
    };
    window.addEventListener('focus', fetchFloor);
    window.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', fetchFloor);
      window.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Real-time synchronization: Instant in-memory updates
  useEffect(() => {
    if (!socket) return;

    let syncTimeout: NodeJS.Timeout;
    const debouncedSync = () => {
      clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        fetchFloor();
      }, 300);
    };

    const handleNewOrder = (data?: any) => {
      playWaiterAlert();
      if (data?.seatId && data.seatId <= 8) {
        setSeats((prev) =>
          prev.map((s) => {
            if (s.id !== data.seatId) return s;
            const activeSession = s.activeSession
              ? {
                  ...s.activeSession,
                  grandTotal: data.sessionTotal || s.activeSession.grandTotal,
                  orderTickets:
                    data.orderTicket && !(s.activeSession.orderTickets || []).some((t: any) => t.id === data.orderTicket.id)
                      ? [...(s.activeSession.orderTickets || []), data.orderTicket]
                      : s.activeSession.orderTickets || [],
                }
              : s.activeSession;
            return {
              ...s,
              status: 'OCCUPIED',
              currentGuestName: data.customerName || s.currentGuestName,
              activeSession,
            };
          })
        );
      }
      debouncedSync();
    };

    const handleItemStatus = (data?: any) => {
      if (data?.seatId && data.seatId <= 8) {
        setSeats((prev) =>
          prev.map((s) => {
            if (s.id !== data.seatId || !s.activeSession) return s;
            const updatedTickets = (s.activeSession.orderTickets || []).map((t: any) => {
              if (data.ticketId && t.id === data.ticketId) {
                const items = t.items.map((i: any) =>
                  data.orderItemId && i.id === data.orderItemId ? { ...i, status: data.status } : i
                );
                return { ...t, status: data.ticketStatus || t.status, items };
              }
              return t;
            });
            return {
              ...s,
              activeSession: { ...s.activeSession, orderTickets: updatedTickets },
            };
          })
        );
      }
      debouncedSync();
    };

    const handleSeatVacated = (data?: any) => {
      if (data?.seatId && data.seatId <= 8) {
        setSeats((prev) =>
          prev.map((s) =>
            s.id === data.seatId
              ? { ...s, status: 'VACANT', currentGuestName: '-', activeSession: null }
              : s
          )
        );
      }
      debouncedSync();
    };

    const handleSeatStatus = (data?: any) => {
      if (data?.seatId && data.seatId <= 8) {
        setSeats((prev) =>
          prev.map((s) =>
            s.id === data.seatId
              ? { ...s, status: data.status || s.status, currentGuestName: data.customerName || s.currentGuestName }
              : s
          )
        );
      }
      debouncedSync();
    };

    socket.on('order:placed', handleNewOrder);
    socket.on('order:item_status_changed', handleItemStatus);
    socket.on('seat:status_changed', handleSeatStatus);
    socket.on('service:requested', () => {
      playWaiterAlert();
      debouncedSync();
    });
    socket.on('seat:vacated', handleSeatVacated);
    socket.on('payment:completed', handleSeatVacated);

    return () => {
      clearTimeout(syncTimeout);
      socket.off('order:placed', handleNewOrder);
      socket.off('order:item_status_changed', handleItemStatus);
      socket.off('seat:status_changed', handleSeatStatus);
      socket.off('service:requested', debouncedSync);
      socket.off('seat:vacated', handleSeatVacated);
      socket.off('payment:completed', handleSeatVacated);
    };
  }, [socket]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col p-4 max-w-md mx-auto select-none">
      {/* Top Header */}
      <header className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-base font-black text-white">Suhas (S1 - S8)</h1>
          <span className="text-[11px] font-semibold text-blue-400">Zone A Floor Terminal</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Bell with Badge */}
          <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-bold text-amber-400">
            <Bell className="w-3.5 h-3.5" />
            <span>({unreadAlerts})</span>
          </div>
          <Link
            href="/waiter/suhas"
            className="text-xs text-slate-500 hover:text-slate-300 font-medium ml-1"
          >
            Logout
          </Link>
        </div>
      </header>

      {/* 2-Column Seats Grid (Seats 1 to 8) */}
      <div className="py-4 grid grid-cols-2 gap-3 flex-1">
        {seats.map((seat) => {
          const isOccupied = seat.status === 'OCCUPIED' || seat.status === 'BILL_REQUESTED';
          const session = seat.activeSession;

          // Check alerts
          const hasWater = session?.serviceRequests?.some((sr) => sr.status === 'PENDING' && sr.requestType.includes('WATER'));
          const hasGeneralHelp = session?.serviceRequests?.some((sr) => sr.status === 'PENDING' && !sr.requestType.includes('WATER'));
          const hasFoodReady = session?.orderTickets?.some((t) => t.items.some((i) => i.status === 'ready'));
          const isBillReq = seat.status === 'BILL_REQUESTED';

          return (
            <div
              key={seat.id}
              className={`rounded-2xl border p-3 flex flex-col justify-between shadow-md transition ${
                !isOccupied
                  ? 'bg-slate-900/60 border-slate-800'
                  : hasFoodReady
                  ? 'bg-emerald-950/40 border-emerald-500 shadow-emerald-500/10 animate-pulse'
                  : hasWater || hasGeneralHelp
                  ? 'bg-amber-950/40 border-amber-500 animate-pulse'
                  : isBillReq
                  ? 'bg-yellow-950/40 border-yellow-500'
                  : 'bg-slate-900 border-slate-700/80'
              }`}
            >
              <div>
                {/* Seat Title & Badge */}
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-black text-sm text-white">Seat {seat.seatNumber}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      !isOccupied
                        ? 'bg-slate-800 text-slate-400 border border-slate-700'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    }`}
                  >
                    {!isOccupied ? 'vacant' : 'occupied'}
                  </span>
                </div>

                {/* Subtext Status */}
                {!isOccupied ? (
                  <p className="text-xs text-slate-500 font-medium py-3">Available</p>
                ) : (
                  <div className="py-1 space-y-1">
                    {hasFoodReady && (
                      <span className="text-[11px] font-black text-emerald-400 block animate-bounce">
                        🟢 Food Ready
                      </span>
                    )}
                    {hasWater && (
                      <span className="text-[11px] font-black text-cyan-400 block">
                        💧 Water Request
                      </span>
                    )}
                    {hasGeneralHelp && (
                      <span className="text-[11px] font-black text-amber-400 block">
                        ⚠️ Assistance Called
                      </span>
                    )}
                    {isBillReq && (
                      <span className="text-[11px] font-black text-yellow-400 block">
                        🧾 Bill request
                      </span>
                    )}
                    {!hasFoodReady && !hasWater && !hasGeneralHelp && !isBillReq && (
                      <span className="text-[11px] font-semibold text-slate-400 block">
                        🍳 Cooking...
                      </span>
                    )}

                    <div className="text-xs font-bold text-white pt-1">
                      Total: ₹{session?.grandTotal?.toFixed(0) || '0'}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Card Action */}
              <div className="pt-3">
                {!isOccupied ? (
                  <Link
                    href={`/waiter/suhas/seat/${seat.seatNumber}/order`}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center border border-slate-700 transition"
                  >
                    + Take order
                  </Link>
                ) : (
                  <Link
                    href={`/waiter/suhas/seat/${seat.seatNumber}`}
                    className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center justify-center transition shadow-md shadow-blue-600/20"
                  >
                    View order
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="text-center text-[11px] text-slate-500 border-t border-slate-800 pt-3">
        Waiter Suhas • Zone A (Seats 1 to 8 Active)
      </div>

      {/* Audio Autoplay Unblocking Shield */}
      <AudioShield label="Tap to Arm Alerts" />
    </div>
  );
}
