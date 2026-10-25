import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode, sqliteWriteQueue } from '@/lib/db';
import { emitToMultipleRooms, SocketRoom } from '@/lib/socket-emitter';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureWalMode();
    const orderItemId = params.id;
    const { status, cancellationReason } = await req.json();

    if (!orderItemId || !['placed', 'preparing', 'ready', 'served', 'cancelled'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    const result = await sqliteWriteQueue.enqueue(async () => {
      const orderItem = await prisma.orderItem.findUnique({
        where: { id: orderItemId },
        include: {
          ticket: {
            include: {
              session: true,
              items: true,
            },
          },
        },
      });

      if (!orderItem) {
        return { status: 404, payload: { success: false, error: 'Order item not found' } };
      }

      // Update item status
      const updatedItem = await prisma.orderItem.update({
        where: { id: orderItemId },
        data: {
          status,
          specialNotes: cancellationReason ? `Cancelled: ${cancellationReason}` : orderItem.specialNotes,
        },
      });

      const ticket = orderItem.ticket;
      const allItems = await prisma.orderItem.findMany({
        where: { orderTicketId: ticket.id },
      });

      // Check overall ticket status
      let newTicketStatus = ticket.status;
      const nonCancelled = allItems.filter((i) => i.status !== 'cancelled');
      const allReady = nonCancelled.length > 0 && nonCancelled.every((i) => i.status === 'ready' || i.status === 'served');
      const allServed = nonCancelled.length > 0 && nonCancelled.every((i) => i.status === 'served');
      const anyCooking = nonCancelled.some((i) => i.status === 'preparing');

      if (allServed) {
        newTicketStatus = 'COMPLETED';
      } else if (allReady) {
        newTicketStatus = 'READY';
      } else if (anyCooking) {
        newTicketStatus = 'COOKING';
      }

      if (newTicketStatus !== ticket.status) {
        await prisma.orderTicket.update({
          where: { id: ticket.id },
          data: { status: newTicketStatus },
        });
      }

      // If cancelled, deduct from session totals
      if (status === 'cancelled' && ticket.sessionId) {
        const remainingItems = await prisma.orderItem.findMany({
          where: {
            ticket: { sessionId: ticket.sessionId },
            status: { not: 'cancelled' },
          },
        });

        let newSubtotal = 0;
        remainingItems.forEach((it) => {
          newSubtotal += it.unitPrice * it.quantity;
        });

        const session = ticket.session;
        let discount = 0;
        if (session?.appliedPromoCode) {
          const code = await prisma.promoCode.findFirst({
            where: { code: session.appliedPromoCode, isActive: true },
          });
          if (code && newSubtotal >= code.minOrderValue) {
            discount = code.discountType === 'FLAT'
              ? Math.min(code.value, newSubtotal)
              : Math.min((newSubtotal * code.value) / 100, code.maxDiscount || newSubtotal);
          }
        }

        const taxable = Math.max(0, newSubtotal - discount);
        const gst = Math.round(taxable * 0.05 * 100) / 100;
        const grandTotal = Math.round((taxable + gst) * 100) / 100;

        await prisma.diningSession.update({
          where: { id: ticket.sessionId },
          data: {
            subtotal: newSubtotal,
            discountAmount: discount,
            gstAmount: gst,
            grandTotal,
          },
        });
      }

      // Real-time broadcast
      const seatId = ticket.seatId;
      const isZoneA = seatId ? seatId <= 8 : true;
      const targetWaiterRoom: SocketRoom = isZoneA ? 'room:waiter:zoneA' : 'room:waiter:zoneB';
      const seatRoom: SocketRoom = seatId ? `room:seat:${seatId}` : 'room:global';

      const payload = {
        orderItemId: updatedItem.id,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        seatId: ticket.seatId,
        status: updatedItem.status,
        itemName: updatedItem.itemName,
        ticketStatus: newTicketStatus,
      };

      emitToMultipleRooms(
        ['room:kitchen', targetWaiterRoom, 'room:manager', seatRoom],
        'order:item_status_changed',
        payload
      );

      return {
        status: 200,
        payload: {
          success: true,
          data: payload,
        },
      };
    });

    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    console.error('Update item status error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
