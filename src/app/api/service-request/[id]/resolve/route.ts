import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode, sqliteWriteQueue } from '@/lib/db';
import { emitToMultipleRooms, SocketRoom } from '@/lib/socket-emitter';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureWalMode();
    const requestId = params.id;
    const body = await req.json();
    const { resolvedBy } = body;

    const result = await sqliteWriteQueue.enqueue(async () => {
      const request = await prisma.serviceRequest.findUnique({
        where: { id: requestId },
        include: { seat: true },
      });

      if (!request) {
        return { status: 404, payload: { success: false, error: 'Request not found' } };
      }

      const updated = await prisma.serviceRequest.update({
        where: { id: requestId },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolvedBy: resolvedBy || request.seat.assignedWaiter,
        },
      });

      const isZoneA = request.seat.zone === 'ZONE_A';
      const targetWaiterRoom: SocketRoom = isZoneA ? 'room:waiter:zoneA' : 'room:waiter:zoneB';
      const seatRoom: SocketRoom = `room:seat:${request.seat.seatNumber}`;

      const payload = {
        id: updated.id,
        seatId: request.seatId,
        seatNumber: request.seat.seatNumber,
        status: 'RESOLVED',
        requestType: updated.requestType,
      };

      emitToMultipleRooms([targetWaiterRoom, 'room:manager', seatRoom], 'service:resolved', payload);

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
    console.error('Resolve service request error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
