import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureWalMode } from '@/lib/db';
import { checkRateLimit, recordFailedAttempt, resetAttempts } from '@/lib/rate-limiter';
import { signStaffSession } from '@/lib/auth-tokens';

export async function POST(req: NextRequest) {
  try {
    await ensureWalMode();
    const body = await req.json();
    const { role, pin, staffName } = body;

    // Derive client rate-limiting key
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'local-client';
    const rateLimitKey = `${ip}:${staffName || role || 'terminal'}`;

    // 1. Enforce Sliding Window Rate Limit & Lockout
    const rateCheck = await checkRateLimit(rateLimitKey);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many failed attempts. Terminal locked for security. Please try again in ${rateCheck.lockedForSeconds} seconds.`,
          locked: true,
          lockedForSeconds: rateCheck.lockedForSeconds,
        },
        { status: 429 }
      );
    }

    if (!pin) {
      return NextResponse.json({ success: false, error: 'PIN is required' }, { status: 400 });
    }

    // 2. Find matching staff
    let staff;
    if (staffName) {
      staff = await prisma.staff.findFirst({
        where: { name: staffName, pin: String(pin), isActive: true },
      });
    } else if (role) {
      staff = await prisma.staff.findFirst({
        where: { role: String(role).toUpperCase(), pin: String(pin), isActive: true },
      });
    }

    // 3. Handle Invalid PIN with Attempt Tracking
    if (!staff) {
      const failedResult = recordFailedAttempt(rateLimitKey);
      if (failedResult.isLocked) {
        return NextResponse.json(
          {
            success: false,
            error: `Terminal locked! Exceeded 5 failed attempts. Please wait ${failedResult.lockedForSeconds}s.`,
            locked: true,
            lockedForSeconds: failedResult.lockedForSeconds,
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: `Invalid PIN. Access denied. (${failedResult.remainingAttempts} attempts remaining)`,
          remainingAttempts: failedResult.remainingAttempts,
        },
        { status: 401 }
      );
    }

    // 4. Success: Reset rate-limit counter
    resetAttempts(rateLimitKey);

    // 5. Issue Cryptographic HMAC-SHA256 Token
    const sessionToken = signStaffSession({
      staffId: staff.id,
      name: staff.name,
      role: staff.role,
      zone: staff.assignedZone,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        assignedZone: staff.assignedZone,
        token: sessionToken,
      },
    });

    // Set HttpOnly, SameSite=Lax Cookie
    response.cookies.set('thoogudeepa_session', sessionToken, {
      httpOnly: true,
      secure: false, // Local LAN / HTTP compatible
      sameSite: 'lax',
      path: '/',
      maxAge: 16 * 60 * 60, // 16 hours
    });

    return response;
  } catch (error) {
    console.error('PIN verification error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
