'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChefHat } from 'lucide-react';
import { PinPad } from '@/components/common/PinPad';
import { unlockAudio, playKitchenBell } from '@/lib/audio-synth';

export default function KitchenLoginScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handlePinSubmit = async (pin: string) => {
    unlockAudio();
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'KITCHEN', pin }),
      });
      const data = await res.json();
      if (data.success) {
        playKitchenBell();
        router.push('/kitchen/kds');
      } else {
        setError(data.error || 'Invalid Chef PIN (Try 3333)');
      }
    } catch (e) {
      setError('Connection error');
    }
  };

  return (
    <div className="w-full min-h-screen min-h-[100dvh] bg-[#FBF9F6] text-stone-900 flex flex-col justify-center items-center p-6 select-none font-sans">
      {/* Top Header */}
      <div className="text-center mb-8">
        <span className="text-xs font-black tracking-widest text-[#8A4228] uppercase font-bold">
          THOOGUDEEPA KDS
        </span>
        <div className="w-24 h-24 rounded-full border-4 border-[#8A4228] bg-[#8A4228]/10 flex items-center justify-center mx-auto my-3 shadow-xs">
          <ChefHat className="w-10 h-10 text-[#8A4228]" />
        </div>
        <h1 className="text-xl font-black text-stone-900">
          THOOGUDEEPA DONNE BIRYANI
        </h1>
        <p className="text-xs text-stone-500 mt-1">Kitchen Display System (Chef Terminal)</p>
      </div>

      {/* PIN Pad Component */}
      <div className="w-full max-w-sm bg-white border border-stone-200 rounded-3xl p-6 shadow-xs">
        <PinPad
          variant="light"
          title="KITCHEN ACCESS PIN"
          subtitle="Enter 4-digit chef PIN to unlock live tickets & audio"
          onSuccess={handlePinSubmit}
          error={error}
          buttonText="LOGIN TO KDS ➔"
        />
      </div>

      <div className="mt-8 text-xs text-stone-500">
        Default Chef PIN: <strong className="text-stone-700">3333</strong>
      </div>
    </div>
  );
}
