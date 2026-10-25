import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode, sqliteWriteQueue } from '@/lib/db';
import { emitToMultipleRooms, SocketRoom } from '@/lib/socket-emitter';

export async function POST(req: NextRequest) {
  try {
    await ensureWalMode();
    const body = await req.json();
    const { seatId, sessionId, requestType } = body;

    if (!seatId || !requestType) {
      return NextResponse.json({ success: false, error: 'Seat ID and Request Type required' }, { status: 400 });
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
        return { status: 400, payload: { success: false, error: 'No active session found for seat' } };
      }

      // Rate-limiting check: Prevent spamming duplicate pending requests
      const existingPending = await prisma.serviceRequest.findFirst({
        where: {
          seatId: seat.id,
          sessionId: activeSession.id,
          requestType,
          status: 'PENDING',
        },
      });

      if (existingPending) {
        return {
          status: 200,
          payload: {
            success: true,
            message: 'Request already in progress',
            data: existingPending,
          },
        };
      }

      const now = new Date();
      const serviceRequest = await prisma.serviceRequest.create({
        data: {
          seatId: seat.id,
          sessionId: activeSession.id,
          requestType,
          status: 'PENDING',
          requestedAt: now,
        },
      });

      const targetWaiterRoom: SocketRoom =
        seat.zone === 'ZONE_A' ? 'room:waiter:zoneA' : 'room:waiter:zoneB';
      const seatRoom: SocketRoom = `room:seat:${seat.seatNumber}`;

      const formattedTime = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      const payload = {
        id: serviceRequest.id,
        seatId: seat.id,
        seatNumber: seat.seatNumber,
        requestType: serviceRequest.requestType,
        status: 'PENDING',
        requestedAtTime: formattedTime,
        assignedWaiter: seat.assignedWaiter,
      };

      emitToMultipleRooms([targetWaiterRoom, 'room:manager', seatRoom], 'service:requested', payload);

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
    console.error('Create service request error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
