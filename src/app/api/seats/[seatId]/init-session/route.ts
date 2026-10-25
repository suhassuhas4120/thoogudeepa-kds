import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode } from '@/lib/db';
import { emitToMultipleRooms, SocketRoom } from '@/lib/socket-emitter';

export async function POST(
  req: NextRequest,
  { params }: { params: { seatId: string } }
) {
  try {
    await ensureWalMode();
    const seatId = parseInt(params.seatId, 10);
    const { customerName } = await req.json();

    if (isNaN(seatId) || seatId < 1 || seatId > 16) {
      return NextResponse.json({ success: false, error: 'Invalid seat number' }, { status: 400 });
    }

    const trimmedName = customerName && String(customerName).trim().length > 0
      ? String(customerName).trim()
      : '-';

    // Check if there is an active session
    let seat = await prisma.diningSeat.findUnique({
      where: { id: seatId },
      include: { sessions: { where: { status: 'ACTIVE' } } },
    });

    if (!seat) {
      return NextResponse.json({ success: false, error: 'Seat not found' }, { status: 404 });
    }

    let session = seat.sessions[0];

    if (!session) {
      // Create new active session
      session = await prisma.diningSession.create({
        data: {
          seatId: seat.id,
          customerName: trimmedName,
          status: 'ACTIVE',
        },
      });

      // Update seat status
      seat = await prisma.diningSeat.update({
        where: { id: seatId },
        data: {
          status: 'OCCUPIED',
          currentGuestName: trimmedName,
        },
        include: { sessions: { where: { status: 'ACTIVE' } } },
      });

      // Notify Waiter and Manager in real time
      const targetWaiterRoom: SocketRoom = seat.zone === 'ZONE_A' ? 'room:waiter:zoneA' : 'room:waiter:zoneB';
      emitToMultipleRooms([targetWaiterRoom, 'room:manager', 'room:global'], 'seat:status_changed', {
        seatId: seat.id,
        seatNumber: seat.seatNumber,
        status: 'OCCUPIED',
        customerName: trimmedName,
        assignedWaiter: seat.assignedWaiter,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        session,
        seat,
      },
    });
  } catch (error) {
    console.error('Init session error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
