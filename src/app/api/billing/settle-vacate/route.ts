import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode, sqliteWriteQueue } from '@/lib/db';
import { emitToMultipleRooms, SocketRoom } from '@/lib/socket-emitter';

export async function POST(req: NextRequest) {
  try {
    await ensureWalMode();
    const { seatId, sessionId, paymentMode, settledBy } = await req.json();

    if (!seatId) {
      return NextResponse.json({ success: false, error: 'Seat ID is required' }, { status: 400 });
    }

    const result = await sqliteWriteQueue.enqueueKey(`seat:${seatId}`, async () => {
      const seat = await prisma.diningSeat.findUnique({
        where: { id: parseInt(seatId, 10) },
        include: {
          sessions: {
            where: { status: 'ACTIVE' },
            include: {
              orderTickets: {
                include: { items: true },
              },
            },
          },
        },
      });

      if (!seat) {
        return { status: 404, payload: { success: false, error: 'Seat not found' } };
      }

      const session = sessionId
        ? await prisma.diningSession.findUnique({
            where: { id: sessionId },
            include: { orderTickets: { include: { items: true } } },
          })
        : seat.sessions[0];

      if (!session) {
        return { status: 400, payload: { success: false, error: 'No active session found for seat' } };
      }

      const sessionGrandTotal = Number(session.grandTotal) || 0;

      // 0. RULE: When amount is 0, payment must NEVER be done.
      if (sessionGrandTotal <= 0) {
        // If seat is being vacated directly without an order/bill, clear the table without creating any sales record
        await prisma.diningSession.update({
          where: { id: session.id },
          data: {
            status: 'COMPLETED',
            endedAt: new Date(),
            paymentStatus: 'UNPAID',
            paymentLockState: 'UNLOCKED',
          },
        });

        await prisma.diningSeat.update({
          where: { id: seat.id },
          data: {
            status: 'VACANT',
            currentGuestName: '-',
          },
        });

        const isZoneA = seat.zone === 'ZONE_A';
        const targetWaiterRoom: SocketRoom = isZoneA ? 'room:waiter:zoneA' : 'room:waiter:zoneB';
        await emitToMultipleRooms(
          [targetWaiterRoom, 'room:manager', 'room:kitchen', `room:seat:${seat.id}`],
          'seat:vacated',
          {
            seatId: seat.id,
            seatNumber: seat.seatNumber,
            zone: seat.zone,
          }
        );

        return {
          status: 200,
          payload: {
            success: true,
            message: 'Seat vacated without payment (Amount was ₹0.00 - No payment recorded)',
          },
        };
      }

      const now = new Date();
      const formattedDate = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).replace(/\//g, '-');
      const formattedSettledTime = now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      // 1. Compile Items Summary
      const itemsMap = new Map<string, number>();
      session.orderTickets.forEach((ticket) => {
        ticket.items.forEach((item) => {
          if (item.status !== 'cancelled') {
            itemsMap.set(item.itemName, (itemsMap.get(item.itemName) || 0) + item.quantity);
          }
        });
      });

      const itemsSummaryArray: string[] = [];
      itemsMap.forEach((qty, name) => {
        itemsSummaryArray.push(`${qty}x ${name}`);
      });
      const itemsSummary = itemsSummaryArray.join(', ') || 'Standard Dine-in';

      // 2. Generate Safe Unique Invoice Number (Fast In-Memory Resolution)
      const recentRecords = await prisma.masterSalesRecord.findMany({
        select: { billNumber: true },
        orderBy: { id: 'desc' },
        take: 200,
      });
      const existingBills = new Set(recentRecords.map((r) => r.billNumber));
      let maxNum = 100;
      recentRecords.forEach((r) => {
        const match = r.billNumber.match(/INV-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
      let nextNum = maxNum + 1;
      while (existingBills.has(`INV-${nextNum}`)) {
        nextNum++;
      }
      const billNumber = `INV-${nextNum}`;

      const initialPlacedTime = session.orderTickets[0]?.placedAt
        ? new Date(session.orderTickets[0].placedAt).toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          })
        : formattedSettledTime;

      const chosenPaymentMode = paymentMode || session.paymentPreferred || 'CASH';

      // 3. Perform Writes in a Single Atomic Transaction Pipeline
      const [masterRecord] = await prisma.$transaction([
        prisma.masterSalesRecord.create({
          data: {
            billNumber,
            date: formattedDate,
            orderType: 'Dine-in',
            seatNumberOrToken: `S${seat.seatNumber}`,
            customerName: session.customerName && session.customerName !== '-' ? session.customerName : '(-)',
            serverName: settledBy || seat.assignedWaiter,
            itemsSummary,
            placedAt: initialPlacedTime,
            settledAt: formattedSettledTime,
            subtotal: session.subtotal,
            discountAmount: session.discountAmount,
            packagingCharges: 0.0,
            gst5Percent: session.gstAmount,
            grandTotal: session.grandTotal,
            paymentMode: chosenPaymentMode.toUpperCase(),
            paymentStatus: 'PAID',
            sessionId: session.id,
          },
        }),
        prisma.diningSession.update({
          where: { id: session.id },
          data: {
            status: 'COMPLETED',
            endedAt: now,
            paymentStatus: 'PAID',
            paymentMethod: chosenPaymentMode.toUpperCase(),
            paymentLockState: 'UNLOCKED',
          },
        }),
        prisma.diningSeat.update({
          where: { id: seat.id },
          data: {
            status: 'VACANT',
            currentGuestName: '-',
          },
        }),
      ]);

      // 6. Broadcast via WebSocket across all portals
      const isZoneA = seat.zone === 'ZONE_A';
      const targetWaiterRoom: SocketRoom = isZoneA ? 'room:waiter:zoneA' : 'room:waiter:zoneB';
      const seatRoom: SocketRoom = `room:seat:${seat.seatNumber}`;

      const payload = {
        seatId: seat.id,
        seatNumber: seat.seatNumber,
        billNumber: masterRecord.billNumber,
        grandTotal: session.grandTotal,
        paymentMode: chosenPaymentMode,
        status: 'VACANT',
      };

      emitToMultipleRooms(
        ['room:waiter:zoneA', 'room:waiter:zoneB', 'room:waiter:all', 'room:manager', 'room:global', seatRoom, `room:seat:${seat.id}` as SocketRoom, 'room:kitchen'],
        'seat:vacated',
        payload
      );

      emitToMultipleRooms(
        ['room:waiter:zoneA', 'room:waiter:zoneB', 'room:waiter:all', 'room:manager', 'room:global', seatRoom, `room:seat:${seat.id}` as SocketRoom, 'room:kitchen'],
        'payment:completed',
        payload
      );

      return {
        status: 200,
        payload: {
          success: true,
          data: {
            masterRecord,
            seatId: seat.id,
          },
        },
      };
    });

    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    console.error('Settle & vacate error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
