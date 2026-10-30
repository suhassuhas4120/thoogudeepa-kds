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
    <div className="min-h-screen bg-[#FBF9F6] text-stone-900 flex flex-col p-6 select-none font-sans">
      {/* Top Tablet Header */}
      <header className="flex items-center justify-between pb-5 border-b border-stone-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8A4228]/10 text-[#8A4228] flex items-center justify-center font-bold">
            <Tablet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-stone-900">Shiva (S9 - S16)</h1>
            <span className="text-xs font-semibold text-[#8A4228]">
              Zone B Tablet Terminal • Landscape Mode
            </span>
          </div>
        </div>

        {/* View Toggle Bar (Break Coverage) */}
        <div className="flex items-center gap-3">
          <div className="flex bg-white border border-stone-200 p-1 rounded-xl shadow-xs">
            <button
              type="button"
              onClick={() => setViewAllSeats(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                !viewAllSeats ? 'bg-[#8A4228] text-white shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              View: S9-S16 (Shiva)
            </button>
            <button
              type="button"
              onClick={() => setViewAllSeats(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewAllSeats ? 'bg-[#8A4228] text-white shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              All Seats (S1-S16)
            </button>
          </div>

          {/* Notification Bell */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs font-bold text-[#8A4228] shadow-xs">
            <Bell className="w-4 h-4" />
            <span>({unreadAlerts})</span>
          </div>

          <Link
            href="/waiter/shiva"
            className="text-xs text-stone-500 hover:text-stone-800 font-medium ml-2"
          >
            Logout
          </Link>
        </div>
      </header>

      {/* Landscape Grid (4 Columns x 2 Rows) */}
      <div className="py-6 grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
        {seats.map((seat) => {
          const session = seat.activeSession;
          const hasOrders = Boolean(
            (session?.orderTickets && session.orderTickets.length > 0) ||
            (session?.grandTotal && session.grandTotal > 0)
          );
          const isOccupied = (seat.status === 'OCCUPIED' || seat.status === 'BILL_REQUESTED') && hasOrders;
          const isBillReq = seat.status === 'BILL_REQUESTED' && hasOrders;

          const hasWater = session?.serviceRequests?.some((sr) => sr.status === 'PENDING' && sr.requestType.includes('WATER'));
          const hasGeneralHelp = session?.serviceRequests?.some((sr) => sr.status === 'PENDING' && !sr.requestType.includes('WATER'));
          const hasFoodReady = session?.orderTickets?.some((t) => t.items?.some((i) => i.status === 'ready'));

          return (
            <div
              key={seat.id}
              className={`rounded-2xl border p-4 flex flex-col justify-between shadow-lg transition ${
                !isOccupied
                  ? 'bg-white border-stone-200 shadow-xs'
                  : hasFoodReady
                  ? 'bg-emerald-50 border-emerald-400 shadow-xs animate-pulse'
                  : hasWater || hasGeneralHelp
                  ? 'bg-amber-50 border-amber-400 shadow-xs animate-pulse'
                  : isBillReq
                  ? 'bg-amber-100 border-amber-400 shadow-xs'
                  : 'bg-stone-50/80 border-stone-200/90 shadow-xs'
              }`}
            >
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-black text-base text-stone-900">Seat {seat.seatNumber}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      !isOccupied
                        ? 'bg-stone-100 text-stone-600 border border-stone-200'
                        : 'bg-[#8A4228]/10 text-[#8A4228] border border-[#8A4228]/30 font-bold'
                    }`}
                  >
                    {!isOccupied ? 'vacant' : 'occupied'}
                  </span>
                </div>

                {!isOccupied ? (
                  <p className="text-xs text-stone-400 font-medium py-4">Available</p>
                ) : (
                  <div className="py-1 space-y-1">
                    {hasFoodReady && (
                      <span className="text-xs font-black text-emerald-700 block animate-bounce font-black">
                        🟢 Food Ready
                      </span>
                    )}
                    {hasWater && (
                      <span className="text-xs font-black text-sky-700 block font-black">
                        💧 Water Request
                      </span>
                    )}
                    {hasGeneralHelp && (
                      <span className="text-xs font-black text-amber-700 block font-black">
                        ⚠️ Assistance Called
                      </span>
                    )}
                    {isBillReq && (
                      <span className="text-xs font-black text-amber-800 block font-black">
                        🧾 Bill request
                      </span>
                    )}
                    {!hasFoodReady && !hasWater && !hasGeneralHelp && !isBillReq && (
                      <span className="text-xs font-semibold text-stone-500 block font-semibold">
                        🍳 Cooking...
                      </span>
                    )}

                    <div className="text-sm font-bold text-stone-900 pt-2">
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
                      ? 'bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 shadow-xs font-bold'
                      : 'bg-[#8A4228] hover:bg-[#71351F] text-white shadow-xs font-bold'
                  }`}
                >
                  {!isOccupied ? '+ Take order' : 'View order'}
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center text-xs text-stone-500 border-t border-stone-200 pt-4">
        Waiter Tablet Shiva • Zone B Active ({viewAllSeats ? 'Viewing All 16 Seats' : 'Seats 9 to 16'})
      </div>

      {/* Audio Autoplay Unblocking Shield */}
      <AudioShield label="Tap to Arm Tablet Alerts" />
    </div>
  );
}
