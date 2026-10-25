import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await ensureWalMode();
    const { searchParams } = new URL(req.url);
    const dateQuery = searchParams.get('date');

    const whereClause: { date?: string } = {};
    if (dateQuery) {
      whereClause.date = dateQuery;
    }

    const records = await prisma.masterSalesRecord.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    // Compute financial summary
    let grossFoodSales = 0;
    let totalGst = 0;
    let netDayRevenue = 0;
    let dineInSales = 0;
    let takeawaySales = 0;
    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;

    records.forEach((r) => {
      grossFoodSales += r.subtotal;
      totalGst += r.gst5Percent;
      netDayRevenue += r.grandTotal;

      if (r.orderType === 'Dine-in') {
        dineInSales += r.grandTotal;
      } else {
        takeawaySales += r.grandTotal;
      }

      if (r.paymentMode === 'CASH') cashSales += r.grandTotal;
      else if (r.paymentMode === 'UPI') upiSales += r.grandTotal;
      else cardSales += r.grandTotal;
    });

    return NextResponse.json({
      success: true,
      data: {
        records,
        summary: {
          grossFoodSales,
          totalGst,
          netDayRevenue,
          dineInSales,
          takeawaySales,
          totalOrders: records.length,
          dineInCount: records.filter((r) => r.orderType === 'Dine-in').length,
          takeawayCount: records.filter((r) => r.orderType === 'Takeaway').length,
          paymentSplit: {
            cash: cashSales,
            upi: upiSales,
            card: cardSales,
          },
        },
      },
    });
  } catch (error) {
    console.error('Fetch master sales error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
