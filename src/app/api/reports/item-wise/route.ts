import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    await ensureWalMode();

    const dateParam = req.nextUrl.searchParams.get('date');
    let dateFilter: any = {};

    if (dateParam && dateParam !== 'ALL') {
      const parts = dateParam.split('-');
      if (parts.length === 3) {
        const [day, month, year] = parts.map(Number);
        // Business day in IST: starts at 12:00:00 AM midnight (+05:30) and ends at 11:59:59.999 PM (+05:30)
        const startOfDay = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000+05:30`);
        const endOfDay = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59.999+05:30`);

        dateFilter = {
          placedAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        };
      }
    }

    const orderItems = await prisma.orderItem.findMany({
      where: {
        status: { not: 'cancelled' },
        ...dateFilter,
      },
      include: {
        menuItem: {
          include: { category: true },
        },
      },
    });

    const itemMap = new Map<
      string,
      {
        name: string;
        categoryName: string;
        unitPrice: number;
        qtySold: number;
        revenue: number;
      }
    >();

    let totalGross = 0;

    orderItems.forEach((oi) => {
      const key = oi.itemName;
      const existing = itemMap.get(key);
      const rev = oi.unitPrice * oi.quantity;
      totalGross += rev;

      if (existing) {
        existing.qtySold += oi.quantity;
        existing.revenue += rev;
      } else {
        itemMap.set(key, {
          name: oi.itemName,
          categoryName: oi.menuItem?.category?.name || 'Specialty',
          unitPrice: oi.unitPrice,
          qtySold: oi.quantity,
          revenue: rev,
        });
      }
    });

    const report = Array.from(itemMap.values()).map((row) => ({
      ...row,
      contributionPercent: totalGross > 0 ? Math.round((row.revenue / totalGross) * 1000) / 10 : 0,
    }));

    report.sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      success: true,
      data: {
        report,
        totalRevenue: totalGross,
      },
    });
  } catch (error) {
    console.error('Fetch item-wise error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
