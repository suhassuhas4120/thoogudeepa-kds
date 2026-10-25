'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ArrowLeft, Plus, CreditCard, Droplet, Clock } from 'lucide-react';
import { useSocketRoom } from '@/lib/useSocket';

interface OrderItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  status: 'placed' | 'preparing' | 'ready' | 'served' | 'cancelled';
}

interface ServiceReq {
  id: string;
  requestType: string;
  status: 'PENDING' | 'RESOLVED';
  requestedAt: string;
}

export default function WaiterSuhasSeatDetailScreen({ params }: { params: { id: string } }) {
  const router = useRouter();
  const seatId = parseInt(params.id, 10);
  const socket = useSocketRoom('room:waiter:zoneA');

  const [seatData, setSeatData] = useState<{ currentGuestName?: string } | null>(null);
  const [session, setSession] = useState<{
    id: string;
    grandTotal: number;
    orderTickets: { ticketNumber: string; items: OrderItem[] }[];
    serviceRequests: ServiceReq[];
  } | null>(null);

  const fetchSeatDetails = () => {
    fetch(`/api/seats/${seatId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSeatData(data.data.seat);
          setSession(data.data.activeSession);
        }
      });
  };

  useEffect(() => {
    fetchSeatDetails();
  }, [seatId]);

  // Real-time synchronization
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchSeatDetails();

    socket.on('order:item_status_changed', handleUpdate);
    socket.on('service:requested', handleUpdate);
    socket.on('service:resolved', handleUpdate);

    return () => {
      socket.off('order:item_status_changed', handleUpdate);
      socket.off('service:requested', handleUpdate);
      socket.off('service:resolved', handleUpdate);
    };
  }, [socket]);

  // Mark dish as Served
  const handleMarkServed = async (orderItemId: string) => {
    try {
      await fetch(`/api/orders/${orderItemId}/item-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'served' }),
      });
      fetchSeatDetails();
    } catch (e) {
      console.error(e);
    }
  };

  // Mark Service Request as Resolved
  const handleResolveService = async (requestId: string) => {
    try {
      await fetch(`/api/service-request/${requestId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolvedBy: 'Suhas' }),
      });
      fetchSeatDetails();
    } catch (e) {
      console.error(e);
    }
  };

  const allItems: OrderItem[] = [];
  session?.orderTickets?.forEach((t) => {
    t.items.forEach((it) => allItems.push(it));
  });

  const pendingRequests = session?.serviceRequests?.filter((r) => r.status === 'PENDING') || [];
  const latestTicketNumber = session?.orderTickets?.[0]?.ticketNumber || '101';

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 max-w-md mx-auto select-none">
      {/* Top Bar */}
      <div>
        <header className="flex items-center justify-between pb-3 border-b border-slate-800">
          <Link
            href="/waiter/suhas/floor"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Floor</span>
          </Link>
          <span className="text-xs font-bold text-slate-400">Suhas</span>
          <span className="text-sm font-black text-amber-400">Seat {seatId}</span>
        </header>

        {/* Order Banner */}
        <div className="my-3 p-3 bg-slate-900 border border-slate-800 rounded-2xl flex justify-between items-center text-xs">
          <span className="font-bold text-slate-300">
            Order #{latestTicketNumber} • {allItems.length} items
          </span>
          <span className="font-black text-amber-400 text-sm">
            Total: ₹{session?.grandTotal?.toFixed(0) || '0'}
          </span>
        </div>

        {/* SERVICE REQUEST SECTION */}
        <div className="mb-4">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">
            SERVICE REQUEST :
          </span>

          {pendingRequests.length === 0 ? (
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-center text-xs text-slate-500">
              No active assistance requests
            </div>
          ) : (
            pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-amber-950/40 border border-amber-500/50 shadow-md animate-pulse"
              >
                <div className="flex items-center gap-2">
                  <Droplet className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-xs text-white">
                    {req.requestType} (
                    {new Date(req.requestedAt).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}
                    )
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleResolveService(req.id)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition active:scale-95"
                >
                  Resolved ∨
                </button>
              </div>
            ))
          )}
        </div>

        {/* ORDER DETAILS SECTION */}
        <div>
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">
            Order details :
          </span>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2.5 max-h-[46vh] overflow-y-auto">
            {allItems.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No dishes placed yet.</p>
            ) : (
              allItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60"
                >
                  <div>
                    <span className="font-bold text-xs text-white">
                      {item.quantity}x {item.itemName}
                    </span>
                  </div>

                  {/* Status Toggle / Badge */}
                  {item.status === 'ready' ? (
                    <button
                      type="button"
                      onClick={() => handleMarkServed(item.id)}
                      className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] transition shadow-md shadow-emerald-500/20 active:scale-95 flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Ready ➔ Tap Served</span>
                    </button>
                  ) : (
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md capitalize ${
                        item.status === 'served'
                          ? 'bg-slate-700 text-slate-300'
                          : item.status === 'preparing'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {item.status}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom 2 Action Buttons */}
      <div className="pt-4 grid grid-cols-2 gap-3">
        <Link
          href={`/waiter/suhas/seat/${seatId}/order`}
          className="py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-98"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>+ Add Items</span>
        </Link>

        <Link
          href={`/waiter/suhas/seat/${seatId}/settle`}
          className="py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-98 shadow-md shadow-amber-500/20"
        >
          <CreditCard className="w-4 h-4" />
          <span>payment</span>
        </Link>
      </div>
    </div>
  );
}
