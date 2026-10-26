import { NextResponse } from 'next/server';
import { prisma, ensureWalMode } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    await ensureWalMode();

    // Fetch all recent order tickets (active + completed, guaranteeing at least the last 50-100 orders)
    const allTickets = await prisma.orderTicket.findMany({
      include: {
        items: true,
      },
      orderBy: { placedAt: 'desc' },
      take: 100,
    });

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
        placedAtTime: new Date(t.placedAt).toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
        placedAt: t.placedAt instanceof Date ? t.placedAt.toISOString() : new Date(t.placedAt).toISOString(),
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
