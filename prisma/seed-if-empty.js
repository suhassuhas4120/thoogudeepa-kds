const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const seatCount = await prisma.diningSeat.count();
  if (seatCount === 0) {
    console.log('[Seed] Database is empty. Running initial seeder...');
    require('./seed.js');
  } else {
    console.log(`[Seed] Database already initialized with ${seatCount} seats. Skipping seeder.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
