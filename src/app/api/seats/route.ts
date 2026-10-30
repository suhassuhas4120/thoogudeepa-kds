import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await ensureWalMode();
    const { searchParams } = new URL(req.url);
    const zone = searchParams.get('zone'); // "ZONE_A" | "ZONE_B" | undefined

    const whereClause: any = {};
    if (zone === 'ZONE_A') {
      whereClause.zone = 'ZONE_A';
    } else if (zone === 'ZONE_B') {
      whereClause.zone = 'ZONE_B';
    }

    const seats = await prisma.diningSeat.findMany({
      where: whereClause,
      orderBy: { id: 'asc' },
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

    const data = seats.map((seat) => {
      const activeSession = seat.sessions[0] || null;
      let status = seat.status;
      let currentGuestName = seat.currentGuestName;

      // Auto-heal orphaned occupied seats with no active session
      if (status !== 'VACANT' && !activeSession) {
        status = 'VACANT';
        currentGuestName = '-';
        prisma.diningSeat
          .update({
            where: { id: seat.id },
            data: { status: 'VACANT', currentGuestName: '-' },
          })
          .catch(() => {});
      }

      return {
        id: seat.id,
        seatNumber: seat.seatNumber,
        zone: seat.zone,
        assignedWaiter: seat.assignedWaiter,
        status,
        currentGuestName,
        activeSession,
      };
    });

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Fetch all seats error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
