import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode } from '@/lib/db';
import { emitToMultipleRooms } from '@/lib/socket-emitter';

export async function GET() {
  try {
    await ensureWalMode();
    const [promoCodes, promoCards] = await Promise.all([
      prisma.promoCode.findMany({ orderBy: { code: 'asc' } }),
      prisma.promotionalCard.findMany({
        include: { promoCode: true },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { promoCodes, promoCards },
    });
  } catch (error) {
    console.error('Fetch promos error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureWalMode();
    const body = await req.json();
    const { action, promoCode, promoCard } = body;

    if (action === 'CREATE_PROMO_CODE') {
      const created = await prisma.promoCode.create({
        data: {
          code: String(promoCode.code).toUpperCase().trim(),
          discountType: promoCode.discountType || 'FLAT',
          value: parseFloat(promoCode.value) || 0,
          minOrderValue: parseFloat(promoCode.minOrderValue) || 0,
          maxDiscount: promoCode.maxDiscount ? parseFloat(promoCode.maxDiscount) : null,
          startDate: promoCode.startDate ? new Date(promoCode.startDate) : null,
          endDate: promoCode.endDate ? new Date(promoCode.endDate) : null,
          startTime: promoCode.startTime || null,
          endTime: promoCode.endTime || null,
          daysOfWeek: promoCode.daysOfWeek || 'ALL',
          usageLimit: promoCode.usageLimit ? parseInt(promoCode.usageLimit, 10) : null,
          isActive: true,
        },
      });

      emitToMultipleRooms(['room:global', 'room:manager'], 'promos:updated', { type: 'CODE_CREATED' });
      return NextResponse.json({ success: true, data: created });
    }

    if (action === 'UPDATE_PROMO_CODE') {
      const updated = await prisma.promoCode.update({
        where: { id: promoCode.id },
        data: {
          code: String(promoCode.code).toUpperCase().trim(),
          discountType: promoCode.discountType || 'FLAT',
          value: parseFloat(promoCode.value) || 0,
          minOrderValue: parseFloat(promoCode.minOrderValue) || 0,
          maxDiscount: promoCode.maxDiscount ? parseFloat(promoCode.maxDiscount) : null,
          startDate: promoCode.startDate ? new Date(promoCode.startDate) : null,
          endDate: promoCode.endDate ? new Date(promoCode.endDate) : null,
          startTime: promoCode.startTime || null,
          endTime: promoCode.endTime || null,
          daysOfWeek: promoCode.daysOfWeek || 'ALL',
          usageLimit: promoCode.usageLimit ? parseInt(promoCode.usageLimit, 10) : null,
          isActive: promoCode.isActive !== undefined ? Boolean(promoCode.isActive) : true,
        },
      });

      emitToMultipleRooms(['room:global', 'room:manager'], 'promos:updated', { type: 'CODE_UPDATED' });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'DELETE_PROMO_CODE') {
      await prisma.promoCode.delete({ where: { id: promoCode.id } });
      emitToMultipleRooms(['room:global', 'room:manager'], 'promos:updated', { type: 'CODE_DELETED' });
      return NextResponse.json({ success: true });
    }

    if (action === 'CREATE_PROMO_CARD') {
      const createdCard = await prisma.promotionalCard.create({
        data: {
          title: promoCard.title,
          subtitle: promoCard.subtitle,
          badgeText: promoCard.badgeText || null,
          promoCodeId: promoCard.promoCodeId || null,
          imageUrl: promoCard.imageUrl || null,
          startDate: promoCard.startDate ? new Date(promoCard.startDate) : null,
          endDate: promoCard.endDate ? new Date(promoCard.endDate) : null,
          startTime: promoCard.startTime || null,
          endTime: promoCard.endTime || null,
          daysOfWeek: promoCard.daysOfWeek || 'ALL',
          isActive: true,
        },
      });

      emitToMultipleRooms(['room:global', 'room:manager'], 'promos:updated', { type: 'CARD_CREATED' });
      return NextResponse.json({ success: true, data: createdCard });
    }

    if (action === 'UPDATE_PROMO_CARD') {
      const updatedCard = await prisma.promotionalCard.update({
        where: { id: promoCard.id },
        data: {
          title: promoCard.title,
          subtitle: promoCard.subtitle,
          badgeText: promoCard.badgeText || null,
          promoCodeId: promoCard.promoCodeId || null,
          imageUrl: promoCard.imageUrl || null,
          startDate: promoCard.startDate ? new Date(promoCard.startDate) : null,
          endDate: promoCard.endDate ? new Date(promoCard.endDate) : null,
          startTime: promoCard.startTime || null,
          endTime: promoCard.endTime || null,
          daysOfWeek: promoCard.daysOfWeek || 'ALL',
          isActive: promoCard.isActive !== undefined ? Boolean(promoCard.isActive) : true,
        },
      });

      emitToMultipleRooms(['room:global', 'room:manager'], 'promos:updated', { type: 'CARD_UPDATED' });
      return NextResponse.json({ success: true, data: updatedCard });
    }

    if (action === 'DELETE_PROMO_CARD') {
      await prisma.promotionalCard.delete({ where: { id: promoCard.id } });
      emitToMultipleRooms(['room:global', 'room:manager'], 'promos:updated', { type: 'CARD_DELETED' });
      return NextResponse.json({ success: true });
    }

    if (action === 'TOGGLE_CODE') {
      const updated = await prisma.promoCode.update({
        where: { id: promoCode.id },
        data: { isActive: Boolean(promoCode.isActive) },
      });
      emitToMultipleRooms(['room:global', 'room:manager'], 'promos:updated', { type: 'CODE_TOGGLED' });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'TOGGLE_CARD') {
      const updated = await prisma.promotionalCard.update({
        where: { id: promoCard.id },
        data: { isActive: Boolean(promoCard.isActive) },
      });
      emitToMultipleRooms(['room:global', 'room:manager'], 'promos:updated', { type: 'CARD_TOGGLED' });
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Save promo error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
