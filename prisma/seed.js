const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding THOOGUDEEPA DONNE BIRYANI MANE database with authentic dishes...');

  // 1. Clear existing data
  await prisma.masterSalesRecord.deleteMany();
  await prisma.shiftCashAudit.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.orderTicket.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.diningSession.deleteMany();
  await prisma.diningSeat.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.promotionalCard.deleteMany();
  await prisma.promoCode.deleteMany();
  await prisma.staff.deleteMany();

  // 2. Seed 16 Seats (Strictly Seats 1 to 16, Zero Tables)
  console.log('Seeding 16 Dining Seats...');
  for (let i = 1; i <= 16; i++) {
    const isZoneA = i <= 8;
    await prisma.diningSeat.create({
      data: {
        id: i,
        seatNumber: i,
        zone: isZoneA ? 'ZONE_A' : 'ZONE_B',
        assignedWaiter: isZoneA ? 'Suhas' : 'Shiva',
        status: 'VACANT',
        currentGuestName: '-',
      },
    });
  }

  // 3. Seed Staff Members with 4-Digit PINs
  console.log('Seeding Staff Accounts...');
  await prisma.staff.create({
    data: {
      name: 'Suhas',
      role: 'WAITER',
      pin: '1111',
      assignedZone: 'ZONE_A_S1_S8',
      isActive: true,
    },
  });

  await prisma.staff.create({
    data: {
      name: 'Shiva',
      role: 'WAITER',
      pin: '2222',
      assignedZone: 'ZONE_B_S9_S16',
      isActive: true,
    },
  });

  await prisma.staff.create({
    data: {
      name: 'Head Chef',
      role: 'KITCHEN',
      pin: '3333',
      assignedZone: 'ALL',
      isActive: true,
    },
  });

  await prisma.staff.create({
    data: {
      name: 'General Manager',
      role: 'MANAGER',
      pin: '9999',
      assignedZone: 'ALL',
      isActive: true,
    },
  });

  // 4. Seed Menu Categories
  console.log('Seeding Authentic Menu Categories...');
  const catBiryani = await prisma.menuCategory.create({
    data: {
      name: 'Donne Biryani & Rice',
      slug: 'donne-biryani-rice',
      displayOrder: 1,
    },
  });

  const catStarters = await prisma.menuCategory.create({
    data: {
      name: 'Starters & Sides',
      slug: 'starters-sides',
      displayOrder: 2,
    },
  });

  const catSpecials = await prisma.menuCategory.create({
    data: {
      name: 'Sunday Specials & Soups',
      slug: 'specials-soups',
      displayOrder: 3,
    },
  });

  // 5. Seed Authentic Menu Items with Real Dish Images
  console.log('Seeding Authentic Menu Items & Images...');
  const items = [
    // Donne Biryani & Rice
    {
      categoryId: catBiryani.id,
      name: 'Chicken Biryani',
      description: 'Fragrant Seeraga Samba short-grain rice cooked with tender chicken cuts, fresh mint, coriander, and native green masala, served hot in authentic leaf donne.',
      price: 170.0,
      isVeg: false,
      isAvailable: true,
      isPairWith: false,
      imageUrl: '/images/dishes/chicken-biryani.webp',
      displayOrder: 1,
    },
    {
      categoryId: catBiryani.id,
      name: 'Mutton Biryani',
      description: 'Tender country mutton slow-cooked with military hotel spices, fragrant jeera samba rice, and rich bone marrow gravy, served in traditional leaf donne.',
      price: 280.0,
      isVeg: false,
      isAvailable: true,
      isPairWith: false,
      imageUrl: '/images/dishes/mutton-biryani.webp',
      displayOrder: 2,
    },
    {
      categoryId: catBiryani.id,
      name: 'Biryani Rice',
      description: 'Aromatic Seeraga Samba kushka rice cooked in rich meat stock and fragrant whole spices without meat pieces.',
      price: 90.0,
      isVeg: false,
      isAvailable: true,
      isPairWith: true,
      imageUrl: '/images/dishes/biryani-rice.webp',
      displayOrder: 3,
    },

    // Starters & Sides
    {
      categoryId: catStarters.id,
      name: 'Chicken Kabab',
      description: 'Crispy deep-fried chicken cubes coated with curd, ginger-garlic paste, and vibrant Indian spices.',
      price: 160.0,
      isVeg: false,
      isAvailable: true,
      isPairWith: true,
      imageUrl: '/images/dishes/chicken-kabab.webp',
      displayOrder: 4,
    },
    {
      categoryId: catStarters.id,
      name: 'Chicken Fry',
      description: 'Boneless and tender chicken chunks marinated in native spice blend, shallow fried to a golden crisp.',
      price: 160.0,
      isVeg: false,
      isAvailable: true,
      isPairWith: true,
      imageUrl: '/images/dishes/chicken-fry.webp',
      displayOrder: 5,
    },
    {
      categoryId: catStarters.id,
      name: 'Chicken Pepper Dry',
      description: 'Tender chicken pieces tossed with freshly cracked black pepper, caramelized garlic, and shallots.',
      price: 160.0,
      isVeg: false,
      isAvailable: true,
      isPairWith: false,
      imageUrl: '/images/dishes/chicken-pepper-dry.webp',
      displayOrder: 6,
    },
    {
      categoryId: catStarters.id,
      name: 'Chilli Chicken',
      description: 'Bite-sized chicken chunks tossed with fiery green chillies, curry leaves, and native seasoning.',
      price: 160.0,
      isVeg: false,
      isAvailable: true,
      isPairWith: false,
      imageUrl: '/images/dishes/chilli-chicken.webp',
      displayOrder: 7,
    },
    {
      categoryId: catStarters.id,
      name: 'Chicken Chops',
      description: 'Tender chicken cuts slow-simmered in an intensely fragrant green herb and mint-coriander gravy.',
      price: 160.0,
      isVeg: false,
      isAvailable: true,
      isPairWith: false,
      imageUrl: '/images/dishes/chicken-chops.webp',
      displayOrder: 8,
    },
    {
      categoryId: catStarters.id,
      name: 'Chicken Leg Piece (2pcs)',
      description: 'Two succulent whole chicken drumsticks marinated in aromatic spices and roasted to tenderness.',
      price: 160.0,
      isVeg: false,
      isAvailable: true,
      isPairWith: true,
      imageUrl: '/images/dishes/chicken-leg-piece-2pcs.webp',
      displayOrder: 9,
    },
    {
      categoryId: catStarters.id,
      name: 'Chicken Leg Piece (1pc)',
      description: 'Single tender whole chicken drumstick seasoned and roasted in traditional military masala.',
      price: 80.0,
      isVeg: false,
      isAvailable: true,
      isPairWith: true,
      imageUrl: '/images/dishes/chicken-leg-piece-1pc.webp',
      displayOrder: 10,
    },
    {
      categoryId: catStarters.id,
      name: 'Mutton Fry',
      description: 'Tender chunks of fresh country mutton pan-tossed with shallots, crushed spices, and curry leaves.',
      price: 260.0,
      isVeg: false,
      isAvailable: true,
      isPairWith: false,
      imageUrl: '/images/dishes/mutton-fry.webp',
      displayOrder: 11,
    },
    {
      categoryId: catStarters.id,
      name: 'Mutton Dry',
      description: 'Succulent mutton cuts slow-roasted with black pepper, roasted coriander, and caramelized onions.',
      price: 260.0,
      isVeg: false,
      isAvailable: true,
      isPairWith: false,
      imageUrl: '/images/dishes/mutton-dry.webp',
      displayOrder: 12,
    },
    {
      categoryId: catStarters.id,
      name: 'Mutton Chops',
      description: 'Juicy rib chops marinated in authentic military green masala and braised to tender perfection.',
      price: 260.0,
      isVeg: false,
      isAvailable: true,
      isPairWith: false,
      imageUrl: '/images/dishes/mutton-chops.webp',
      displayOrder: 13,
    },
    {
      categoryId: catStarters.id,
      name: 'Mutton Liver',
      description: 'Fresh mutton liver pieces pan-roasted with black peppercorns, browned onions, and curry leaves.',
      price: 240.0,
      isVeg: false,
      isAvailable: true,
      isPairWith: false,
      imageUrl: '/images/dishes/mutton-liver.webp',
      displayOrder: 14,
    },
    {
      categoryId: catStarters.id,
      name: 'Botti Gujju',
      description: 'Classic Bangalore military hotel goat tripe curry prepared in thick aromatic spice reduction.',
      price: 180.0,
      isVeg: false,
      isAvailable: true,
      isPairWith: false,
      imageUrl: '/images/dishes/booti-gojju.webp',
      displayOrder: 15,
    },
    {
      categoryId: catStarters.id,
      name: 'Keema Ball',
      description: 'Crispy deep-fried seasoned minced mutton meatballs with aromatic herbs and crunch exterior.',
      price: 180.0,
      isVeg: false,
      isAvailable: true,
      isPairWith: true,
      imageUrl: '/images/dishes/keema-ball.webp',
      displayOrder: 16,
    },

    // Sunday Specials & Soups
    {
      categoryId: catSpecials.id,
      name: 'Kaalu Soup',
      description: 'Traditional military hotel mutton trotter soup slow-simmered with crushed black pepper, bone marrow, and fresh coriander.',
      price: 120.0,
      isVeg: false,
      isAvailable: true,
      isPairWith: true,
      imageUrl: '/images/dishes/kaalu-soup.webp',
      displayOrder: 17,
    },
    {
      categoryId: catSpecials.id,
      name: 'Plain Soup',
      description: 'Aromatic clear mutton bone broth spiced with peppercorns, garlic, and fresh herbs without trotter cuts.',
      price: 25.0,
      isVeg: false,
      isAvailable: true,
      isPairWith: true,
      imageUrl: '/images/dishes/plain-soup.webp',
      displayOrder: 18,
    },
    {
      categoryId: catSpecials.id,
      name: 'Idli (2pcs)',
      description: 'Ultra-soft, steamed rice cakes served hot on banana leaf, ideal pairing with mutton curries and kaalu soup.',
      price: 50.0,
      isVeg: true,
      isAvailable: true,
      isPairWith: true,
      imageUrl: '/images/dishes/idli-2pcs.webp',
      displayOrder: 19,
    },
    {
      categoryId: catSpecials.id,
      name: 'Dosa (2pcs)',
      description: 'Soft, golden spongy set dosas cooked to perfection on an iron tawa, served hot.',
      price: 50.0,
      isVeg: true,
      isAvailable: true,
      isPairWith: true,
      imageUrl: '/images/dishes/dosa-2pcs.webp',
      displayOrder: 20,
    },
    {
      categoryId: catSpecials.id,
      name: 'Keema Gojju',
      description: 'Fine minced mutton simmered into a deeply flavored rustic gravy with ground spices and fresh mint.',
      price: 180.0,
      isVeg: false,
      isAvailable: true,
      isPairWith: false,
      imageUrl: '/images/dishes/keema-gojju.webp',
      displayOrder: 21,
    },
  ];

  for (const item of items) {
    await prisma.menuItem.create({ data: item });
  }

  // 6. Seed Promo Codes
  console.log('Seeding Promo Codes...');
  const promoCombo = await prisma.promoCode.create({
    data: {
      code: 'COMBO399',
      discountType: 'FLAT',
      value: 81.0,
      minOrderValue: 399.0,
      maxDiscount: 81.0,
      daysOfWeek: 'ALL',
      usageLimit: 1000,
      timesUsed: 14,
      isActive: true,
    },
  });

  const promo50 = await prisma.promoCode.create({
    data: {
      code: 'DONNE50',
      discountType: 'FLAT',
      value: 50.0,
      minOrderValue: 400.0,
      maxDiscount: 50.0,
      daysOfWeek: 'ALL',
      usageLimit: 500,
      timesUsed: 42,
      isActive: true,
    },
  });

  // 7. Seed Promotional Banner Cards (Customer Screen 2 Carousel)
  console.log('Seeding Promotional Banner Cards...');
  await prisma.promotionalCard.create({
    data: {
      title: 'Authentic Donne Combo Feast',
      subtitle: 'Chicken Donne Biryani + Chicken Kabab at special combo price',
      badgeText: 'COMBO399',
      promoCodeId: promoCombo.id,
      imageUrl: '/images/dishes/chicken-biryani.webp',
      displayOrder: 1,
      isActive: true,
    },
  });

  await prisma.promotionalCard.create({
    data: {
      title: 'Weekend Biryani Special',
      subtitle: 'Flat ₹50 OFF on Mutton Biryani and Soups above ₹400',
      badgeText: 'DONNE50',
      promoCodeId: promo50.id,
      imageUrl: '/images/dishes/mutton-biryani.webp',
      displayOrder: 2,
      isActive: true,
    },
  });

  console.log('Database seeding successfully finished with 21 authentic items!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
