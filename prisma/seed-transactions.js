const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const seedData = [
    {
      billNumber: 'INV-101',
      date: '25-10-2026',
      orderType: 'Dine-in',
      seatNumberOrToken: 'S1',
      customerName: 'Rahul',
      serverName: 'Suhas',
      itemsSummary: '1x Biryani, 2x Kabab',
      placedAt: '12:20 PM',
      settledAt: '12:48 PM',
      subtotal: 552.0,
      gst5Percent: 28.0,
      grandTotal: 580.0,
      paymentMode: 'Cash',
      paymentStatus: 'PAID'
    },
    {
      billNumber: 'INV-102',
      date: '25-10-2026',
      orderType: 'Dine-in',
      seatNumberOrToken: 'S3',
      customerName: 'Priya',
      serverName: 'Suhas',
      itemsSummary: '1x Biryani, 1x Fry, 2x P',
      placedAt: '12:15 PM',
      settledAt: '12:44 PM',
      subtotal: 520.0,
      gst5Percent: 26.0,
      grandTotal: 546.0,
      paymentMode: 'UPI',
      paymentStatus: 'PAID'
    },
    {
      billNumber: 'INV-103',
      date: '25-10-2026',
      orderType: 'Takeaway',
      seatNumberOrToken: 'P-48',
      customerName: 'Ramesh',
      serverName: 'Manager',
      itemsSummary: '2x Biryani, 1x Chilli',
      placedAt: '12:35 PM',
      settledAt: '12:41 PM',
      subtotal: 680.0,
      gst5Percent: 34.0,
      grandTotal: 714.0,
      paymentMode: 'Cash',
      paymentStatus: 'PAID'
    },
    {
      billNumber: 'INV-104',
      date: '25-10-2026',
      orderType: 'Dine-in',
      seatNumberOrToken: 'S10',
      customerName: 'Arun',
      serverName: 'Shiva',
      itemsSummary: '1x Biryani, 1x Chops',
      placedAt: '12:22 PM',
      settledAt: '12:50 PM',
      subtotal: 590.0,
      gst5Percent: 30.0,
      grandTotal: 620.0,
      paymentMode: 'UPI',
      paymentStatus: 'PAID'
    },
    {
      billNumber: 'INV-105',
      date: '25-10-2026',
      orderType: 'Takeaway',
      seatNumberOrToken: 'P-49',
      customerName: 'Sneha',
      serverName: 'Manager',
      itemsSummary: '1x Mutton Biryani',
      placedAt: '12:40 PM',
      settledAt: '12:45 PM',
      subtotal: 310.0,
      gst5Percent: 15.5,
      grandTotal: 325.5,
      paymentMode: 'UPI',
      paymentStatus: 'PAID'
    }
  ];

  for (const s of seedData) {
    await prisma.masterSalesRecord.upsert({
      where: { billNumber: s.billNumber },
      update: s,
      create: s
    });
  }
  console.log('Successfully upserted 5 blueprint transactions into database!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
