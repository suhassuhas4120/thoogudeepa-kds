import { NextResponse } from 'next/server';
import { prisma, ensureWalMode } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    await ensureWalMode();

    // Fetch all recent order tickets with complete session, items, and audit records
    const [allTickets, allMasterRecords] = await Promise.all([
      prisma.orderTicket.findMany({
        include: {
          items: true,
          session: {
            include: {
              masterRecord: true,
              orderTickets: {
                include: { items: true },
                orderBy: { placedAt: 'asc' },
              },
            },
          },
        },
        orderBy: { placedAt: 'desc' },
        take: 100,
      }),
      prisma.masterSalesRecord.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    // Map of master sales records by token/seat and by sessionId for fast lookup
    const masterRecordByToken = new Map<string, typeof allMasterRecords[0]>();
    const masterRecordBySessionId = new Map<string, typeof allMasterRecords[0]>();

    allMasterRecords.forEach((mr) => {
      if (mr.seatNumberOrToken) masterRecordByToken.set(mr.seatNumberOrToken, mr);
      if (mr.sessionId) masterRecordBySessionId.set(mr.sessionId, mr);
    });

    const formattedTickets = allTickets.map((t) => {
      let totalAmount = 0;
      t.items.forEach((it) => {
        totalAmount += (it.unitPrice || 0) * (it.quantity || 1);
      });

      // Find linked master invoice / audit record
      let linkedMaster = t.session?.masterRecord || null;
      if (!linkedMaster && t.sessionId && masterRecordBySessionId.has(t.sessionId)) {
        linkedMaster = masterRecordBySessionId.get(t.sessionId) || null;
      }
      if (!linkedMaster && t.ticketNumber && masterRecordByToken.has(t.ticketNumber)) {
        linkedMaster = masterRecordByToken.get(t.ticketNumber) || null;
      }

      // Calculate table session totals
      let billNumber = linkedMaster?.billNumber || null;
      let billSubtotal = linkedMaster ? linkedMaster.subtotal : (t.session?.subtotal || totalAmount);
      let billGst = linkedMaster ? linkedMaster.gst5Percent : (t.session?.gstAmount || Math.round(billSubtotal * 0.05 * 100) / 100);
      let billGrandTotal = linkedMaster ? linkedMaster.grandTotal : (t.session?.grandTotal || Math.round((billSubtotal + billGst) * 100) / 100);
      let billPaymentMode = linkedMaster?.paymentMode || t.session?.paymentPreferred || (t.session?.paymentMethod) || null;
      let billPaymentStatus = linkedMaster ? 'PAID' : (t.session?.paymentStatus || 'PENDING');
      let billSettledAt = linkedMaster?.settledAt || null;

      // Calculate round index within session
      const sessionTickets = t.session?.orderTickets || [];
      const totalRounds = Math.max(1, sessionTickets.length);
      const ticketIdx = sessionTickets.findIndex((st) => st.id === t.id);
      const roundNumber = ticketIdx >= 0 ? ticketIdx + 1 : 1;

      const sessionRounds = sessionTickets.map((st, idx) => {
        const roundSubtotal = st.items.reduce((sum, it) => sum + (it.unitPrice || 0) * (it.quantity || 1), 0);
        return {
          ticketNumber: st.ticketNumber,
          roundNumber: idx + 1,
          placedAt: new Date(st.placedAt).toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          }),
          itemsCount: st.items.length,
          subtotal: roundSubtotal,
          itemsSummary: st.items.map((it) => `${it.quantity}x ${it.itemName}`).join(', '),
        };
      });

      return {
        id: t.id,
        ticketNumber: t.ticketNumber,
        orderType: t.orderType,
        seatId: t.seatId,
        sessionId: t.sessionId,
        customerName: t.customerName,
        customerPhone: t.customerPhone,
        totalAmount,
        roundNumber,
        totalRounds,
        sessionRounds,
        invoiceNumber: billNumber,
        billSubtotal,
        billGst,
        billGrandTotal,
        billPaymentMode,
        billPaymentStatus,
        billSettledAt,
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

    const formattedMasterRecords = allMasterRecords.map((m) => ({
      id: m.id,
      billNumber: m.billNumber,
      date: m.date,
      orderType: m.orderType,
      seatNumberOrToken: m.seatNumberOrToken,
      customerName: m.customerName,
      customerPhone: m.customerPhone,
      serverName: m.serverName,
      itemsSummary: m.itemsSummary,
      placedAt: m.placedAt,
      settledAt: m.settledAt,
      subtotal: m.subtotal,
      discountAmount: m.discountAmount,
      packagingCharges: m.packagingCharges,
      gst5Percent: m.gst5Percent,
      grandTotal: m.grandTotal,
      paymentMode: m.paymentMode,
      paymentStatus: m.paymentStatus,
      createdAt: m.createdAt,
    }));

    return NextResponse.json(
      {
        success: true,
        data: formattedTickets,
        masterBills: formattedMasterRecords,
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
