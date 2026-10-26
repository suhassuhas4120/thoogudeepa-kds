import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode, sqliteWriteQueue } from '@/lib/db';
import { emitToMultipleRooms, SocketRoom } from '@/lib/socket-emitter';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await ensureWalMode();
    const { ticketId, status } = await req.json();

    if (!ticketId || !['preparing', 'ready', 'served'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 });
    }

    const result = await sqliteWriteQueue.enqueue(async () => {
      const ticket = await prisma.orderTicket.findUnique({
        where: { id: ticketId },
        include: { items: true },
      });

      if (!ticket) {
        return { status: 404, payload: { success: false, error: 'Ticket not found' } };
      }

      // Determine items to update
      const filterStatus =
        status === 'preparing'
          ? 'placed'
          : status === 'ready'
          ? { in: ['placed', 'preparing'] }
          : { not: 'cancelled' };

      await prisma.orderItem.updateMany({
        where: {
          orderTicketId: ticketId,
          status: filterStatus as any,
        },
        data: {
          status: status,
        },
      });

      // Update parent ticket status
      const mappedTicketStatus =
        status === 'preparing'
          ? 'COOKING'
          : status === 'ready'
          ? 'READY'
          : 'COMPLETED';

      const updatedTicket = await prisma.orderTicket.update({
        where: { id: ticketId },
        data: { status: mappedTicketStatus },
        include: { items: true },
      });

      // Real-time broadcast in 1 single event
      const seatId = ticket.seatId;
      const isZoneA = seatId ? seatId <= 8 : true;
      const targetWaiterRoom: SocketRoom = isZoneA ? 'room:waiter:zoneA' : 'room:waiter:zoneB';
      const seatRoom: SocketRoom = seatId ? `room:seat:${seatId}` : 'room:global';

      const payload = {
        ticketId: updatedTicket.id,
        ticketNumber: updatedTicket.ticketNumber,
        seatId: updatedTicket.seatId,
        status: status,
        ticketStatus: mappedTicketStatus,
        items: updatedTicket.items.map((i) => ({ id: i.id, status: i.status })),
        orderItemId: updatedTicket.items[0]?.id,
      };

      emitToMultipleRooms(
        ['room:kitchen', targetWaiterRoom, 'room:manager', seatRoom, 'room:global'],
        'order:item_status_changed',
        payload
      );

      return {
        status: 200,
        payload: {
          success: true,
          data: updatedTicket,
        },
      };
    });

    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    console.error('Batch item status error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
