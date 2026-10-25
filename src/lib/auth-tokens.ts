import crypto from 'crypto';

const TOKEN_SECRET =
  process.env.SESSION_SECRET ||
  'thoogudeepa-kds-ultra-secure-hmac-sha256-key-9999-2026';
const TOKEN_EXPIRY_MS = 16 * 60 * 60 * 1000; // 16 hours (full restaurant double shift)

export interface StaffSessionPayload {
  staffId: string;
  name: string;
  role: string;
  zone?: string | null;
  exp: number;
}

/**
 * Creates a cryptographically signed HMAC-SHA256 session token
 */
export function signStaffSession(payload: Omit<StaffSessionPayload, 'exp'>): string {
  const fullPayload: StaffSessionPayload = {
    ...payload,
    exp: Date.now() + TOKEN_EXPIRY_MS,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies HMAC-SHA256 signature and validates expiration
 */
export function verifyStaffSession(token: string): StaffSessionPayload | null {
  try {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadBase64, providedSig] = parts;

    // Verify cryptographic signature
    const expectedSig = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(payloadBase64)
      .digest('base64url');

    const providedBuf = Buffer.from(providedSig);
    const expectedBuf = Buffer.from(expectedSig);

    if (
      providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      return null;
    }

    // Parse and verify expiry
    const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf8');
    const payload: StaffSessionPayload = JSON.parse(payloadJson);

    if (Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch (err) {
    console.error('Failed to verify token:', err);
    return null;
  }
}
