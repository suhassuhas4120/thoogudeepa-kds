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
    subtotal?: number;
    gstAmount?: number;
    grandTotal: number;
    discountAmount?: number;
    appliedPromoCode?: string | null;
    paymentPreferred?: string;
    paymentLockState?: string;
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
    socket.on('payment:lock_changed', handleUpdate);
    socket.on('seat:updated', handleUpdate);

    return () => {
      socket.off('order:item_status_changed', handleUpdate);
      socket.off('service:requested', handleUpdate);
      socket.off('service:resolved', handleUpdate);
      socket.off('payment:lock_changed', handleUpdate);
      socket.off('seat:updated', handleUpdate);
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
    <div className="min-h-screen bg-[#FBF9F6] text-stone-900 flex flex-col justify-between p-4 max-w-md mx-auto select-none font-sans">
      {/* Top Bar */}
      <div>
        <header className="flex items-center justify-between pb-3 border-b border-stone-200">
          <Link
            href="/waiter/suhas/floor"
            className="flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Floor</span>
          </Link>
          <span className="text-xs font-bold text-stone-600">Suhas</span>
          <span className="text-sm font-black text-[#8A4228]">Seat {seatId}</span>
        </header>

        {/* Order Banner */}
        <div className="my-3 p-3 bg-white border border-stone-200 rounded-2xl flex justify-between items-center text-xs shadow-xs">
          <span className="font-bold text-stone-700">
            {allItems.length > 0 ? `Order #${latestTicketNumber} • ${allItems.length} items` : 'No active order'}
          </span>
          <span className="font-black text-[#8A4228] text-sm font-black">
            Total: ₹{session?.grandTotal?.toFixed(0) || '0'}
          </span>
        </div>

        {/* SERVICE REQUEST SECTION */}
        <div className="mb-4">
          <span className="text-[11px] font-black text-stone-500 uppercase tracking-wider block mb-1.5">
            SERVICE REQUEST :
          </span>

          {pendingRequests.length === 0 ? (
            <div className="p-3 bg-white border border-stone-200 rounded-xl text-center text-xs text-stone-400 shadow-xs">
              No active assistance requests
            </div>
          ) : (
            pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-amber-50 border border-amber-300 shadow-xs animate-pulse text-stone-900"
              >
                <div className="flex items-center gap-2">
                  <Droplet className="w-4 h-4 text-sky-700" />
                  <span className="font-bold text-xs text-stone-900">
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
                  className="px-3 py-1.5 rounded-xl bg-[#8A4228] hover:bg-[#71351F] text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95"
                >
                  Resolved ∨
                </button>
              </div>
            ))
          )}
        </div>

        {/* ORDER DETAILS SECTION */}
        <div>
          <span className="text-[11px] font-black text-stone-500 uppercase tracking-wider block mb-1.5">
            Order details :
          </span>

          <div className="bg-white border border-stone-200 rounded-2xl p-3.5 space-y-2.5 max-h-[46vh] overflow-y-auto shadow-xs">
            {allItems.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-4">No dishes placed yet.</p>
            ) : (
              allItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-200/80"
                >
                  <div>
                    <span className="font-bold text-xs text-stone-900">
                      {item.quantity}x {item.itemName}
                    </span>
                  </div>

                  {/* Status Toggle / Badge */}
                  {item.status === 'ready' ? (
                    <button
                      type="button"
                      onClick={() => handleMarkServed(item.id)}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg transition shadow-xs active:scale-95 flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Ready ➔ Tap Served</span>
                    </button>
                  ) : (
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md capitalize ${
                        item.status === 'served'
                          ? 'bg-stone-100 text-stone-600 border border-stone-200'
                          : item.status === 'preparing'
                          ? 'bg-sky-50 text-sky-800 border border-sky-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
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
          className="py-3.5 rounded-2xl bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-98 shadow-xs"
        >
          <Plus className="w-4 h-4 text-[#8A4228]" />
          <span>+ Add Items</span>
        </Link>

        {(() => {
          const isPayViaWaiter =
            session?.paymentLockState === 'LOCKED_WAITER' ||
            session?.paymentPreferred === 'WAITER_COLLECT' ||
            session?.paymentPreferred === 'CASH';

          return (
            <Link
              href={`/waiter/suhas/seat/${seatId}/settle`}
              className={`py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-98 ${
                isPayViaWaiter
                  ? 'bg-[#8A4228] hover:bg-[#71351F] text-white ring-2 ring-[#8A4228] shadow-md animate-pulse font-bold'
                  : 'bg-[#8A4228] hover:bg-[#71351F] text-white shadow-xs font-bold'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>payment</span>
              {isPayViaWaiter && (
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              )}
            </Link>
          );
        })()}
      </div>
    </div>
  );
}
