import { NextResponse } from 'next/server';
import { prisma, ensureWalMode } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    await ensureWalMode();

    // 1. Fetch all active tickets (RECEIVED, COOKING, READY)
    const activeTickets = await prisma.orderTicket.findMany({
      where: {
        status: { in: ['RECEIVED', 'COOKING', 'READY'] },
      },
      include: {
        items: true,
      },
      orderBy: { placedAt: 'desc' },
    });

    // 2. Fetch completed tickets so total returned is at least the last 50 orders
    const neededCompleted = Math.max(50 - activeTickets.length, 50);
    const completedTickets = await prisma.orderTicket.findMany({
      where: {
        status: 'COMPLETED',
      },
      include: {
        items: true,
      },
      orderBy: { placedAt: 'desc' },
      take: neededCompleted,
    });

    // Merge and sort in descending order of placedAt (newest first)
    const allTickets = [...activeTickets, ...completedTickets].sort(
      (a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()
    );

    const formattedTickets = allTickets.map((t) => {
      let totalAmount = 0;
      t.items.forEach((it) => {
        totalAmount += (it.unitPrice || 0) * (it.quantity || 1);
      });

      return {
        id: t.id,
        ticketNumber: t.ticketNumber,
        orderType: t.orderType,
        seatId: t.seatId,
        customerName: t.customerName,
        customerPhone: t.customerPhone,
        totalAmount,
        placedAtTime: new Date(t.placedAt).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
        status: t.status,
        specialNotes: t.specialNotes,
        waiterName: t.waiterName,
        items: t.items.map((it) => ({
          id: it.id,
          itemName: it.itemName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          status: it.status,
          specialNotes: it.specialNotes,
        })),
      };
    });

    return NextResponse.json(
      {
        success: true,
        data: formattedTickets,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Fetch kitchen tickets error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
