import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode, sqliteWriteQueue } from '@/lib/db';
import { emitToMultipleRooms, SocketRoom } from '@/lib/socket-emitter';
import {
  isStaffRequest,
  extractDeviceToken,
  attachDeviceTokenCookie,
} from '@/lib/device-lock';

export async function POST(req: NextRequest) {
  try {
    await ensureWalMode();
    const isStaff = isStaffRequest(req);
    const { token: deviceToken } = extractDeviceToken(req);
    const body = await req.json();
    const { seatId, sessionId, items, specialNotes, promoCode, idempotencyKey } = body;

    if (!seatId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid order data' }, { status: 400 });
    }

    // Check Persistent Idempotency Ledger (Anti-Double Ordering & Re-play defense)
    if (idempotencyKey) {
      const existing = await prisma.idempotencyRecord.findUnique({
        where: { key: String(idempotencyKey) },
      });
      if (existing) {
        try {
          const cached = JSON.parse(existing.responseJson);
          return NextResponse.json(cached);
        } catch {
          // fallback to re-evaluating if json parse fails
        }
      }
    }

    // Execute order creation inside high-throughput seat-keyed mutex
    const result = await sqliteWriteQueue.enqueueKey(`seat:${seatId}`, async () => {
      const seat = await prisma.diningSeat.findUnique({
        where: { id: parseInt(seatId, 10) },
        include: { sessions: { where: { status: 'ACTIVE' } } },
      });

      if (!seat) {
        return { status: 404, payload: { success: false, error: 'Seat not found' } };
      }

      // If customer request, enforce device lock & seat lock
      if (!isStaff) {
        // 1. Device check: does this device have an active unpaid order elsewhere?
        const activeElsewhere = await prisma.diningSession.findFirst({
          where: {
            deviceToken: deviceToken,
            status: 'ACTIVE',
            seatId: { not: seat.id },
            OR: [
              { orderTickets: { some: {} } },
              { grandTotal: { gt: 0 } },
              { seat: { status: { in: ['OCCUPIED', 'BILL_REQUESTED'] } } },
            ],
          },
          include: { seat: true },
        });

        if (activeElsewhere) {
          return {
            status: 403,
            payload: {
              success: false,
              error: 'ACTIVE_ORDER_ELSEWHERE',
              message: `You already have an active order at Seat ${activeElsewhere.seat.seatNumber}. Please complete payment before dining at another seat.`,
              activeSeatId: activeElsewhere.seatId,
              activeSeatNumber: activeElsewhere.seat.seatNumber,
            },
          };
        }

        // 2. Seat check: is this seat occupied by another device?
        const existingActiveSession = seat.sessions[0];
        if (existingActiveSession) {
          if (existingActiveSession.deviceToken && existingActiveSession.deviceToken !== deviceToken) {
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
        }
      }

      let session = sessionId
        ? await prisma.diningSession.findUnique({ where: { id: sessionId } })
        : seat.sessions[0];

      if (!session) {
        session = await prisma.diningSession.create({
          data: {
            seatId: seat.id,
            customerName: seat.currentGuestName || '-',
            status: 'ACTIVE',
            deviceToken: !isStaff ? deviceToken : null,
          },
        });
      } else if (!session.deviceToken && !isStaff) {
        // Bind deviceToken to this active session
        session = await prisma.diningSession.update({
          where: { id: session.id },
          data: { deviceToken },
        });
      }

      // 1. Fetch official menu items from database (Server-authoritative pricing)
      const itemIds = items.map((i: { menuItemId: string }) => i.menuItemId);
      const dbItems = await prisma.menuItem.findMany({
        where: { id: { in: itemIds } },
      });

      const dbItemMap = new Map(dbItems.map((item) => [item.id, item]));

      // 2. Validate stock availability (Anti-cheat)
      for (const orderItem of items) {
        const dbItem = dbItemMap.get(orderItem.menuItemId);
        if (!dbItem) {
          return { status: 400, payload: { success: false, error: 'Item not found' } };
        }
        if (!dbItem.isAvailable) {
          return {
            status: 409,
            payload: {
              success: false,
              error: `"${dbItem.name}" just sold out! Please select another item.`,
            },
          };
        }
      }

      // 3. Compute ticket count for sequential ticket #
      const ticketCount = await prisma.orderTicket.count();
      const nextTicketNumber = String(101 + ticketCount);

      const now = new Date();
      const formattedPlacedTime = now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      // 4. Create OrderTicket and OrderItems
      const orderTicket = await prisma.orderTicket.create({
        data: {
          ticketNumber: nextTicketNumber,
          orderType: 'DINE_IN',
          seatId: seat.id,
          sessionId: session.id,
          customerName: session.customerName,
          placedAt: now,
          status: 'RECEIVED',
          specialNotes: specialNotes || '',
          waiterName: seat.assignedWaiter,
          items: {
            create: items.map((i: { menuItemId: string; quantity: number; notes?: string }) => {
              const dbItem = dbItemMap.get(i.menuItemId)!;
              return {
                menuItemId: dbItem.id,
                itemName: dbItem.name,
                unitPrice: dbItem.price,
                quantity: Math.max(1, i.quantity || 1),
                specialNotes: i.notes || '',
                status: 'placed',
                placedAt: now,
              };
            }),
          },
        },
        include: {
          items: {
            include: { menuItem: true },
          },
        },
      });

      // 5. Recalculate session totals
      const allSessionTickets = await prisma.orderTicket.findMany({
        where: { sessionId: session.id },
        include: { items: true },
      });

      let newSubtotal = 0;
      allSessionTickets.forEach((t) => {
        t.items.forEach((it) => {
          newSubtotal += it.unitPrice * it.quantity;
        });
      });

      let discount = 0;
      let validPromo = session.appliedPromoCode || promoCode;

      if (validPromo) {
        const codeRecord = await prisma.promoCode.findFirst({
          where: { code: validPromo, isActive: true },
        });
        if (codeRecord && newSubtotal >= codeRecord.minOrderValue) {
          discount =
            codeRecord.discountType === 'FLAT'
              ? Math.min(codeRecord.value, newSubtotal)
              : Math.min((newSubtotal * codeRecord.value) / 100, codeRecord.maxDiscount || newSubtotal);
        } else {
          validPromo = null;
        }
      }

      const taxableAmount = Math.max(0, newSubtotal - discount);
      const gst = Math.round(taxableAmount * 0.05 * 100) / 100; // 5% GST
      const grandTotal = Math.round((taxableAmount + gst) * 100) / 100;

      await prisma.diningSession.update({
        where: { id: session.id },
        data: {
          subtotal: newSubtotal,
          discountAmount: discount,
          gstAmount: gst,
          grandTotal,
          appliedPromoCode: validPromo,
        },
      });

      await prisma.diningSeat.update({
        where: { id: seat.id },
        data: { status: 'OCCUPIED' },
      });

      // 6. Broadcast via WebSocket (Strict Waiter Isolation)
      const targetWaiterRoom: SocketRoom =
        seat.zone === 'ZONE_A' ? 'room:waiter:zoneA' : 'room:waiter:zoneB';
      const seatRoom: SocketRoom = `room:seat:${seat.seatNumber}`;

      const broadcastPayload = {
        ticket: {
          id: orderTicket.id,
          ticketNumber: orderTicket.ticketNumber,
          seatId: seat.id,
          seatNumber: seat.seatNumber,
          customerName: session.customerName,
          placedAtTime: formattedPlacedTime,
          status: 'RECEIVED',
          waiterName: seat.assignedWaiter,
          specialNotes: orderTicket.specialNotes,
          items: orderTicket.items.map((it) => ({
            id: it.id,
            itemName: it.itemName,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            status: it.status,
            specialNotes: it.specialNotes,
          })),
        },
        session: {
          id: session.id,
          subtotal: newSubtotal,
          discountAmount: discount,
          gstAmount: gst,
          grandTotal,
        },
      };

      emitToMultipleRooms(
        ['room:kitchen', targetWaiterRoom, 'room:manager', seatRoom],
        'order:placed',
        broadcastPayload
      );

      const responsePayload = {
        success: true,
        data: broadcastPayload,
      };

      // Record in persistent idempotency ledger
      if (idempotencyKey) {
        await prisma.idempotencyRecord.create({
          data: {
            key: String(idempotencyKey),
            seatId: seat.id,
            responseJson: JSON.stringify(responsePayload),
          },
        });
      }

      return { status: 200, payload: responsePayload };
    });

    const response = NextResponse.json(result.payload, { status: result.status });
    return attachDeviceTokenCookie(response, deviceToken);
  } catch (error) {
    console.error('Place order error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
