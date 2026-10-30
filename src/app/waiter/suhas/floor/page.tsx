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
    <div className="min-h-screen bg-[#FBF9F6] text-stone-900 flex flex-col p-4 max-w-md mx-auto select-none font-sans">
      {/* Top Header */}
      <header className="flex items-center justify-between pb-4 border-b border-stone-200">
        <div>
          <h1 className="text-base font-black text-stone-900">Suhas (S1 - S8)</h1>
          <span className="text-[11px] font-semibold text-[#8A4228]">Zone A Floor Terminal</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Bell with Badge */}
          <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-stone-200 text-xs font-bold text-[#8A4228] shadow-xs">
            <Bell className="w-3.5 h-3.5" />
            <span>({unreadAlerts})</span>
          </div>
          <Link
            href="/waiter/suhas"
            className="text-xs text-stone-500 hover:text-stone-800 font-medium ml-1"
          >
            Logout
          </Link>
        </div>
      </header>

      {/* 2-Column Seats Grid (Seats 1 to 8) */}
      <div className="py-4 grid grid-cols-2 gap-3 flex-1">
        {seats.map((seat) => {
          const session = seat.activeSession;
          const hasOrders = Boolean(
            (session?.orderTickets && session.orderTickets.length > 0) ||
            (session?.grandTotal && session.grandTotal > 0)
          );
          const isOccupied = (seat.status === 'OCCUPIED' || seat.status === 'BILL_REQUESTED') && hasOrders;
          const isBillReq = seat.status === 'BILL_REQUESTED' && hasOrders;

          // Check alerts
          const hasWater = session?.serviceRequests?.some((sr) => sr.status === 'PENDING' && sr.requestType.includes('WATER'));
          const hasGeneralHelp = session?.serviceRequests?.some((sr) => sr.status === 'PENDING' && !sr.requestType.includes('WATER'));
          const hasFoodReady = session?.orderTickets?.some((t) => t.items.some((i) => i.status === 'ready'));

          return (
            <div
              key={seat.id}
              className={`rounded-2xl border p-3 flex flex-col justify-between shadow-md transition ${
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
                {/* Seat Title & Badge */}
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-black text-sm text-stone-900">Seat {seat.seatNumber}</span>
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

                {/* Subtext Status */}
                {!isOccupied ? (
                  <p className="text-xs text-stone-400 font-medium py-3">Available</p>
                ) : (
                  <div className="py-1 space-y-1">
                    {hasFoodReady && (
                      <span className="text-[11px] font-black text-emerald-700 block animate-bounce font-black">
                        🟢 Food Ready
                      </span>
                    )}
                    {hasWater && (
                      <span className="text-[11px] font-black text-sky-700 block font-black">
                        💧 Water Request
                      </span>
                    )}
                    {hasGeneralHelp && (
                      <span className="text-[11px] font-black text-amber-700 block font-black">
                        ⚠️ Assistance Called
                      </span>
                    )}
                    {isBillReq && (
                      <span className="text-[11px] font-black text-amber-800 block font-black">
                        🧾 Bill request
                      </span>
                    )}
                    {!hasFoodReady && !hasWater && !hasGeneralHelp && !isBillReq && (
                      <span className="text-[11px] font-semibold text-stone-500 block font-semibold">
                        🍳 Cooking...
                      </span>
                    )}

                    <div className="text-xs font-bold text-stone-900 pt-1">
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
                    className="w-full py-2 rounded-xl bg-white hover:bg-stone-50 text-stone-700 font-bold text-xs flex items-center justify-center border border-stone-300 shadow-xs transition"
                  >
                    + Take order
                  </Link>
                ) : (
                  <Link
                    href={`/waiter/suhas/seat/${seat.seatNumber}`}
                    className="w-full py-2 rounded-xl bg-[#8A4228] hover:bg-[#71351F] text-white font-bold text-xs flex items-center justify-center transition shadow-xs"
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
      <div className="text-center text-[11px] text-stone-500 border-t border-stone-200 pt-3">
        Waiter Suhas • Zone A (Seats 1 to 8 Active)
      </div>

      {/* Audio Autoplay Unblocking Shield */}
      <AudioShield label="Tap to Arm Alerts" />
    </div>
  );
}
