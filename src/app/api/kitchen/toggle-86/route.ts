import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode } from '@/lib/db';
import { emitToMultipleRooms } from '@/lib/socket-emitter';

export async function POST(req: NextRequest) {
  try {
    await ensureWalMode();
    const { menuItemId, isAvailable } = await req.json();

    if (!menuItemId) {
      return NextResponse.json({ success: false, error: 'Menu Item ID required' }, { status: 400 });
    }

    const updated = await prisma.menuItem.update({
      where: { id: menuItemId },
      data: { isAvailable: Boolean(isAvailable) },
    });

    emitToMultipleRooms(['room:global', 'room:kitchen', 'room:manager'], 'menu:86_toggled', {
      menuItemId: updated.id,
      name: updated.name,
      isAvailable: updated.isAvailable,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Toggle 86 error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
