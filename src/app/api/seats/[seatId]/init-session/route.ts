import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode, sqliteWriteQueue } from '@/lib/db';
import { emitToMultipleRooms, SocketRoom } from '@/lib/socket-emitter';
import {
  isStaffRequest,
  extractDeviceToken,
  attachDeviceTokenCookie,
} from '@/lib/device-lock';

export async function POST(
  req: NextRequest,
  { params }: { params: { seatId: string } }
) {
  try {
    await ensureWalMode();
    const seatId = parseInt(params.seatId, 10);
    const body = await req.json().catch(() => ({}));
    const customerName = body.customerName;

    if (isNaN(seatId) || seatId < 1 || seatId > 16) {
      return NextResponse.json({ success: false, error: 'Invalid seat number' }, { status: 400 });
    }

    const isStaff = isStaffRequest(req);
    const { token: deviceToken } = extractDeviceToken(req);

    // 1. DEVICE LOCK CHECK: Does this device already have an active order on another seat?
    if (!isStaff) {
      const activeSessionElsewhere = await prisma.diningSession.findFirst({
        where: {
          deviceToken: deviceToken,
          status: 'ACTIVE',
          seatId: { not: seatId },
          OR: [
            { orderTickets: { some: {} } },
            { grandTotal: { gt: 0 } },
            { seat: { status: { in: ['OCCUPIED', 'BILL_REQUESTED'] } } },
          ],
        },
        include: { seat: true },
      });

      if (activeSessionElsewhere) {
        const errorResponse = NextResponse.json(
          {
            success: false,
            error: 'ACTIVE_ORDER_ELSEWHERE',
            message: `You already have an active order at Seat ${activeSessionElsewhere.seat.seatNumber}. Please complete payment before dining at another seat.`,
            activeSeatId: activeSessionElsewhere.seatId,
            activeSeatNumber: activeSessionElsewhere.seat.seatNumber,
            deviceToken,
          },
          { status: 403 }
        );
        return attachDeviceTokenCookie(errorResponse, deviceToken);
      }
    }

    const trimmedName = customerName && String(customerName).trim().length > 0
      ? String(customerName).trim()
      : '-';

    // 2. ATOMIC EXECUTION via seat-keyed mutex: Guarantees race-condition winner detection per seat without blocking other seats
    const result = await sqliteWriteQueue.enqueueKey(`seat:${seatId}`, async () => {
      let seat = await prisma.diningSeat.findUnique({
        where: { id: seatId },
        include: { sessions: { where: { status: 'ACTIVE' } } },
      });

      if (!seat) {
        return { status: 404, payload: { success: false, error: 'Seat not found' } };
      }

      let session = seat.sessions[0];

      if (session) {
        // Seat already has an active session
        if (!isStaff) {
          if (session.deviceToken && session.deviceToken !== deviceToken) {
            // Slower device in a same-second scan or another device scanning an occupied seat!
            return {
              status: 403,
              payload: {
                success: false,
                error: 'SEAT_OCCUPIED',
                message: 'Sorry, this seat is occupied',
                seatNumber: seat.seatNumber,
              },
            };
          }
          // If deviceToken was null, claim it
          if (!session.deviceToken) {
            session = await prisma.diningSession.update({
              where: { id: session.id },
              data: { deviceToken },
            });
          }
        }
      } else {
        // Create new active session locked to this device
        session = await prisma.diningSession.create({
          data: {
            seatId: seat.id,
            customerName: trimmedName,
            status: 'ACTIVE',
            deviceToken: !isStaff ? deviceToken : null,
          },
        });

        // Update seat status to OCCUPIED
        seat = await prisma.diningSeat.update({
          where: { id: seatId },
          data: {
            status: 'OCCUPIED',
            currentGuestName: trimmedName,
          },
          include: { sessions: { where: { status: 'ACTIVE' } } },
        });

        // Realtime notification
        const targetWaiterRoom: SocketRoom = seat.zone === 'ZONE_A' ? 'room:waiter:zoneA' : 'room:waiter:zoneB';
        emitToMultipleRooms([targetWaiterRoom, 'room:manager', 'room:global'], 'seat:status_changed', {
          seatId: seat.id,
          seatNumber: seat.seatNumber,
          status: 'OCCUPIED',
          customerName: trimmedName,
          assignedWaiter: seat.assignedWaiter,
        });
      }

      return {
        status: 200,
        payload: {
          success: true,
          data: {
            session,
            seat,
            deviceToken,
          },
        },
      };
    });

    const response = NextResponse.json(result.payload, { status: result.status });
    return attachDeviceTokenCookie(response, deviceToken);
  } catch (error) {
    console.error('Init session error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
