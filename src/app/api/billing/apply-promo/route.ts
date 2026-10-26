import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode, sqliteWriteQueue } from '@/lib/db';
import { emitToMultipleRooms, SocketRoom } from '@/lib/socket-emitter';

export async function POST(req: NextRequest) {
  try {
    await ensureWalMode();
    const body = await req.json();
    const { seatId, promoCode } = body;

    if (!seatId) {
      return NextResponse.json({ success: false, error: 'Seat ID is required' }, { status: 400 });
    }

    const result = await sqliteWriteQueue.enqueue(async () => {
      const seat = await prisma.diningSeat.findUnique({
        where: { id: parseInt(seatId, 10) },
        include: {
          sessions: {
            where: { status: 'ACTIVE' },
            include: {
              orderTickets: {
                include: { items: true },
              },
            },
          },
        },
      });

      if (!seat) {
        return { status: 404, payload: { success: false, error: 'Seat not found' } };
      }

      const session = seat.sessions[0];
      if (!session) {
        return { status: 400, payload: { success: false, error: 'No active session found for seat' } };
      }

      // If clearing promo code
      if (!promoCode || typeof promoCode !== 'string' || promoCode.trim() === '') {
        const taxable = session.subtotal;
        const gst = session.gstAmount || Math.round(taxable * 0.05 * 100) / 100;
        const restoredTotal = Math.round((taxable + gst) * 100) / 100;

        const updated = await prisma.diningSession.update({
          where: { id: session.id },
          data: {
            appliedPromoCode: null,
            discountAmount: 0.0,
            grandTotal: restoredTotal,
          },
        });

        const isZoneA = seat.zone === 'ZONE_A';
        const targetWaiterRoom: SocketRoom = isZoneA ? 'room:waiter:zoneA' : 'room:waiter:zoneB';
        const seatRoom: SocketRoom = `room:seat:${seat.seatNumber}`;

        const payload = {
          seatId: seat.id,
          seatNumber: seat.seatNumber,
          appliedPromoCode: null,
          discountAmount: 0.0,
          grandTotal: restoredTotal,
        };

        emitToMultipleRooms([targetWaiterRoom, 'room:manager', seatRoom, 'room:global'], 'payment:lock_changed', payload);
        emitToMultipleRooms([targetWaiterRoom, 'room:manager', seatRoom, 'room:global'], 'seat:updated', payload);

        return { status: 200, payload: { success: true, data: updated } };
      }

      // Validate promo code in DB
      const codeClean = promoCode.trim().toUpperCase();
      const promo = await prisma.promoCode.findFirst({
        where: {
          code: codeClean,
          isActive: true,
        },
      });

      if (!promo) {
        return { status: 400, payload: { success: false, error: 'Invalid coupon code' } };
      }

      const initialTotal = (session.subtotal || 0) + (session.gstAmount || 0);
      const effectiveBase = initialTotal > 0 ? initialTotal : session.grandTotal;

      if (effectiveBase < promo.minOrderValue) {
        return {
          status: 400,
          payload: {
            success: false,
            error: `Requires min order of ₹${promo.minOrderValue}`,
          },
        };
      }

      // Calculate discount amount matching customer display
      let discount = 0;
      if (promo.discountType === 'FLAT') {
        discount = Math.min(promo.value, effectiveBase);
      } else {
        discount = Math.min((effectiveBase * promo.value) / 100, promo.maxDiscount || effectiveBase);
      }
      discount = Math.round(discount * 100) / 100;

      const finalGrandTotal = Math.max(0, Math.round((effectiveBase - discount) * 100) / 100);

      const updated = await prisma.diningSession.update({
        where: { id: session.id },
        data: {
          appliedPromoCode: promo.code,
          discountAmount: discount,
          grandTotal: finalGrandTotal,
        },
      });

      await prisma.promoCode.update({
        where: { id: promo.id },
        data: { timesUsed: { increment: 1 } },
      });

      const isZoneA = seat.zone === 'ZONE_A';
      const targetWaiterRoom: SocketRoom = isZoneA ? 'room:waiter:zoneA' : 'room:waiter:zoneB';
      const seatRoom: SocketRoom = `room:seat:${seat.seatNumber}`;

      const payload = {
        seatId: seat.id,
        seatNumber: seat.seatNumber,
        appliedPromoCode: promo.code,
        discountAmount: discount,
        grandTotal: finalGrandTotal,
      };

      emitToMultipleRooms([targetWaiterRoom, 'room:manager', seatRoom, 'room:global'], 'payment:lock_changed', payload);
      emitToMultipleRooms([targetWaiterRoom, 'room:manager', seatRoom, 'room:global'], 'seat:updated', payload);

      return {
        status: 200,
        payload: {
          success: true,
          data: {
            appliedPromoCode: promo.code,
            discountAmount: discount,
            grandTotal: finalGrandTotal,
          },
        },
      };
    });

    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    console.error('Apply promo error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
