import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { seatId: string } }
) {
  try {
    await ensureWalMode();
    const seatId = parseInt(params.seatId, 10);

    if (isNaN(seatId) || seatId < 1 || seatId > 16) {
      return NextResponse.json({ success: false, error: 'Invalid seat number' }, { status: 400 });
    }

    const seat = await prisma.diningSeat.findUnique({
      where: { id: seatId },
      include: {
        sessions: {
          where: { status: 'ACTIVE' },
          include: {
            orderTickets: {
              include: {
                items: {
                  include: {
                    menuItem: true,
                  },
                },
              },
              orderBy: { placedAt: 'asc' },
            },
            serviceRequests: {
              where: { status: 'PENDING' },
              orderBy: { requestedAt: 'desc' },
            },
          },
        },
      },
    });

    if (!seat) {
      return NextResponse.json({ success: false, error: 'Seat not found' }, { status: 404 });
    }

    let activeSession: any = seat.sessions[0] || null;
    if (!activeSession) {
      activeSession = await prisma.diningSession.findFirst({
        where: { seatId: seat.id },
        orderBy: { startedAt: 'desc' },
        include: {
          orderTickets: {
            include: {
              items: {
                include: {
                  menuItem: true,
                },
              },
            },
            orderBy: { placedAt: 'asc' },
          },
          serviceRequests: {
            where: { status: 'PENDING' },
            orderBy: { requestedAt: 'desc' },
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        seat: {
          id: seat.id,
          seatNumber: seat.seatNumber,
          zone: seat.zone,
          assignedWaiter: seat.assignedWaiter,
          status: seat.status,
          currentGuestName: seat.currentGuestName,
        },
        activeSession,
      },
    });
  } catch (error) {
    console.error('Fetch seat error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
