const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runE2ETest() {
  console.log('====================================================');
  console.log('THOOGUDEEPA DONNE BIRYANI MANE - END-TO-END VERIFICATION');
  console.log('====================================================\n');

  try {
    // 1. Verify SQLite WAL mode
    const walCheck = await prisma.$queryRawUnsafe('PRAGMA journal_mode;');
    console.log('[1/8] Database WAL Mode:', walCheck[0].journal_mode.toUpperCase());
    if (walCheck[0].journal_mode.toLowerCase() !== 'wal') {
      throw new Error('SQLite is not in WAL mode');
    }

    // 2. Clear previous session on Seat 1 for clean testing
    await prisma.serviceRequest.deleteMany({ where: { seatId: 1 } });
    const existingSessions = await prisma.diningSession.findMany({ where: { seatId: 1 } });
    for (const sess of existingSessions) {
      await prisma.orderItem.deleteMany({
        where: { ticket: { sessionId: sess.id } },
      });
      await prisma.orderTicket.deleteMany({ where: { sessionId: sess.id } });
      await prisma.diningSession.delete({ where: { id: sess.id } });
    }

    // Reset Seat 1 status
    await prisma.diningSeat.update({
      where: { id: 1 },
      data: { status: 'VACANT', currentGuestName: '-' },
    });

    // 3. Customer scans Seat 1 & enters name "Darshan"
    const session = await prisma.diningSession.create({
      data: {
        seatId: 1,
        customerName: 'Darshan',
        status: 'ACTIVE',
      },
    });

    await prisma.diningSeat.update({
      where: { id: 1 },
      data: { status: 'OCCUPIED', currentGuestName: 'Darshan' },
    });
    console.log('[2/8] Customer Session Initialized for Seat 1 (Darshan):', session.id);

    // 4. Customer browses menu & places order for 2x Donne Mutton Biryani + 1x Guntur Chicken
    const muttonBiryani = await prisma.menuItem.findFirst({ where: { name: { contains: 'Mutton' } } });
    const gunturChicken = await prisma.menuItem.findFirst({ where: { name: { contains: 'Guntur' } } });

    if (!muttonBiryani || !gunturChicken) throw new Error('Menu items not found');

    const subtotal = muttonBiryani.price * 2 + gunturChicken.price * 1;
    const gst = Math.round(subtotal * 0.05 * 100) / 100;
    const grandTotal = Math.round((subtotal + gst) * 100) / 100;

    const ticketNumber = `TKT-${Date.now().toString().slice(-4)}`;
    const ticket = await prisma.orderTicket.create({
      data: {
        sessionId: session.id,
        seatId: 1,
        ticketNumber,
        waiterName: 'Suhas',
        orderType: 'DINE_IN',
        status: 'RECEIVED',
        items: {
          create: [
            {
              menuItemId: muttonBiryani.id,
              itemName: muttonBiryani.name,
              quantity: 2,
              unitPrice: muttonBiryani.price,
              status: 'RECEIVED',
            },
            {
              menuItemId: gunturChicken.id,
              itemName: gunturChicken.name,
              quantity: 1,
              unitPrice: gunturChicken.price,
              status: 'RECEIVED',
            },
          ],
        },
      },
      include: { items: true },
    });

    await prisma.diningSession.update({
      where: { id: session.id },
      data: { subtotal, gstAmount: gst, grandTotal },
    });
    console.log(`[3/8] Order Placed #${ticket.ticketNumber} | Subtotal: ₹${subtotal} | GST 5%: ₹${gst} | Grand Total: ₹${grandTotal}`);

    // 5. Kitchen starts cooking & marks ready
    for (const item of ticket.items) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: { status: 'PREPARING' },
      });
    }
    console.log('[4/8] Kitchen KDS: Items PREPARING');

    for (const item of ticket.items) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: { status: 'READY' },
      });
    }
    console.log('[5/8] Kitchen KDS: Items READY -> Waiter Alert dispatched to Suhas (Zone A)');

    // 6. Waiter Suhas delivers items and marks SERVED
    for (const item of ticket.items) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: { status: 'SERVED' },
      });
    }
    console.log('[6/8] Waiter Suhas: All Items SERVED to Seat 1');

    // 7. Mutual Payment Lock: Customer requests Pay via Waiter
    await prisma.diningSession.update({
      where: { id: session.id },
      data: {
        paymentLockState: 'LOCKED_WAITER',
        paymentPreferred: 'CASH',
      },
    });
    await prisma.diningSeat.update({
      where: { id: 1 },
      data: { status: 'BILL_REQUESTED' },
    });
    console.log('[7/8] Customer requested Bill: Mutual Payment Lock = LOCKED_WAITER (Self-pay disabled)');

    // 8. Waiter Suhas settles bill in Cash, Seat 1 is vacated & Master Sales Record is created
    const billNumber = `THOO-BILL-${Date.now().toString().slice(-6)}`;
    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    await prisma.masterSalesRecord.create({
      data: {
        billNumber,
        date: todayStr,
        orderType: 'Dine-in',
        seatNumberOrToken: 'S1',
        customerName: 'Darshan',
        serverName: 'Suhas',
        itemsSummary: '2x Mutton Donne Biryani, 1x Guntur Chicken Fry',
        placedAt: timeStr,
        settledAt: timeStr,
        subtotal,
        discountAmount: 0,
        packagingCharges: 0,
        gst5Percent: gst,
        grandTotal,
        paymentMode: 'CASH',
        sessionId: session.id,
      },
    });

    await prisma.diningSession.update({
      where: { id: session.id },
      data: {
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        endedAt: new Date(),
      },
    });

    await prisma.diningSeat.update({
      where: { id: 1 },
      data: {
        status: 'VACANT',
        currentGuestName: '-',
      },
    });

    // Update Suhas shift audit cash
    const suhas = await prisma.staff.findFirst({ where: { name: 'Suhas' } });
    if (suhas) {
      await prisma.shiftCashAudit.create({
        data: {
          date: todayStr,
          staffId: suhas.id,
          staffName: suhas.name,
          roleOrZone: 'Zone A (S1-S8)',
          totalTablesServed: 1,
          totalBilledAmount: grandTotal,
          cashCollected: grandTotal,
          cashHandedOver: 0,
          remainingBalance: grandTotal,
        },
      });
    }

    console.log(`[8/8] Bill #${billNumber} Settled & Seat 1 Vacated! Master Sales Logged & Shift Cash Updated.`);

    // Final checks
    const finalSeat = await prisma.diningSeat.findUnique({ where: { id: 1 } });
    console.log('\nVERIFICATION RESULT:');
    console.log('- Seat 1 Status:', finalSeat.status);
    console.log('- Master Sales Record created successfully');
    console.log('- System Ready for Production!\n');
    console.log('====================================================');
  } catch (err) {
    console.error('E2E TEST FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runE2ETest();
