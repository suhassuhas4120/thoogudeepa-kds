import { NextResponse } from 'next/server';
import { prisma, ensureWalMode } from '@/lib/db';

export async function GET() {
  try {
    await ensureWalMode();

    const activeTickets = await prisma.orderTicket.findMany({
      where: {
        status: { in: ['RECEIVED', 'COOKING', 'READY'] },
      },
      include: {
        items: true,
      },
      orderBy: { placedAt: 'asc' },
    });

    const formattedTickets = activeTickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      orderType: t.orderType,
      seatId: t.seatId,
      customerName: t.customerName,
      customerPhone: t.customerPhone,
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
    }));

    return NextResponse.json({
      success: true,
      data: formattedTickets,
    });
  } catch (error) {
    console.error('Fetch kitchen tickets error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
