import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode, sqliteWriteQueue } from '@/lib/db';
import { emitToMultipleRooms, SocketRoom } from '@/lib/socket-emitter';

export async function POST(req: NextRequest) {
  try {
    await ensureWalMode();
    const body = await req.json();
    const { seatId, sessionId, lockMode } = body;

    if (!seatId || !['LOCKED_WAITER', 'LOCKED_SELF', 'UNLOCKED'].includes(lockMode)) {
      return NextResponse.json({ success: false, error: 'Invalid lock mode' }, { status: 400 });
    }

    const result = await sqliteWriteQueue.enqueue(async () => {
      const seat = await prisma.diningSeat.findUnique({
        where: { id: parseInt(seatId, 10) },
        include: { sessions: { where: { status: 'ACTIVE' } } },
      });

      if (!seat) {
        return { status: 404, payload: { success: false, error: 'Seat not found' } };
      }

      const activeSession = sessionId
        ? await prisma.diningSession.findUnique({ where: { id: sessionId } })
        : seat.sessions[0];

      if (!activeSession) {
        return { status: 400, payload: { success: false, error: 'No active session' } };
      }

      // Update payment lock state
      const updated = await prisma.diningSession.update({
        where: { id: activeSession.id },
        data: {
          paymentLockState: lockMode,
          paymentPreferred: lockMode === 'LOCKED_SELF' ? 'UPI' : lockMode === 'LOCKED_WAITER' ? 'WAITER_COLLECT' : null,
        },
      });

      // Update seat status if bill is requested
      const newSeatStatus = lockMode !== 'UNLOCKED' ? 'BILL_REQUESTED' : 'OCCUPIED';
      await prisma.diningSeat.update({
        where: { id: seat.id },
        data: { status: newSeatStatus },
      });

      const isZoneA = seat.zone === 'ZONE_A';
      const targetWaiterRoom: SocketRoom = isZoneA ? 'room:waiter:zoneA' : 'room:waiter:zoneB';
      const seatRoom: SocketRoom = `room:seat:${seat.seatNumber}`;

      const payload = {
        seatId: seat.id,
        seatNumber: seat.seatNumber,
        lockMode: updated.paymentLockState,
        seatStatus: newSeatStatus,
        grandTotal: updated.grandTotal,
      };

      emitToMultipleRooms([targetWaiterRoom, 'room:manager', seatRoom], 'payment:lock_changed', payload);

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
    console.error('Payment lock error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
