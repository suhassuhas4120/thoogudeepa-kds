import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode } from '@/lib/db';
import { emitToMultipleRooms } from '@/lib/socket-emitter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    await ensureWalMode();

    const [categories, items, promoCards, promoCodes] = await Promise.all([
      prisma.menuCategory.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      }),
      prisma.menuItem.findMany({
        include: { category: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.promotionalCard.findMany({
        where: { isActive: true },
        include: { promoCode: true },
        orderBy: { displayOrder: 'asc' },
      }),
      prisma.promoCode.findMany({
        where: { isActive: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        categories,
        items,
        promoCards,
        promoCodes,
      },
    });
  } catch (error) {
    console.error('Fetch menu error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureWalMode();
    const body = await req.json();
    const { name, categoryId, price, description, isVeg, isPairWith, imageUrl, displayOrder } = body;

    if (!name || !categoryId || price === undefined) {
      return NextResponse.json({ success: false, error: 'Name, Category, and Price are required' }, { status: 400 });
    }

    const created = await prisma.menuItem.create({
      data: {
        name: name.trim(),
        categoryId,
        price: parseFloat(price) || 0,
        description: description?.trim() || null,
        isVeg: Boolean(isVeg),
        isPairWith: Boolean(isPairWith),
        imageUrl: imageUrl?.trim() || null,
        displayOrder: parseInt(displayOrder, 10) || 0,
        isAvailable: true,
      },
      include: { category: true },
    });

    emitToMultipleRooms(['room:global', 'room:kitchen', 'room:manager', 'room:waiter:all'], 'menu:updated', { type: 'ITEM_CREATED', item: created });
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error('Create menu item error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await ensureWalMode();
    const body = await req.json();
    const { id, name, categoryId, price, description, isVeg, isPairWith, isAvailable, imageUrl, displayOrder } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Item ID required' }, { status: 400 });
    }

    const updated = await prisma.menuItem.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(categoryId && { categoryId }),
        ...(price !== undefined && { price: parseFloat(price) || 0 }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(isVeg !== undefined && { isVeg: Boolean(isVeg) }),
        ...(isPairWith !== undefined && { isPairWith: Boolean(isPairWith) }),
        ...(isAvailable !== undefined && { isAvailable: Boolean(isAvailable) }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl?.trim() || null }),
        ...(displayOrder !== undefined && { displayOrder: parseInt(displayOrder, 10) || 0 }),
      },
      include: { category: true },
    });

    emitToMultipleRooms(['room:global', 'room:kitchen', 'room:manager', 'room:waiter:all'], 'menu:updated', { type: 'ITEM_UPDATED', item: updated });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update menu item error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureWalMode();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Item ID required' }, { status: 400 });
    }

    // Check if item has order tickets
    const orderItemsCount = await prisma.orderItem.count({ where: { menuItemId: id } });
    if (orderItemsCount > 0) {
      // Soft disable if already ordered historically
      const updated = await prisma.menuItem.update({
        where: { id },
        data: { isAvailable: false },
      });
      emitToMultipleRooms(['room:global', 'room:kitchen', 'room:manager', 'room:waiter:all'], 'menu:updated', { type: 'ITEM_DISABLED', id });
      return NextResponse.json({ success: true, message: 'Item archived/disabled because it has order history', data: updated });
    }

    await prisma.menuItem.delete({ where: { id } });
    emitToMultipleRooms(['room:global', 'room:kitchen', 'room:manager', 'room:waiter:all'], 'menu:updated', { type: 'ITEM_DELETED', id });
    return NextResponse.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    console.error('Delete menu item error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
