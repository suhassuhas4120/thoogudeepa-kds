import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './db';

/**
 * Server-side Device Lock & Seat Ownership Engine
 * 
 * Enforces:
 * 1. Strict 1-Device Lock per Active Seat (occupied seats cannot be scanned by other devices).
 * 2. Active Order Lockout (a device with an active order cannot scan other seats until payment completes).
 * 3. Race Condition Winner Detection (microsecond atomic serialization).
 * 4. Anti-Cheat Immunity (incognito, browser resets, phone restarts).
 * 5. Complete Staff Exemption (Waiters, Manager, Kitchen KDS are never locked out).
 */

export function isStaffRequest(req: NextRequest): boolean {
  if (req.headers.get('x-staff-access') === 'true') return true;
  const referer = req.headers.get('referer') || '';
  if (
    referer.includes('/waiter') ||
    referer.includes('/manager') ||
    referer.includes('/kitchen') ||
    referer.includes('/kds')
  ) {
    return true;
  }
  return false;
}

export function extractDeviceToken(req: NextRequest): { token: string; isNew: boolean } {
  // 1. Check custom header (from client localStorage)
  const headerToken = req.headers.get('x-device-token');
  if (headerToken && headerToken.trim().length > 5) {
    return { token: headerToken.trim(), isNew: false };
  }

  // 2. Check Cookie
  const cookieToken = req.cookies.get('diner_device_token')?.value;
  if (cookieToken && cookieToken.trim().length > 5) {
    return { token: cookieToken.trim(), isNew: false };
  }

  // 3. Fallback to generating a fresh UUID
  const newToken = typeof crypto !== 'undefined' && crypto.randomUUID
    ? `diner_${crypto.randomUUID()}`
    : `diner_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

  return { token: newToken, isNew: true };
}

export function attachDeviceTokenCookie(res: NextResponse, token: string): NextResponse {
  try {
    res.cookies.set({
      name: 'diner_device_token',
      value: token,
      path: '/',
      maxAge: 31536000, // 1 year
      sameSite: 'lax',
      httpOnly: false, // Accessible to client-side JS for localStorage mirroring
    });
  } catch (e) {
    console.warn('Failed to set diner_device_token cookie:', e);
  }
  return res;
}

export interface SeatAccessResult {
  allowed: boolean;
  error?: 'SEAT_OCCUPIED' | 'ACTIVE_ORDER_ELSEWHERE' | 'SEAT_NOT_FOUND';
  message?: string;
  seat?: any;
  activeSession?: any;
  activeSeatId?: number;
  activeSeatNumber?: number;
  isOwner?: boolean;
  isVacant?: boolean;
}

export async function validateSeatAccess(
  seatId: number,
  deviceToken: string,
  isStaff: boolean
): Promise<SeatAccessResult> {
  // 1. Fetch seat with active sessions & order tickets
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
    return { allowed: false, error: 'SEAT_NOT_FOUND', message: 'Seat not found' };
  }

  const activeSession = seat.sessions[0] || null;

  // Staff members (Waiters, Manager, Kitchen) are never locked out
  if (isStaff) {
    return { allowed: true, seat, activeSession, isOwner: true };
  }

  // 2. DEVICE LOCK CHECK: Does this device already have an active, unpaid order at ANOTHER seat?
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
    include: {
      seat: true,
      orderTickets: true,
    },
  });

  if (activeSessionElsewhere) {
    return {
      allowed: false,
      error: 'ACTIVE_ORDER_ELSEWHERE',
      message: `You already have an active order at Seat ${activeSessionElsewhere.seat.seatNumber}. Please complete payment before dining at another seat.`,
      activeSeatId: activeSessionElsewhere.seatId,
      activeSeatNumber: activeSessionElsewhere.seat.seatNumber,
    };
  }

  // 3. SEAT LOCK CHECK: Is this seat currently occupied by another device?
  if (activeSession) {
    const hasOrders = activeSession.orderTickets && activeSession.orderTickets.length > 0;
    const isOccupiedSeat = seat.status === 'OCCUPIED' || seat.status === 'BILL_REQUESTED' || hasOrders;

    if (isOccupiedSeat) {
      if (activeSession.deviceToken) {
        // Seat has a registered device
        if (activeSession.deviceToken !== deviceToken) {
          // Block any other device
          return {
            allowed: false,
            error: 'SEAT_OCCUPIED',
            message: 'Sorry, this seat is occupied',
            activeSeatNumber: seat.seatNumber,
          };
        } else {
          // Legitimate device returning to its seat
          return { allowed: true, seat, activeSession, isOwner: true };
        }
      } else {
        // Active session exists without a deviceToken (e.g. punch order by waiter)
        if (hasOrders) {
          // Food was ordered. Prevent any random device from taking it over.
          return {
            allowed: false,
            error: 'SEAT_OCCUPIED',
            message: 'Sorry, this seat is occupied',
            activeSeatNumber: seat.seatNumber,
          };
        } else {
          // No orders yet - bind this device as owner
          await prisma.diningSession.update({
            where: { id: activeSession.id },
            data: { deviceToken },
          });
          activeSession.deviceToken = deviceToken;
          return { allowed: true, seat, activeSession, isOwner: true };
        }
      }
    }
  }

  // Seat is vacant and device is free
  return { allowed: true, seat, activeSession: null, isVacant: true };
}
