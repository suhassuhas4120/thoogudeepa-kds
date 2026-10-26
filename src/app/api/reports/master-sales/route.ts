import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await ensureWalMode();
    const { searchParams } = new URL(req.url);
    const dateQuery = searchParams.get('date');

    let whereClause: any = {};
    if (dateQuery && dateQuery !== 'ALL') {
      let altDate = dateQuery;
      if (dateQuery.includes('-')) {
        const parts = dateQuery.split('-');
        if (parts[0].length === 4) {
          // YYYY-MM-DD -> DD-MM-YYYY
          altDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        } else if (parts[2].length === 4) {
          // DD-MM-YYYY -> YYYY-MM-DD
          altDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      whereClause = {
        OR: [
          { date: dateQuery },
          { date: altDate }
        ]
      };
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

      if (r.orderType.toLowerCase().includes('dine')) {
        dineInSales += r.grandTotal;
      } else {
        takeawaySales += r.grandTotal;
      }

      const mode = (r.paymentMode || '').toUpperCase();
      if (mode.includes('CASH')) cashSales += r.grandTotal;
      else if (mode.includes('UPI')) upiSales += r.grandTotal;
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
