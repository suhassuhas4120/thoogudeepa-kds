import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode, sqliteWriteQueue } from '@/lib/db';
import { emitToMultipleRooms } from '@/lib/socket-emitter';

export async function POST(req: NextRequest) {
  try {
    await ensureWalMode();
    const body = await req.json();
    const { customerName, customerPhone, items, paymentMode, packagingCharges = 20.0 } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Items list required' }, { status: 400 });
    }

    const result = await sqliteWriteQueue.enqueue(async () => {
      // 1. Fetch official item details
      const itemIds = items.map((i: { menuItemId: string }) => i.menuItemId);
      const dbItems = await prisma.menuItem.findMany({
        where: { id: { in: itemIds } },
      });
      const dbItemMap = new Map(dbItems.map((item) => [item.id, item]));

      let subtotal = 0;
      const itemsSummaryArray: string[] = [];

      items.forEach((i: { menuItemId: string; quantity: number }) => {
        const dbItem = dbItemMap.get(i.menuItemId);
        if (dbItem) {
          const qty = Math.max(1, i.quantity || 1);
          subtotal += dbItem.price * qty;
          itemsSummaryArray.push(`${qty}x ${dbItem.name} (Parcel)`);
        }
      });

      const packaging = parseFloat(packagingCharges) || 0.0;
      const taxable = subtotal + packaging;
      const gst = Math.round(taxable * 0.05 * 100) / 100;
      const grandTotal = Math.round((taxable + gst) * 100) / 100;

      // 2. Generate Parcel Token #
      const parcelCount = await prisma.orderTicket.count({ where: { orderType: 'PARCEL' } });
      const parcelToken = `P-${String(parcelCount + 1).padStart(2, '0')}`;

      const now = new Date();
      const formattedDate = now.toLocaleDateString('en-GB').replace(/\//g, '-');
      const formattedPlacedTime = now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      // 3. Create Kitchen OrderTicket
      const orderTicket = await prisma.orderTicket.create({
        data: {
          ticketNumber: parcelToken,
          orderType: 'PARCEL',
          customerName: customerName || 'Takeaway Guest',
          customerPhone: customerPhone || '-',
          placedAt: now,
          status: 'RECEIVED',
          specialNotes: 'PACKAGING REQUIRED (TAKEAWAY)',
          waiterName: 'Manager Desk',
          items: {
            create: items.map((i: { menuItemId: string; quantity: number }) => {
              const dbItem = dbItemMap.get(i.menuItemId)!;
              return {
                menuItemId: dbItem.id,
                itemName: `${dbItem.name} (Parcel)`,
                unitPrice: dbItem.price,
                quantity: Math.max(1, i.quantity || 1),
                specialNotes: 'Takeaway Container',
                status: 'placed',
                placedAt: now,
              };
            }),
          },
        },
        include: {
          items: true,
        },
      });

      // 4. Create Master Sales Record
      const masterCount = await prisma.masterSalesRecord.count();
      const billNumber = `INV-${101 + masterCount}`;

      const masterRecord = await prisma.masterSalesRecord.create({
        data: {
          billNumber,
          date: formattedDate,
          orderType: 'Takeaway',
          seatNumberOrToken: parcelToken,
          customerName: customerName && customerName.trim().length > 0 ? customerName.trim() : '(-)',
          customerPhone: customerPhone || '-',
          serverName: 'Manager',
          itemsSummary: itemsSummaryArray.join(', ') || 'Takeaway Parcel',
          placedAt: formattedPlacedTime,
          settledAt: formattedPlacedTime,
          subtotal,
          discountAmount: 0.0,
          packagingCharges: packaging,
          gst5Percent: gst,
          grandTotal,
          paymentMode: (paymentMode || 'CASH').toUpperCase(),
          paymentStatus: 'PAID',
        },
      });

      // 5. Broadcast to Kitchen & Manager
      const broadcastPayload = {
        ticket: {
          id: orderTicket.id,
          ticketNumber: orderTicket.ticketNumber,
          orderType: 'PARCEL',
          customerName: orderTicket.customerName,
          placedAtTime: formattedPlacedTime,
          status: 'RECEIVED',
          waiterName: 'Manager Desk',
          specialNotes: 'PACKAGING REQUIRED (TAKEAWAY)',
          items: orderTicket.items.map((it) => ({
            id: it.id,
            itemName: it.itemName,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            status: it.status,
            specialNotes: it.specialNotes,
          })),
        },
        masterRecord,
      };

      emitToMultipleRooms(['room:kitchen', 'room:manager', 'room:global'], 'order:placed', broadcastPayload);

      return {
        status: 200,
        payload: {
          success: true,
          data: {
            orderTicket,
            masterRecord,
          },
        },
      };
    });

    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    console.error('Create parcel error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
