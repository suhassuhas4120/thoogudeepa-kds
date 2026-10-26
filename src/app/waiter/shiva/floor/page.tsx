'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, Tablet, RefreshCw } from 'lucide-react';
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
    orderTickets: {
      items: { status: string }[];
    }[];
    serviceRequests: { id: string; requestType: string; status: string }[];
  } | null;
}

export default function WaiterShivaFloorScreen() {
  const socket = useSocketRoom('room:waiter:zoneB');
  const [seats, setSeats] = useState<SeatData[]>([]);
  const [viewAllSeats, setViewAllSeats] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchFloor = async () => {
    try {
      const url = viewAllSeats
        ? `/api/seats?t=${Date.now()}`
        : `/api/seats?zone=ZONE_B&t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setSeats(json.data);

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
  }, [viewAllSeats]);

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
      if (data?.seatId && (viewAllSeats || data.seatId > 8)) {
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
      if (data?.seatId && (viewAllSeats || data.seatId > 8)) {
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
      if (data?.seatId && (viewAllSeats || data.seatId > 8)) {
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
      if (data?.seatId && (viewAllSeats || data.seatId > 8)) {
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
  }, [socket, viewAllSeats]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col p-6 select-none font-sans">
      {/* Top Tablet Header */}
      <header className="flex items-center justify-between pb-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
            <Tablet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-white">Shiva (S9 - S16)</h1>
            <span className="text-xs font-semibold text-cyan-400">
              Zone B Tablet Terminal • Landscape Mode
            </span>
          </div>
        </div>

        {/* View Toggle Bar (Break Coverage) */}
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewAllSeats(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                !viewAllSeats ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              View: S9-S16 (Shiva)
            </button>
            <button
              type="button"
              onClick={() => setViewAllSeats(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewAllSeats ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Seats (S1-S16)
            </button>
          </div>

          {/* Notification Bell */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-amber-400">
            <Bell className="w-4 h-4" />
            <span>({unreadAlerts})</span>
          </div>

          <Link
            href="/waiter/shiva"
            className="text-xs text-slate-500 hover:text-slate-300 font-medium ml-2"
          >
            Logout
          </Link>
        </div>
      </header>

      {/* Landscape Grid (4 Columns x 2 Rows) */}
      <div className="py-6 grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
        {seats.map((seat) => {
          const isOccupied = seat.status === 'OCCUPIED' || seat.status === 'BILL_REQUESTED';
          const session = seat.activeSession;

          const hasWater = session?.serviceRequests?.some((sr) => sr.status === 'PENDING' && sr.requestType.includes('WATER'));
          const hasGeneralHelp = session?.serviceRequests?.some((sr) => sr.status === 'PENDING' && !sr.requestType.includes('WATER'));
          const hasFoodReady = session?.orderTickets?.some((t) => t.items?.some((i) => i.status === 'ready'));
          const isBillReq = seat.status === 'BILL_REQUESTED';

          return (
            <div
              key={seat.id}
              className={`rounded-2xl border p-4 flex flex-col justify-between shadow-lg transition ${
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
                <div className="flex justify-between items-center mb-2">
                  <span className="font-black text-base text-white">Seat {seat.seatNumber}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      !isOccupied
                        ? 'bg-slate-800 text-slate-400 border border-slate-700'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    }`}
                  >
                    {!isOccupied ? 'vacant' : 'occupied'}
                  </span>
                </div>

                {!isOccupied ? (
                  <p className="text-xs text-slate-500 font-medium py-4">Available</p>
                ) : (
                  <div className="py-1 space-y-1">
                    {hasFoodReady && (
                      <span className="text-xs font-black text-emerald-400 block animate-bounce">
                        🟢 Food Ready
                      </span>
                    )}
                    {hasWater && (
                      <span className="text-xs font-black text-cyan-400 block">
                        💧 Water Request
                      </span>
                    )}
                    {hasGeneralHelp && (
                      <span className="text-xs font-black text-amber-400 block">
                        ⚠️ Assistance Called
                      </span>
                    )}
                    {isBillReq && (
                      <span className="text-xs font-black text-yellow-400 block">
                        🧾 Bill request
                      </span>
                    )}
                    {!hasFoodReady && !hasWater && !hasGeneralHelp && !isBillReq && (
                      <span className="text-xs font-semibold text-slate-400 block">
                        🍳 Cooking...
                      </span>
                    )}

                    <div className="text-sm font-bold text-white pt-2">
                      Total: ₹{session?.grandTotal?.toFixed(0) || '0'}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-4">
                <Link
                  href={`/waiter/shiva/seat/${seat.seatNumber}`}
                  className={`w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center transition shadow-md ${
                    !isOccupied
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-slate-950 shadow-cyan-600/20'
                  }`}
                >
                  {!isOccupied ? '+ Take order' : 'View order'}
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center text-xs text-slate-500 border-t border-slate-800 pt-4">
        Waiter Tablet Shiva • Zone B Active ({viewAllSeats ? 'Viewing All 16 Seats' : 'Seats 9 to 16'})
      </div>

      {/* Audio Autoplay Unblocking Shield */}
      <AudioShield label="Tap to Arm Tablet Alerts" />
    </div>
  );
}
