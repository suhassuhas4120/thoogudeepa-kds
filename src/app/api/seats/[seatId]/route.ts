import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode } from '@/lib/db';
import {
  isStaffRequest,
  extractDeviceToken,
  attachDeviceTokenCookie,
  validateSeatAccess,
} from '@/lib/device-lock';

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

    const isStaff = isStaffRequest(req);
    const { token: deviceToken } = extractDeviceToken(req);

    // Enforce 1-Device Seat Locking & Active Order Lockout for Diners
    const access = await validateSeatAccess(seatId, deviceToken, isStaff);
    if (!access.allowed) {
      const errorResponse = NextResponse.json(
        {
          success: false,
          error: access.error,
          message: access.message,
          seatNumber: access.activeSeatNumber || seatId,
          activeSeatId: access.activeSeatId,
          activeSeatNumber: access.activeSeatNumber,
          deviceToken,
        },
        { status: 403 }
      );
      return attachDeviceTokenCookie(errorResponse, deviceToken);
    }

    const seat = access.seat;
    if (!seat) {
      return NextResponse.json({ success: false, error: 'Seat not found' }, { status: 404 });
    }

    let activeSession: any = access.activeSession || null;

    // Auto-heal orphaned seat status if no active session exists
    if (!activeSession && seat.status !== 'VACANT') {
      await prisma.diningSeat.update({
        where: { id: seat.id },
        data: { status: 'VACANT', currentGuestName: '-' },
      }).catch(() => {});
      seat.status = 'VACANT';
      seat.currentGuestName = '-';
    }

    // Only load completed historical session if explicitly requested (e.g. for receipts post-payment)
    if (!activeSession) {
      const includeCompleted = req.nextUrl.searchParams.get('includeCompleted') === 'true';
      if (includeCompleted) {
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
    }

    const response = NextResponse.json({
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
        deviceToken,
      },
    });

    return attachDeviceTokenCookie(response, deviceToken);
  } catch (error) {
    console.error('Fetch seat error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
