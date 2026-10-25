const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const modeResult = await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
  const busyResult = await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
  const syncResult = await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
  const seats = await prisma.diningSeat.count();
  const items = await prisma.menuItem.count();
  const staff = await prisma.staff.count();
  const promos = await prisma.promoCode.count();
  console.log('Database Status Check:');
  console.log('Journal Mode:', modeResult);
  console.log('Total Seats (Strictly 16):', seats);
  console.log('Total Menu Items:', items);
  console.log('Total Staff Accounts:', staff);
  console.log('Total Promo Codes:', promos);
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
