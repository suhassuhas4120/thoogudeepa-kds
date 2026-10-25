import { NextResponse } from 'next/server';
import { prisma, ensureWalMode } from '@/lib/db';

export async function GET() {
  try {
    await ensureWalMode();

    const orderItems = await prisma.orderItem.findMany({
      where: { status: { not: 'cancelled' } },
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
