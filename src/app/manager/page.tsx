'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { PinPad } from '@/components/common/PinPad';
import { unlockAudio, playSuccessChime } from '@/lib/audio-synth';

export default function ManagerLoginScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handlePinSubmit = async (pin: string) => {
    unlockAudio();
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'MANAGER', pin }),
      });
      const data = await res.json();
      if (data.success) {
        playSuccessChime();
        router.push('/manager/floor');
      } else {
        setError(data.error || 'Invalid Manager PIN (Try 9999)');
      }
    } catch (e) {
      setError('Connection error');
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F6] p-3 text-stone-900 font-sans select-none flex flex-col justify-center items-center">
      <div className="border border-[#8A4228] rounded-2xl bg-[#FBF9F6] w-full max-w-lg p-8 shadow-xs flex flex-col items-center">
        {/* Logo and Auth Header matching thoogudeepa-v2 */}
        <div className="w-20 h-20 rounded-full border-2 border-[#8A4228] bg-white p-1 flex items-center justify-center mx-auto mb-3 shadow-xs overflow-hidden">
          <img
            src="/logo.jpg"
            alt="Thoogudeepa"
            className="w-full h-full object-cover rounded-full"
            onError={(e) => {
              const target = e.target as HTMLElement;
              target.style.display = 'none';
            }}
          />
        </div>

        <h1 className="text-sm font-bold text-stone-900 tracking-wider uppercase mb-4 text-center">
          MANAGER / CASHIER AUTHENTICATION
        </h1>

        <div className="w-full bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
          <div className="mb-4">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
              Staff Profile:
            </label>
            <div className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800">
              MANJUNATH (GENERAL MANAGER) — (General Manager)
            </div>
          </div>

          <PinPad
            title=""
            subtitle="Enter 4-digit PIN to access Executive Cockpit"
            onSuccess={handlePinSubmit}
            error={error}
            buttonText="VERIFY & UNLOCK DESK"
            variant="light"
          />
        </div>

        <div className="mt-6 text-xs text-stone-500 text-center">
          Default Manager PIN: <strong className="text-stone-700">9999</strong>
        </div>
      </div>
    </div>
  );
}
