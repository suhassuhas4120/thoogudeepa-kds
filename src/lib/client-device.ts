'use client';

/**
 * Client-side Device Identity Management
 * 
 * Provides resilient, multi-layered device identity via:
 * 1. Persistent LocalStorage (thoogudeepa_diner_device_token)
 * 2. Persistent Document Cookie (diner_device_token, 365 days)
 * 
 * Survives browser closures, tab closures, and phone restarts.
 */

const DEVICE_STORAGE_KEY = 'thoogudeepa_diner_device_token';
const DEVICE_COOKIE_KEY = 'diner_device_token';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `diner_${crypto.randomUUID()}`;
  }
  return `diner_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

export function getDinerDeviceToken(): string {
  if (typeof window === 'undefined') return '';

  let token = localStorage.getItem(DEVICE_STORAGE_KEY);

  // Fallback to cookie if localStorage was cleared
  if (!token) {
    const match = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${DEVICE_COOKIE_KEY}=`));
    if (match) {
      token = match.split('=')[1];
    }
  }

  // Generate new persistent token if neither exists
  if (!token || token.trim().length < 5) {
    token = generateUUID();
  }

  // Ensure both storage and cookie are in sync (1 year expiry)
  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, token);
    document.cookie = `${DEVICE_COOKIE_KEY}=${token}; path=/; max-age=31536000; SameSite=Lax`;
  } catch (e) {
    console.warn('Failed to persist device token:', e);
  }

  return token;
}

export function getDeviceHeaders(): Record<string, string> {
  const token = getDinerDeviceToken();
  return token ? { 'x-device-token': token } : {};
}
